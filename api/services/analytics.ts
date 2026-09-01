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

  const active = async (days: number) => {
    const rows = await db.execute(sql`
      SELECT COUNT(DISTINCT COALESCE(CAST(customer_id AS CHAR), session_key)) AS c
      FROM analytics_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
        AND (customer_id IS NOT NULL OR session_key IS NOT NULL)
    `);
    return Number((rows[0] as unknown as { c: number }[])[0]?.c ?? 0);
  };

  const [dau, wau, mau] = await Promise.all([active(1), active(7), active(30)]);

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

  const funnelDefs: [string, string][] = [
    ["pwa_open", "Открыли приложение"],
    ["pwa_login", "Вошли по телефону"],
    ["pwa_menu_view", "Смотрели меню"],
    ["pwa_booking_start", "Начали бронирование"],
    ["pwa_booking_created", "Оформили бронь"],
  ];
  const funnel: AppStats["funnel"] = [];
  for (const [event, label] of funnelDefs) {
    const rows = await db.execute(sql`
      SELECT COUNT(*) AS c FROM analytics_events
      WHERE event = ${event} AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
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

  const dayRows = await db.execute(sql`
    SELECT DATE(created_at) AS day, COUNT(*) AS c
    FROM analytics_events
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
    GROUP BY DATE(created_at)
    ORDER BY day
  `);
  const eventsByDay = (dayRows[0] as unknown as { day: string; c: number }[]).map(
    (r) => ({ day: String(r.day), count: Number(r.c) }),
  );

  return { dau, wau, mau, totalCustomers, totalEvents, funnel, bookingsBySource, eventsByDay };
}
