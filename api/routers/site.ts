import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { events, menuItems } from "@db/schema";
import { getPublicSettings } from "../services/settings";
import { getMonthCalendar } from "../services/availability";

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
});
