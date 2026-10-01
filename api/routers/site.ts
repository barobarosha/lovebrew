import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { eventRegistrations, events, menuItems } from "@db/schema";
import { getPublicSettings } from "../services/settings";
import { getMonthCalendar } from "../services/availability";
import { getYearHolidayDates } from "../services/holidays";
import { getRestoProvider } from "../quickresto/provider";
import {
  eventSummaryLine,
  notifyAdminEventRegistration,
} from "../services/telegram";
import { clientIp, rateLimitOrThrow } from "../lib/rateLimit";
import { normalizePhone } from "../services/customerAuth";

const phoneRegex = /^[+\d][\d\s()\-]{6,20}$/;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const siteRouter = createRouter({
  // Public settings (prices, contacts, promos)
  content: publicQuery.query(async () => {
    const settings = await getPublicSettings();
    const db = getDb();
    // Меню: Quick Resto (если интеграция включена и отдала позиции),
    // иначе — ручное меню из админки. Источник возвращаем клиенту.
    const provider = await getRestoProvider();
    if (provider) {
      try {
        const qrItems = await provider.getMenu();
        // Меню из облака берём только если оно пригодное: цена есть
        // минимум у половины позиций (иначе Quick Resto отдал список
        // без цен из dishPrices или категории вместо блюд) — тогда
        // показываем меню из админки.
        const priced = qrItems.filter((i) => i.price != null).length;
        if (qrItems.length >= 3 && priced * 2 >= qrItems.length) {
          return {
            settings,
            menuSource: "quickresto" as const,
            menu: qrItems.map((i) => ({
              category: i.categoryName,
              name: i.name,
              description: i.description ?? null,
              price: i.price,
              volume: i.volume ?? null,
              imageUrl: i.imageUrl ?? null,
            })),
          };
        }
      } catch (e) {
        console.error("[quickresto] site menu failed, fallback to site menu:", (e as Error).message);
      }
    }
    const menu = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.isActive, true))
      .orderBy(asc(menuItems.sortOrder), asc(menuItems.id));
    return { settings, menuSource: "site" as const, menu };
  }),

  // Published event announcements (upcoming first)
  events: publicQuery.query(async () => {
    const db = getDb();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return db
      .select()
      .from(events)
      .where(eq(events.isPublished, true))
      .orderBy(asc(events.date))
      .then((rows) => ({
        upcoming: rows.filter((r) => r.date >= todayStr),
        past: rows.filter((r) => r.date < todayStr).slice(-6).reverse(),
      }));
  }),

  // Calendar for a month: loft slots, coworking occupancy, events, holidays
  calendar: publicQuery
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(({ input }) => getMonthCalendar(input.month)),

  // Нерабочие праздничные дни РФ на год (производственный календарь,
  // источник — isdayoff.ru с fallback-списком в коде)
  holidays: publicQuery
    .input(z.object({ year: z.number().int().min(2024).max(2100) }))
    .query(({ input }) => getYearHolidayDates(input.year)),

  // Запись на мероприятие (если админ открыл запись)
  registerEvent: publicQuery
    .input(
      z.object({
        eventId: z.number().int(),
        name: z.string().min(2, "Укажите имя").max(120),
        phone: z.string().regex(phoneRegex, "Укажите корректный телефон"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      rateLimitOrThrow(`event-reg:ip:${clientIp(ctx.req)}`, 10, 10 * 60 * 1000);
      const db = getDb();
      const ev = (
        await db
          .select()
          .from(events)
          .where(
            and(
              eq(events.id, input.eventId),
              eq(events.isPublished, true),
              eq(events.registrationOpen, true),
              gte(events.date, todayStr()),
            ),
          )
          .limit(1)
      )[0];
      if (!ev) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Запись на это мероприятие закрыта",
        });
      }
      const phone = normalizePhone(input.phone) ?? input.phone;
      const [result] = await db.insert(eventRegistrations).values({
        eventId: ev.id,
        name: input.name,
        phone,
        status: "new",
      });
      const id = Number((result as { insertId?: number }).insertId ?? 0);
      const summary = eventSummaryLine(ev);
      void notifyAdminEventRegistration({ id, summary, source: "сайт" });
      return { id, summary };
    }),
});
