import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { analyticsEvents } from "@db/schema";

const ALLOWED_EVENTS = new Set([
  "pwa_open",
  "pwa_login",
  "pwa_menu_view",
  "pwa_menu_item_view",
  "pwa_bonuses_view",
  "pwa_qr_shown",
  "pwa_events_view",
  "pwa_booking_start",
  "pwa_booking_created",
  "pwa_profile_view",
]);

export async function trackEvent(
  event: string,
  opts: { customerId?: number | null; sessionKey?: string | null; meta?: unknown } = {},
) {
  if (!ALLOWED_EVENTS.has(event)) return;
  try {
    await getDb()
      .insert(analyticsEvents)
      .values({
        event,
        customerId: opts.customerId ?? null,
        sessionKey: (opts.sessionKey ?? "").slice(0, 64) || null,
        meta: opts.meta ? JSON.stringify(opts.meta).slice(0, 2000) : null,
      });
  } catch (e) {
    console.error("[analytics] track failed:", (e as Error).message);
  }
}

// Ключ уникального пользователя: id клиента, если авторизован, иначе
// анонимный session_key. ВАЖНО: один и тот же человек до и после входа
// считается как два разных «гостя» — склеить их можно только на клиенте
// (session_key живёт в localStorage и не знает будущий customer_id).
const VISITOR_KEY = "COALESCE(CAST(customer_id AS CHAR), session_key)";

// Активность считаем строго от полуночи по московскому времени
// (UTC+3 круглый год): «за сегодня» = с 00:00 МСК, «за неделю» — 7
// календарных дней включая сегодня, «за месяц» — 30 дней включая сегодня.
const MSK_START = "DATE_SUB(DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+03:00')), INTERVAL ";

export interface AppStats {
  dau: number;
  wau: number;
  mau: number;
  totalCustomers: number;
  totalEvents: number;
  funnel: { event: string; label: string; count: number }[];
  bookingsBySource: { source: string; count: number }[];
  eventsByDay: { day: string; count: number }[];
}

export async function getAppStats(): Promise<AppStats> {
  const db = getDb();

  // daysBack: 0 = сегодня (с 00:00 МСК), 6 = последние 7 календарных дней,
  // 29 = последние 30 календарных дней.
  const active = async (daysBack: number) => {
    const rows = await db.execute(sql.raw(`
      SELECT COUNT(DISTINCT ${VISITOR_KEY}) AS c
      FROM analytics_events
      WHERE created_at >= CONVERT_TZ(${MSK_START}${daysBack} DAY), '+03:00', '+00:00')
        AND (customer_id IS NOT NULL OR session_key IS NOT NULL)
    `));
    return Number((rows[0] as unknown as { c: number }[])[0]?.c ?? 0);
  };

  const [dau, wau, mau] = await Promise.all([active(0), active(6), active(29)]);

  const customersRows = await db.execute(
    sql`SELECT COUNT(*) AS c FROM customers`,
  );
  const totalCustomers = Number(
    (customersRows[0] as unknown as { c: number }[])[0]?.c ?? 0,
  );

  const totalRows = await db.execute(
    sql`SELECT COUNT(*) AS c FROM analytics_events`,
  );
  const totalEvents = Number(
    (totalRows[0] as unknown as { c: number }[])[0]?.c ?? 0,
  );

  // Воронка: уникальные посетители (а не события — один человек может
  // открывать меню десять раз) за последние 30 календарных дней по МСК.
  const funnelDefs: [string, string][] = [
    ["pwa_open", "Открыли приложение"],
    ["pwa_login", "Вошли по телефону"],
    ["pwa_menu_view", "Смотрели меню"],
    ["pwa_booking_start", "Начали бронирование"],
    ["pwa_booking_created", "Оформили бронь"],
  ];
  const funnel: AppStats["funnel"] = [];
  for (const [event, label] of funnelDefs) {
    const rows = await db.execute(sql.raw(`
      SELECT COUNT(DISTINCT ${VISITOR_KEY}) AS c FROM analytics_events
      WHERE event = '${event}'
        AND created_at >= CONVERT_TZ(${MSK_START}29 DAY), '+03:00', '+00:00')
    `));
    funnel.push({
      event,
      label,
      count: Number((rows[0] as unknown as { c: number }[])[0]?.c ?? 0),
    });
  }

  const sourceRows = await db.execute(sql`
    SELECT source, COUNT(*) AS c FROM bookings GROUP BY source
  `);
  const bookingsBySource = (sourceRows[0] as unknown as { source: string; c: number }[]).map(
    (r) => ({ source: r.source, count: Number(r.c) }),
  );

  // График: дни по московскому календарю (UTC+3), иначе вечерние события
  // уезжают в «завтра».
  const dayRows = await db.execute(sql.raw(`
    SELECT DATE(CONVERT_TZ(created_at, '+00:00', '+03:00')) AS day, COUNT(*) AS c
    FROM analytics_events
    WHERE created_at >= CONVERT_TZ(${MSK_START}13 DAY), '+03:00', '+00:00')
    GROUP BY day
    ORDER BY day
  `));
  const eventsByDay = (dayRows[0] as unknown as { day: string; c: number }[]).map(
    (r) => ({ day: String(r.day).slice(0, 10), count: Number(r.c) }),
  );

  return { dau, wau, mau, totalCustomers, totalEvents, funnel, bookingsBySource, eventsByDay };
}
