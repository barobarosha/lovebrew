import { TRPCError } from "@trpc/server";

/**
 * Простой in-memory rate limiter (скользящее окно).
 * Достаточен для одного инстанса приложения: защищает вход в админку,
 * отправку OTP и создание заявок от перебора и спама.
 */

type Bucket = number[]; // timestamps (ms) последних запросов

const buckets = new Map<string, Bucket>();

// Периодическая очистка, чтобы карта не росла бесконечно
let lastSweep = Date.now();
function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, ts] of buckets) {
    const fresh = ts.filter((t) => now - t < windowMs);
    if (fresh.length) buckets.set(key, fresh);
    else buckets.delete(key);
  }
}

/** Бросает TOO_MANY_REQUESTS, если в окне windowMs уже было limit запросов по ключу. */
export function rateLimitOrThrow(key: string, limit: number, windowMs: number) {
  sweep(windowMs);
  const now = Date.now();
  const ts = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (ts.length >= limit) {
    const retrySec = Math.max(1, Math.ceil((windowMs - (now - ts[0])) / 1000));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Слишком много запросов. Повторите через ${retrySec} сек.`,
    });
  }
  ts.push(now);
  buckets.set(key, ts);
}

/** IP клиента (за прокси берём первый адрес из x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
