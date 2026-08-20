import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../queries/connection";
import { adminSessions } from "@db/schema";
import {
  DEFAULT_ADMIN_PASSWORD,
  getAllSettings,
  setSetting,
} from "./settings";

function hashPassword(password: string, salt: string): string {
  return createHash("sha256")
    .update(`${salt}:${password}`)
    .digest("hex");
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const s = await getAllSettings();
  const stored = s.admin_password_hash;
  if (!stored) {
    // No password set yet — fall back to the default password
    return password === DEFAULT_ADMIN_PASSWORD;
  }
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = hashPassword(password, salt);
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(hash, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function changeAdminPassword(newPassword: string) {
  const salt = randomBytes(16).toString("hex");
  await setSetting("admin_password_hash", `${salt}:${hashPassword(newPassword, salt)}`);
}

export async function createAdminSession(): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await getDb().insert(adminSessions).values({ token, expiresAt });
  return token;
}

export async function assertAdmin(token: string) {
  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Требуется вход" });
  }
  const rows = await getDb()
    .select()
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.token, token),
        gt(adminSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!rows.length) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Сессия истекла, войдите снова",
    });
  }
}

export async function destroyAdminSession(token: string) {
  await getDb().delete(adminSessions).where(eq(adminSessions.token, token));
}
