import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AddCompletionBody,
  AddWaterBody,
  SaveProfileBody,
  SaveWeightBody,
} from "@workspace/api-zod";
import {
  db,
  profiles,
  waterEntries,
  weightEntries,
  workoutCompletions,
} from "@workspace/db";
import { requireAuth } from "../middlewares/require-auth";

const router: IRouter = Router();
const DAILY_WATER_GOAL_ML = 2000;
const WEEKLY_WORKOUT_GOAL = 6;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function queryDate(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function utcDayNumber(date: string) {
  return Math.floor(Date.parse(`${date}T00:00:00.000Z`) / 86_400_000);
}

function shiftDate(date: string, days: number) {
  return new Date((utcDayNumber(date) + days) * 86_400_000).toISOString().slice(0, 10);
}

function weekStart(date: string) {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return shiftDate(date, -((weekday + 6) % 7));
}

function streakStats(sortedDates: string[], referenceDate: string) {
  let best = 0;
  let run = 0;
  let previous: number | null = null;

  for (const date of sortedDates) {
    const current = utcDayNumber(date);
    run = previous !== null && current === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = current;
  }

  const latest = sortedDates.at(-1);
  if (!latest || utcDayNumber(referenceDate) - utcDayNumber(latest) > 1) {
    return { streak: 0, bestStreak: best };
  }

  let streak = 1;
  for (let i = sortedDates.length - 1; i > 0; i -= 1) {
    if (utcDayNumber(sortedDates[i]) - utcDayNumber(sortedDates[i - 1]) !== 1) break;
    streak += 1;
  }
  return { streak, bestStreak: best };
}

function rangeLength(from: string, to: string) {
  return utcDayNumber(to) - utcDayNumber(from) + 1;
}

router.get("/overview", requireAuth, async (req, res) => {
  const date = queryDate(req.query.date) ?? todayUtc();
  if (!isDate(date)) {
    res.status(400).json({ error: "Укажите дату в формате ГГГГ-ММ-ДД" });
    return;
  }

  const accountId = res.locals.accountId as string;
  const from = weekStart(date);
  const to = shiftDate(from, 6);
  const [profile] = await db
    .select({ weightKg: profiles.weightKg })
    .from(profiles)
    .where(eq(profiles.accountId, accountId))
    .limit(1);
  const completionRows = await db
    .select({ date: workoutCompletions.date })
    .from(workoutCompletions)
    .where(eq(workoutCompletions.accountId, accountId))
    .orderBy(asc(workoutCompletions.date));
  const allDates = [...new Set(completionRows.map((row) => row.date))];
  const weekDays = new Set(allDates.filter((day) => day >= from && day <= to)).size;
  const [latestWeight] = await db
    .select({ kg: weightEntries.kg })
    .from(weightEntries)
    .where(eq(weightEntries.accountId, accountId))
    .orderBy(desc(weightEntries.date))
    .limit(1);
  const todayWater = await db
    .select({ ml: waterEntries.ml })
    .from(waterEntries)
    .where(and(eq(waterEntries.accountId, accountId), eq(waterEntries.date, date)));
  const stats = streakStats(allDates, date);

  res.json({
    date,
    profileComplete: Boolean(profile),
    totalCompleted: completionRows.length,
    weekDays,
    weeklyGoal: WEEKLY_WORKOUT_GOAL,
    streak: stats.streak,
    bestStreak: stats.bestStreak,
    todayWaterMl: todayWater.reduce((total, row) => total + row.ml, 0),
    waterGoalMl: DAILY_WATER_GOAL_ML,
    latestWeightKg: latestWeight?.kg ?? profile?.weightKg ?? null,
  });
});

router.get("/profile", requireAuth, async (_req, res) => {
  const [profile] = await db
    .select({
      sex: profiles.sex,
      age: profiles.age,
      heightCm: profiles.heightCm,
      weightKg: profiles.weightKg,
      activity: profiles.activity,
      goal: profiles.goal,
      level: profiles.level,
    })
    .from(profiles)
    .where(eq(profiles.accountId, res.locals.accountId as string))
    .limit(1);

  res.json({ profile: profile ?? null });
});

router.put("/profile", requireAuth, async (req, res) => {
  const parsed = SaveProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Проверьте возраст, рост, вес и параметры профиля" });
    return;
  }

  const accountId = res.locals.accountId as string;
  const profile = parsed.data;
  const now = new Date();
  await db
    .insert(profiles)
    .values({ accountId, ...profile, updatedAt: now })
    .onConflictDoUpdate({
      target: profiles.accountId,
      set: { ...profile, updatedAt: now },
    });

  const date = todayUtc();
  await db
    .insert(weightEntries)
    .values({ id: randomUUID(), accountId, date, kg: profile.weightKg, createdAt: now })
    .onConflictDoUpdate({
      target: [weightEntries.accountId, weightEntries.date],
      set: { kg: profile.weightKg, createdAt: now },
    });

  res.json({ profile });
});

