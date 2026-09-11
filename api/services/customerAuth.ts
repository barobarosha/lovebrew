import { randomBytes, randomInt } from "crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../queries/connection";
import { customers, customerSessions, otpCodes } from "@db/schema";
import { getRestoProvider } from "../quickresto/provider";
import { getAllSettings } from "./settings";

export type Customer = typeof customers.$inferSelect;

/** Нормализация телефона к виду 79XXXXXXXXX. null — некорректный номер. */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 10) digits = "7" + digits;
  if (digits.length === 11 && digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (digits.length === 11 && digits.startsWith("7")) return digits;
  return null;
}

export function formatPhone(p: string): string {
  if (p.length !== 11) return p;
  return `+7 (${p.slice(1, 4)}) ${p.slice(4, 7)}-${p.slice(7, 9)}-${p.slice(9)}`;
}

const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 дней

/**
 * Запрос кода. SMS-шлюз пока не подключён (пилот), поэтому код возвращается
 * в ответе (debugCode) и показывается в интерфейсе. Когда появится SMS-провайдер
 * — здесь добавится отправка, а debugCode уберём.
 */
export async function requestOtp(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Введите корректный номер телефона",
    });
  }
  const db = getDb();
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
  const code = String(randomInt(1000, 10000));
  await db.insert(otpCodes).values({
    phone,
    code,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  // Пилотный режим: SMS-шлюз не подключён, код показываем в интерфейсе.
  // Отключается настройкой otp_debug_mode="0" в админке (обязательно
  // выключить после подключения SMS — иначе вход по чужому номеру возможен).
  const s = await getAllSettings();
  const debug = s.otp_debug_mode !== "0";
  return { phone, debugCode: debug ? code : null };
}

export async function verifyOtp(rawPhone: string, code: string, name?: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Некорректный телефон" });
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.id))
    .limit(1);
  const otp = rows[0];
  if (!otp) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Код не запрошен или истёк — запросите новый",
    });
  }
  if (otp.attempts >= 5) {
    await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Слишком много попыток — запросите код заново",
    });
  }
  if (otp.code !== code.trim()) {
    await db
      .update(otpCodes)
      .set({ attempts: otp.attempts + 1 })
      .where(eq(otpCodes.id, otp.id));
    throw new TRPCError({ code: "BAD_REQUEST", message: "Неверный код" });
  }
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));

  // Найти или создать клиента
  let customer = (
    await db.select().from(customers).where(eq(customers.phone, phone)).limit(1)
  )[0];
  if (!customer) {
    const [res] = await db.insert(customers).values({
      phone,
      name: name?.trim() || "",
    });
    customer = (
      await db
        .select()
        .from(customers)
        .where(eq(customers.id, Number((res as { insertId?: number }).insertId)))
        .limit(1)
    )[0];
  } else if (name?.trim() && !customer.name) {
    await db
      .update(customers)
      .set({ name: name.trim() })
      .where(eq(customers.id, customer.id));
    customer = { ...customer, name: name.trim() };
  }

  // Привязка к Quick Resto — в фоне, не блокирует вход
  void linkCustomerToQuickResto(customer.id, phone, customer.name);

  const token = randomBytes(24).toString("hex");
  await db.insert(customerSessions).values({
    token,
    customerId: customer.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return { token, customer };
}

/** Фоновая привязка клиента к CRM Quick Resto (через активный провайдер) */
export async function linkCustomerToQuickResto(
  customerId: number,
  phone: string,
  name: string,
) {
  try {
    const provider = await getRestoProvider();
    if (!provider) return;
    const ref = await provider.createCustomer({ phone, name });
    if (ref?.guid) {
      await getDb()
        .update(customers)
        .set({ qrCustomerGuid: ref.guid })
        .where(eq(customers.id, customerId));
    }
  } catch (e) {
    console.error("[quickresto] link customer failed:", (e as Error).message);
  }
}

export async function getCustomerByToken(token: string): Promise<Customer | null> {
  if (!token || token.length < 10) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(customerSessions)
    .where(
      and(
        eq(customerSessions.token, token),
        gt(customerSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const session = rows[0];
  if (!session) return null;
  const customer = (
    await db
      .select()
      .from(customers)
      .where(eq(customers.id, session.customerId))
      .limit(1)
  )[0];
  return customer ?? null;
}

export async function assertCustomer(token: string): Promise<Customer> {
  const customer = await getCustomerByToken(token);
  if (!customer) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Войдите по номеру телефона",
    });
  }
  return customer;
}

export async function destroyCustomerSession(token: string) {
  await getDb()
    .delete(customerSessions)
    .where(eq(customerSessions.token, token));
}

export async function updateCustomerName(token: string, name: string) {
  const customer = await assertCustomer(token);
  await getDb()
    .update(customers)
    .set({ name: name.trim().slice(0, 120) })
    .where(eq(customers.id, customer.id));
  return { ...customer, name: name.trim() };
}
