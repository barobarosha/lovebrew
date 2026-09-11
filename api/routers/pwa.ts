import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, or, sql } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { bookings, eventRegistrations, events, menuItems } from "@db/schema";
import {
  assertCustomer,
  destroyCustomerSession,
  formatPhone,
  getCustomerByToken,
  requestOtp,
  updateCustomerName,
  verifyOtp,
} from "../services/customerAuth";
import { getPublicSettings } from "../services/settings";
import { getRestoProvider } from "../quickresto/provider";
import { trackEvent } from "../services/analytics";
import {
  checkCoworkingAvailability,
  checkLoftAvailability,
} from "../services/availability";
import { notifyAdminEventRegistration, notifyAdminNewBooking } from "../services/telegram";
import { clientIp, rateLimitOrThrow } from "../lib/rateLimit";

const optionalToken = { token: z.string().optional() };
const withToken = { token: z.string().min(10) };

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const pwaRouter = createRouter({
  // ---------- Auth (телефон + код) ----------
  requestOtp: publicQuery
    .input(z.object({ phone: z.string().min(6).max(30) }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp(ctx.req);
      rateLimitOrThrow(`otp-req:ip:${ip}`, 15, 10 * 60 * 1000);
      const phoneKey = input.phone.replace(/\D/g, "").slice(-10) || input.phone;
      rateLimitOrThrow(`otp-req:phone:${phoneKey}`, 3, 10 * 60 * 1000);
      return requestOtp(input.phone);
    }),

  verifyOtp: publicQuery
    .input(
      z.object({
        phone: z.string().min(6).max(30),
        code: z.string().min(4, "Введите 4-значный код").max(6),
        name: z.string().max(120).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      rateLimitOrThrow(`otp-verify:ip:${clientIp(ctx.req)}`, 20, 10 * 60 * 1000);
      const { token, customer } = await verifyOtp(
        input.phone,
        input.code,
        input.name,
      );
      void trackEvent("pwa_login", { customerId: customer.id });
      return {
        token,
        customer: {
          id: customer.id,
          phone: customer.phone,
          phoneFormatted: formatPhone(customer.phone),
          name: customer.name,
          role: customer.role,
        },
      };
    }),

  me: publicQuery.input(z.object(withToken)).query(async ({ input }) => {
    const customer = await assertCustomer(input.token);
    return {
      id: customer.id,
      phone: customer.phone,
      phoneFormatted: formatPhone(customer.phone),
      name: customer.name,
      role: customer.role,
      qrLinked: Boolean(customer.qrCustomerGuid),
    };
  }),

  updateName: publicQuery
    .input(z.object({ ...withToken, name: z.string().min(1).max(120) }))
    .mutation(async ({ input }) => {
      const c = await updateCustomerName(input.token, input.name);
      return { ok: true, name: c.name };
    }),

  logout: publicQuery
    .input(z.object(withToken))
    .mutation(async ({ input }) => {
      await destroyCustomerSession(input.token);
      return { ok: true };
    }),

  // ---------- Контент ----------
  home: publicQuery
    .input(z.object(optionalToken))
    .query(async ({ input }) => {
      const settings = await getPublicSettings();
      const customer = input.token
        ? await getCustomerByToken(input.token)
        : null;
      let balance: number | null = null;
      let bonusesConnected = false;
      if (customer) {
        const provider = await getRestoProvider();
        if (provider) {
          bonusesConnected = true;
          const b = await provider
            .getBonusBalanceByPhone(customer.phone)
            .catch(() => null);
          balance = b?.balance ?? 0;
        }
      }
      const db = getDb();
      const upcomingEvents = await db
        .select()
        .from(events)
        .where(and(eq(events.isPublished, true), gte(events.date, todayStr())))
        .orderBy(asc(events.date))
        .limit(3);
      return {
        settings,
        customer: customer
          ? {
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              phoneFormatted: formatPhone(customer.phone),
              role: customer.role,
            }
          : null,
        balance,
        bonusesConnected,
        upcomingEvents,
      };
    }),

  // Меню: Quick Resto (если интеграция включена), иначе — меню сайта.
  // Клиент получает единый формат вне зависимости от источника.
  menu: publicQuery.query(async () => {
    const provider = await getRestoProvider();
    if (provider) {
      try {
        const items = await provider.getMenu();
        if (items.length) {
          const byCat = new Map<string, typeof items>();
          for (const it of items) {
            const list = byCat.get(it.categoryName) ?? [];
            list.push(it);
            byCat.set(it.categoryName, list);
          }
          return {
            source: "quickresto" as const,
            categories: [...byCat.entries()].map(([name, catItems]) => ({
              name,
              items: catItems.map((i) => ({
                id: i.id,
                name: i.name,
                description: i.description ?? null,
                price: i.price,
                volume: i.volume ?? null,
                imageUrl: i.imageUrl ?? null,
              })),
            })),
          };
        }
      } catch (e) {
        console.error("[quickresto] menu failed, fallback to site menu:", (e as Error).message);
      }
    }
    const rows = await getDb()
      .select()
      .from(menuItems)
      .where(eq(menuItems.isActive, true))
      .orderBy(asc(menuItems.sortOrder), asc(menuItems.id));
    const byCat = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byCat.get(r.category) ?? [];
      list.push(r);
      byCat.set(r.category, list);
    }
    return {
      source: "site" as const,
      categories: [...byCat.entries()].map(([name, catItems]) => ({
        name,
        items: catItems.map((i) => ({
          id: String(i.id),
          name: i.name,
          description: i.description,
          price: i.price,
          volume: i.volume,
          imageUrl: i.imageUrl,
        })),
      })),
    };
  }),

  // ---------- Бонусы ----------
  bonuses: publicQuery
    .input(z.object(withToken))
    .query(async ({ input }) => {
      const customer = await assertCustomer(input.token);
      const provider = await getRestoProvider();
      if (!provider) {
        return { connected: false as const, balance: null, history: [] };
      }
      const [balance, history] = await Promise.all([
        provider.getBonusBalanceByPhone(customer.phone).catch(() => null),
        provider.getBonusHistoryByPhone(customer.phone).catch(() => []),
      ]);
      return {
        connected: true as const,
        balance: balance?.balance ?? 0,
        history,
      };
    }),

  // ---------- Афиша ----------
  events: publicQuery.query(async () => {
    const db = getDb();
    const upcoming = await db
      .select()
      .from(events)
      .where(and(eq(events.isPublished, true), gte(events.date, todayStr())))
      .orderBy(asc(events.date));
    const past = await db
      .select()
      .from(events)
      .where(and(eq(events.isPublished, true)))
      .orderBy(desc(events.date))
      .limit(50);
    return {
      upcoming,
      past: past.filter((e) => e.date < todayStr()).slice(0, 10),
    };
  }),

  // ---------- Бронирования (та же таблица, что и у сайта) ----------
  myBookings: publicQuery
    .input(z.object(withToken))
    .query(async ({ input }) => {
      const customer = await assertCustomer(input.token);
      const db = getDb();
      // Телефон в заявках мог быть записан в любом формате — сравниваем по
      // последним 10 цифрам, убрав все разделители
      const last10 = customer.phone.slice(-10);
      return db
        .select()
        .from(bookings)
        .where(
          or(
            eq(bookings.customerId, customer.id),
            sql`REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${bookings.phone}, ' ', ''), '(', ''), ')', ''), '-', ''), '+', '') LIKE ${"%" + last10}`,
          ),
        )
        .orderBy(desc(bookings.createdAt))
        .limit(20);
    }),

  createBooking: publicQuery
    .input(
      z.object({
        ...withToken,
        type: z.enum(["loft", "coworking", "kids"]),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        slot: z.enum(["day", "evening", "fullday"]).optional(),
        startTime: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
        hours: z.number().int().min(1).max(24).optional(),
        guests: z.number().int().min(1).max(100).optional(),
        comment: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      rateLimitOrThrow(`pwa-booking:ip:${clientIp(ctx.req)}`, 10, 10 * 60 * 1000);
      const customer = await assertCustomer(input.token);
      const name = customer.name || "Гость Лавбрю";
      const phone = formatPhone(customer.phone);

      if (input.type === "loft") {
        const slot = input.slot ?? "fullday";
        const check = await checkLoftAvailability(input.date, slot);
        if (!check.ok) {
          throw new TRPCError({
            code: "CONFLICT",
            message: check.reason ?? "Слот недоступен",
          });
        }
        if ((input.hours ?? 2) < 2) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Минимальная аренда — 2 часа",
          });
        }
      }
      if (input.type === "coworking") {
        if (!input.startTime || !input.hours) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Укажите время начала и длительность",
          });
        }
        const check = await checkCoworkingAvailability(
          input.date,
          input.startTime,
          input.hours,
          input.guests ?? 1,
        );
        if (!check.ok) {
          throw new TRPCError({
            code: "CONFLICT",
            message: check.reason ?? "Нет свободных мест",
          });
        }
      }

      const db = getDb();
      const [result] = await db.insert(bookings).values({
        type: input.type,
        name,
        phone,
        date: input.date,
        slot: input.type === "loft" ? (input.slot ?? "fullday") : null,
        startTime: input.startTime ?? null,
        hours: input.type === "kids" ? null : (input.hours ?? null), // детская — фиксированный вход без почасовой
        guests: input.guests ?? null,
        comment: input.comment ?? null,
        status: "new",
        customerId: customer.id,
        source: "pwa",
      });

      void notifyAdminNewBooking({
        type: input.type,
        name,
        phone,
        date: input.date,
        slot: input.slot,
        startTime: input.startTime,
        hours: input.hours,
        guests: input.guests,
        comment: input.comment
          ? `${input.comment} [из приложения]`
          : "Бронь из приложения",
      });
      void trackEvent("pwa_booking_created", {
        customerId: customer.id,
        meta: { type: input.type, date: input.date },
      });

      return { id: Number((result as { insertId?: number }).insertId ?? 0) };
    }),

  // ---------- Запись на мероприятие ----------
  registerEvent: publicQuery
    .input(z.object({ ...withToken, eventId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      rateLimitOrThrow(`pwa-event-reg:ip:${clientIp(ctx.req)}`, 10, 10 * 60 * 1000);
      const customer = await assertCustomer(input.token);
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
      // Одна активная запись на мероприятие от одного клиента
      const existing = await db
        .select()
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, ev.id),
            eq(eventRegistrations.customerId, customer.id),
            sql`${eventRegistrations.status} <> 'rejected'`,
          ),
        )
        .limit(1);
      if (existing.length) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Вы уже записаны на это мероприятие",
        });
      }
      await db.insert(eventRegistrations).values({
        eventId: ev.id,
        customerId: customer.id,
        name: customer.name || "Гость Лавбрю",
        phone: formatPhone(customer.phone),
        status: "new",
      });
      void notifyAdminEventRegistration({
        eventTitle: ev.title,
        eventDate: ev.date,
        name: customer.name || "Гость Лавбрю",
        phone: formatPhone(customer.phone),
      });
      return { ok: true };
    }),

  // Мои записи на мероприятия
  myEventRegistrations: publicQuery
    .input(z.object(withToken))
    .query(async ({ input }) => {
      const customer = await assertCustomer(input.token);
      const db = getDb();
      return db
        .select({
          id: eventRegistrations.id,
          status: eventRegistrations.status,
          createdAt: eventRegistrations.createdAt,
          eventId: events.id,
          eventTitle: events.title,
          eventDate: events.date,
          eventTime: events.time,
        })
        .from(eventRegistrations)
        .innerJoin(events, eq(eventRegistrations.eventId, events.id))
        .where(eq(eventRegistrations.customerId, customer.id))
        .orderBy(desc(eventRegistrations.createdAt))
        .limit(20);
    }),
  track: publicQuery
    .input(
      z.object({
        event: z.string().min(2).max(60),
        sessionKey: z.string().max(64).optional(),
        meta: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
        token: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      rateLimitOrThrow(`track:ip:${clientIp(ctx.req)}`, 120, 10 * 60 * 1000);
      const customer = input.token
        ? await getCustomerByToken(input.token)
        : null;
      await trackEvent(input.event, {
        customerId: customer?.id ?? null,
        sessionKey: input.sessionKey ?? null,
        meta: input.meta,
      });
      return { ok: true };
    }),
});
