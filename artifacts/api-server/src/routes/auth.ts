import { randomBytes, randomUUID, pbkdf2, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  LoginAccountBody,
  RegisterAccountBody,
} from "@workspace/api-zod";
import { accountSessions, accounts, db } from "@workspace/db";
import { hashSessionToken, requireAuth } from "../middlewares/require-auth";

const router: IRouter = Router();
const deriveKey = promisify(pbkdf2);
const PASSWORD_ITERATIONS = 310_000;
const PASSWORD_BYTES = 32;
const SESSION_TTL_DAYS = 90;

async function passwordHash(password: string): Promise<string> {
  const salt = randomBytes(16);
  const digest = await deriveKey(password, salt, PASSWORD_ITERATIONS, PASSWORD_BYTES, "sha256");
  return `${salt.toString("hex")}$${digest.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, digestHex] = stored.split("$", 2);
  if (!saltHex || !digestHex) return false;

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(digestHex, "hex");
    if (salt.length !== 16 || expected.length !== PASSWORD_BYTES) return false;
    const actual = await deriveKey(password, salt, PASSWORD_ITERATIONS, PASSWORD_BYTES, "sha256");
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function createSession(accountId: string) {
  const token = randomBytes(40).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(accountSessions).values({
    id: randomUUID(),
    accountId,
    tokenHash: hashSessionToken(token),
    createdAt: now,
    expiresAt,
  });

  return token;
}

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Укажите корректный email и пароль от 10 до 128 символов" });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const id = randomUUID();

  try {
    const [account] = await db
      .insert(accounts)
      .values({
        id,
        email,
        passwordHash: await passwordHash(parsed.data.password),
      })
      .returning({ id: accounts.id, email: accounts.email });

    const token = await createSession(account.id);
    res.status(201).json({ account, token });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      res.status(409).json({ error: "Аккаунт с этой почтой уже существует" });
      return;
    }
    throw error;
  }
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Укажите email и пароль" });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [account] = await db
    .select({
      id: accounts.id,
      email: accounts.email,
      passwordHash: accounts.passwordHash,
    })
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);

  if (!account || !(await verifyPassword(parsed.data.password, account.passwordHash))) {
    res.status(401).json({ error: "Неверная почта или пароль" });
    return;
  }

  const token = await createSession(account.id);
  res.json({ account: { id: account.id, email: account.email }, token });
});

router.get("/auth/me", requireAuth, (_req, res) => {
  res.json({
    id: res.locals.accountId as string,
    email: res.locals.accountEmail as string,
  });
});

router.post("/auth/logout", requireAuth, async (_req, res) => {
  await db
    .delete(accountSessions)
    .where(
      and(
        eq(accountSessions.accountId, res.locals.accountId as string),
        eq(accountSessions.tokenHash, res.locals.sessionTokenHash as string),
      ),
    );
  res.json({ success: true });
});

export default router;
