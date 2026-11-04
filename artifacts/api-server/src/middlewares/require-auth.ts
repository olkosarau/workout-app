import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { RequestHandler } from "express";
import { accountSessions, accounts, db } from "@workspace/db";

export const hashSessionToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const requireAuth: RequestHandler = async (req, res, next) => {
  const match = req.header("authorization")?.match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1];

  if (!token || token.length > 256) {
    res.status(401).json({ error: "Требуется войти в аккаунт" });
    return;
  }

  const [session] = await db
    .select({
      accountId: accountSessions.accountId,
      email: accounts.email,
      tokenHash: accountSessions.tokenHash,
    })
    .from(accountSessions)
    .innerJoin(accounts, eq(accounts.id, accountSessions.accountId))
    .where(
      and(
        eq(accountSessions.tokenHash, hashSessionToken(token)),
        gt(accountSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) {
    res.status(401).json({ error: "Сессия истекла. Войдите снова." });
    return;
  }

  res.locals.accountId = session.accountId;
  res.locals.accountEmail = session.email;
  res.locals.sessionTokenHash = session.tokenHash;
  next();
};