router.get("/completions", requireAuth, async (req, res) => {
  const from = queryDate(req.query.from);
  const to = queryDate(req.query.to);
  if ((from && !isDate(from)) || (to && !isDate(to)) || (from && to && from > to)) {
    res.status(400).json({ error: "Укажите корректный диапазон дат" });
    return;
  }

  const conditions = [eq(workoutCompletions.accountId, res.locals.accountId as string)];
  if (from) conditions.push(gte(workoutCompletions.date, from));
  if (to) conditions.push(lte(workoutCompletions.date, to));

  const rows = await db
    .select()
    .from(workoutCompletions)
    .where(and(...conditions))
    .orderBy(desc(workoutCompletions.date), desc(workoutCompletions.completedAt))
    .limit(2000);

  res.json(
    rows.map((row) => ({
      id: row.id,
      workoutId: row.workoutId,
      date: row.date,
      completedAt: row.completedAt.toISOString(),
    })),
  );
});

router.post("/completions", requireAuth, async (req, res) => {
  const parsed = AddCompletionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Укажите тренировку и корректную дату" });
    return;
  }

  const date = parsed.data.date.toISOString().slice(0, 10);
  const accountId = res.locals.accountId as string;
  const [inserted] = await db
    .insert(workoutCompletions)
    .values({
      id: randomUUID(),
      accountId,
      workoutId: parsed.data.workoutId,
      date,
    })
    .onConflictDoNothing()
    .returning();

  const row =
    inserted ??
    (
      await db
        .select()
        .from(workoutCompletions)
        .where(
          and(
            eq(workoutCompletions.accountId, accountId),
            eq(workoutCompletions.workoutId, parsed.data.workoutId),
            eq(workoutCompletions.date, date),
          ),
        )
        .limit(1)
    )[0];

  res.status(201).json({
    id: row.id,
    workoutId: row.workoutId,
    date: row.date,
    completedAt: row.completedAt.toISOString(),
  });
});

router.delete("/completions/:id", requireAuth, async (req, res) => {
  const [removed] = await db
    .delete(workoutCompletions)
    .where(
      and(
        eq(workoutCompletions.id, String(req.params.id)),
        eq(workoutCompletions.accountId, res.locals.accountId as string),
      ),
    )
    .returning({ id: workoutCompletions.id });
  if (!removed) {
    res.status(404).json({ error: "Запись не найдена" });
    return;
  }
  res.json({ success: true });
});

router.get("/weights", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(weightEntries)
    .where(eq(weightEntries.accountId, res.locals.accountId as string))
    .orderBy(asc(weightEntries.date))
    .limit(1000);
  res.json(rows.map(({ id, date, kg }) => ({ id, date, kg })));
});

router.post("/weights", requireAuth, async (req, res) => {
  const parsed = SaveWeightBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Укажите вес от 30 до 250 кг и корректную дату" });
    return;
  }

  const date = parsed.data.date.toISOString().slice(0, 10);
  const accountId = res.locals.accountId as string;
  const [entry] = await db
    .insert(weightEntries)
    .values({
      id: randomUUID(),
      accountId,
      date,
      kg: parsed.data.kg,
    })
    .onConflictDoUpdate({
      target: [weightEntries.accountId, weightEntries.date],
      set: { kg: parsed.data.kg, createdAt: new Date() },
    })
    .returning({ id: weightEntries.id, date: weightEntries.date, kg: weightEntries.kg });

  await db
    .update(profiles)
    .set({ weightKg: parsed.data.kg, updatedAt: new Date() })
    .where(eq(profiles.accountId, accountId));

  res.json(entry);
});

