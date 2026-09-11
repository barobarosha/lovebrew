import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { eventRegistrations, events, menuItems } from "@db/schema";
import { getPublicSettings } from "../services/settings";
import { getMonthCalendar } from "../services/availability";
import { notifyAdminEventRegistration } from "../services/telegram";
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
    const menu = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.isActive, true))
      .orderBy(asc(menuItems.sortOrder), asc(menuItems.id));
    return { settings, menu };
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

  // Calendar for a month: loft slots, coworking occupancy, events
  calendar: publicQuery
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(({ input }) => getMonthCalendar(input.month)),

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
      void notifyAdminEventRegistration({
        eventTitle: ev.title,
        eventDate: ev.date,
        name: input.name,
        phone,
      });
      return { id: Number((result as { insertId?: number }).insertId ?? 0) };
    }),
});