router.get("/water", requireAuth, async (req, res) => {
  const date = queryDate(req.query.date);
  if (!isDate(date)) {
    res.status(400).json({ error: "Укажите дату в формате ГГГГ-ММ-ДД" });
    return;
  }

  const entries = await db
    .select({ id: waterEntries.id, ml: waterEntries.ml, createdAt: waterEntries.createdAt })
    .from(waterEntries)
    .where(
      and(
        eq(waterEntries.accountId, res.locals.accountId as string),
        eq(waterEntries.date, date),
      ),
    )
    .orderBy(asc(waterEntries.createdAt));

  res.json({
    date,
    totalMl: entries.reduce((total, entry) => total + entry.ml, 0),
    goalMl: DAILY_WATER_GOAL_ML,
    entries: entries.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    })),
  });
});

router.post("/water", requireAuth, async (req, res) => {
  const parsed = AddWaterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Укажите объём от 50 до 2000 мл и корректную дату" });
    return;
  }

  const date = parsed.data.date.toISOString().slice(0, 10);
  const accountId = res.locals.accountId as string;
  await db.insert(waterEntries).values({
    id: randomUUID(),
    accountId,
    date,
    ml: parsed.data.ml,
  });

  const entries = await db
    .select({ id: waterEntries.id, ml: waterEntries.ml, createdAt: waterEntries.createdAt })
    .from(waterEntries)
    .where(
      and(
        eq(waterEntries.accountId, accountId),
        eq(waterEntries.date, date),
      ),
    )
    .orderBy(asc(waterEntries.createdAt));

  res.status(201).json({
    date,
    totalMl: entries.reduce((total, entry) => total + entry.ml, 0),
    goalMl: DAILY_WATER_GOAL_ML,
    entries: entries.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    })),
  });
});

router.get("/analytics", requireAuth, async (req, res) => {
  const from = queryDate(req.query.from);
  const to = queryDate(req.query.to);
  if (!isDate(from) || !isDate(to) || from > to || rangeLength(from, to) > 366) {
    res.status(400).json({ error: "Укажите корректный диапазон до 366 дней" });
    return;
  }

  const accountId = res.locals.accountId as string;
  const [completionRows, waterRows, weightRows] = await Promise.all([
    db
      .select({ date: workoutCompletions.date })
      .from(workoutCompletions)
      .where(
        and(
          eq(workoutCompletions.accountId, accountId),
          gte(workoutCompletions.date, from),
          lte(workoutCompletions.date, to),
        ),
      ),
    db
      .select({ date: waterEntries.date, ml: waterEntries.ml })
      .from(waterEntries)
      .where(
        and(
          eq(waterEntries.accountId, accountId),
          gte(waterEntries.date, from),
          lte(waterEntries.date, to),
        ),
      ),
    db
      .select({ date: weightEntries.date, kg: weightEntries.kg })
      .from(weightEntries)
      .where(
        and(
          eq(weightEntries.accountId, accountId),
          gte(weightEntries.date, from),
          lte(weightEntries.date, to),
        ),
      ),
  ]);

  const workoutsByDay = new Map<string, number>();
  for (const row of completionRows) {
    workoutsByDay.set(row.date, (workoutsByDay.get(row.date) ?? 0) + 1);
  }
  const waterByDay = new Map<string, number>();
  for (const row of waterRows) {
    waterByDay.set(row.date, (waterByDay.get(row.date) ?? 0) + row.ml);
  }
  const weightByDay = new Map(weightRows.map((row) => [row.date, row.kg]));
  const days = Array.from({ length: rangeLength(from, to) }, (_, index) => {
    const date = shiftDate(from, index);
    return {
      date,
      workouts: workoutsByDay.get(date) ?? 0,
      waterMl: waterByDay.get(date) ?? 0,
      weightKg: weightByDay.get(date) ?? null,
    };
  });

  res.json({ days });
});

export default router;
