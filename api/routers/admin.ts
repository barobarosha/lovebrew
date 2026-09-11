import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { bookings, customers, events, loftSlots, menuItems } from "@db/schema";
import {
  assertAdmin,
  changeAdminPassword,
  createAdminSession,
  destroyAdminSession,
  verifyAdminPassword,
} from "../services/adminAuth";
import {
  getAllSettings,
  setSetting,
  DEFAULT_SETTINGS,
} from "../services/settings";
import { getMonthCalendar, slotsForDate } from "../services/availability";
import { clientIp, rateLimitOrThrow } from "../lib/rateLimit";

const tokenInput = { token: z.string().min(10, "Недействительная сессия") };

export const adminRouter = createRouter({
  login: publicQuery
    .input(z.object({ password: z.string().min(1, "Введите пароль") }))
    .mutation(async ({ input, ctx }) => {
      rateLimitOrThrow(`admin-login:${clientIp(ctx.req)}`, 10, 10 * 60 * 1000);
      const ok = await verifyAdminPassword(input.password);
      if (!ok) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Неверный пароль",
        });
      }
      const token = await createAdminSession();
      return { token };
    }),

  logout: publicQuery
    .input(z.object(tokenInput))
    .mutation(async ({ input }) => {
      await destroyAdminSession(input.token);
      return { ok: true };
    }),

  check: publicQuery
    .input(z.object(tokenInput))
    .query(async ({ input }) => {
      await assertAdmin(input.token);
      return { ok: true };
    }),

  changePassword: publicQuery
    .input(
      z.object({
        ...tokenInput,
        newPassword: z.string().min(6, "Пароль — минимум 6 символов").max(100),
      }),
    )
    .mutation(async ({ input }) => {
      await assertAdmin(input.token);
      await changeAdminPassword(input.newPassword);
      return { ok: true };
    }),

  // ---------- Bookings ----------
  bookings: publicQuery
    .input(
      z.object({
        ...tokenInput,
        status: z.enum(["new", "confirmed", "rejected"]).optional(),
      }),
    )
    .query(async ({ input }) => {
      await assertAdmin(input.token);
      const db = getDb();
      const base = db.select().from(bookings);
      const rows = input.status
        ? await base
            .where(eq(bookings.status, input.status))
            .orderBy(desc(bookings.createdAt))
        : await base.orderBy(desc(bookings.createdAt));
      return rows;
    }),

  setBookingStatus: publicQuery
    .input(
      z.object({
        ...tokenInput,
        id: z.number().int(),
        status: z.enum(["new", "confirmed", "rejected"]),
        adminNote: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await assertAdmin(input.token);
      await getDb()
        .update(bookings)
        .set({ status: input.status, adminNote: input.adminNote ?? null })
        .where(eq(bookings.id, input.id));
      return { ok: true };
    }),

  createBooking: publicQuery
    .input(
      z.object({
        ...tokenInput,
        type: z.enum(["loft", "coworking", "kids"]),
        name: z.string().min(1).max(120),
        phone: z.string().max(40).default(""),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        slot: z.enum(["day", "evening", "fullday"]).optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        hours: z.number().int().min(1).max(24).optional(),
        guests: z.number().int().min(1).max(100).optional(),
        comment: z.string().max(1000).optional(),
        status: z.enum(["new", "confirmed"]).default("confirmed"),
      }),
    )
    .mutation(async ({ input }) => {
      await assertAdmin(input.token);
      const db = getDb();
      const [result] = await db.insert(bookings).values({
        type: input.type,
        name: input.name,
        phone: input.phone,
        date: input.date,
        slot: input.type === "loft" ? (input.slot ?? "fullday") : null,
        startTime: input.startTime ?? null,
        hours: input.hours ?? null,
        guests: input.guests ?? null,
        comment: input.comment ?? null,
        status: input.status,
      });
      return { id: Number((result as { insertId?: number }).insertId ?? 0) };
    }),

  deleteBooking: publicQuery
    .input(z.object({ ...tokenInput, id: z.number().int() }))
    .mutation(async ({ input }) => {
      await assertAdmin(input.token);
      await getDb().delete(bookings).where(eq(bookings.id, input.id));
      return { ok: true };
    }),

  // ---------- Loft slots ----------
  slotsCalendar: publicQuery
    .input(
      z.object({ ...tokenInput, month: z.string().regex(/^\d{4}-\d{2}$/) }),
    )
    .query(async ({ input }) => {
      await assertAdmin(input.token);
      return getMonthCalendar(input.month);
    }),

  setSlot: publicQuery
    .input(
      z.object({
        ...tokenInput,
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        slot: z.enum(["day", "evening", "fullday"]),
        status: z.enum(["available", "blocked"]),
        note: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await assertAdmin(input.token);
      if (!slotsForDate(input.date).includes(input.slot)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Такого слота нет в этот день",
        });
      }
      const db = getDb();
      const existing = await db
        .select()
        .from(loftSlots)
        .where(and(eq(loftSlots.date, input.date), eq(loftSlots.slot, input.slot)))
        .limit(1);
      if (input.status === "available") {
        if (existing.length) {
          await db.delete(loftSlots).where(eq(loftSlots.id, existing[0].id));
        }
      } else if (existing.length) {
        await db
          .update(loftSlots)
          .set({ status: "blocked", note: input.note ?? null })
          .where(eq(loftSlots.id, existing[0].id));
      } else {
        await db.insert(loftSlots).values({
          date: input.date,
          slot: input.slot,
          status: "blocked",
          note: input.note ?? null,
        });
      }
      return { ok: true };
    }),

  // ---------- Events ----------
  events: publicQuery
    .input(z.object(tokenInput))
    .query(async ({ input }) => {
      await assertAdmin(input.token);
      return getDb().select().from(events).orderBy(asc(events.date));
    }),

  saveEvent: publicQuery
    .input(
      z.object({
        ...tokenInput,
        id: z.number().int().optional(),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        price: z.string().max(60).optional(),
        imageUrl: z.string().max(500).optional(),
        isPublished: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      await assertAdmin(input.token);
      const db = getDb();
      const data = {
        title: input.title,
        description: input.description ?? null,
        date: input.date,
        time: input.time ?? null,
        price: input.price ?? null,
        imageUrl: input.imageUrl ?? null,
        isPublished: input.isPublished,
      };
      if (input.id) {
        await db.update(events).set(data).where(eq(events.id, input.id));
        return { id: input.id };
      }
      const [result] = await db.insert(events).values(data);
      return { id: Number((result as { insertId?: number }).insertId ?? 0) };
    }),

  deleteEvent: publicQuery
    .input(z.object({ ...tokenInput, id: z.number().int() }))
    .mutation(async ({ input }) => {
      await assertAdmin(input.token);
      await getDb().delete(events).where(eq(events.id, input.id));
      return { ok: true };
    }),

  // ---------- Menu ----------
  menu: publicQuery
    .input(z.object(tokenInput))
    .query(async ({ input }) => {
      await assertAdmin(input.token);
      return getDb()
        .select()
        .from(menuItems)
        .orderBy(asc(menuItems.sortOrder), asc(menuItems.id));
    }),

  saveMenuItem: publicQuery
    .input(
      z.object({
        ...tokenInput,
        id: z.number().int().optional(),
        category: z.string().min(1).max(80),
        name: z.string().min(1).max(160),
        description: z.string().max(300).optional(),
        volume: z.string().max(30).optional(),
        price: z.number().int().min(0),
        imageUrl: z.string().max(500).optional(),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      await assertAdmin(input.token);
      const db = getDb();
      const data = {
        category: input.category,
        name: input.name,
        description: input.description ?? null,
        volume: input.volume ?? null,
        price: input.price,
        imageUrl: input.imageUrl ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      };
      if (input.id) {
        await db.update(menuItems).set(data).where(eq(menuItems.id, input.id));
        return { id: input.id };
      }
      const [result] = await db.insert(menuItems).values(data);
      return { id: Number((result as { insertId?: number }).insertId ?? 0) };
    }),

  deleteMenuItem: publicQuery
    .input(z.object({ ...tokenInput, id: z.number().int() }))
    .mutation(async ({ input }) => {
      await assertAdmin(input.token);
      await getDb().delete(menuItems).where(eq(menuItems.id, input.id));
      return { ok: true };
    }),

  importMenu: publicQuery
    .input(
      z.object({
        ...tokenInput,
        mode: z.enum(["append", "replace"]).default("append"),
        items: z
          .array(
            z.object({
              category: z.string().min(1).max(80),
              name: z.string().min(1).max(160),
              description: z.string().max(300).optional(),
              volume: z.string().max(30).optional(),
              price: z.number().int().min(0),
            }),
          )
          .min(1)
          .max(500),
      }),
    )
    .mutation(async ({ input }) => {
      await assertAdmin(input.token);
      const db = getDb();
      if (input.mode === "replace") {
        await db.delete(menuItems);
      }
      await db.insert(menuItems).values(
        input.items.map((it, i) => ({
          category: it.category,
          name: it.name,
          description: it.description ?? null,
          volume: it.volume ?? null,
          price: it.price,
          sortOrder: i,
          isActive: true,
        })),
      );
      return { count: input.items.length };
    }),

  // ---------- Settings ----------
  settings: publicQuery
    .input(z.object(tokenInput))
    .query(async ({ input }) => {
      await assertAdmin(input.token);
      const all = await getAllSettings();
      const { admin_password_hash: _omit, ...rest } = all;
      return rest;
    }),

  updateSettings: publicQuery
    .input(
      z.object({
        ...tokenInput,
        values: z.record(z.string(), z.string().max(2000)),
      }),
    )
    .mutation(async ({ input }) => {
      await assertAdmin(input.token);
      const allowed = Object.keys(DEFAULT_SETTINGS).filter(
        (k) => k !== "admin_password_hash",
      );
      for (const [k, v] of Object.entries(input.values)) {
        if (allowed.includes(k)) await setSetting(k, v);
      }
      return { ok: true };
    }),

  testTelegram: publicQuery
    .input(z.object(tokenInput))
    .mutation(async ({ input }) => {
      await assertAdmin(input.token);
      const { notifyAdminNewBooking } = await import("../services/telegram");
      const r = await notifyAdminNewBooking({
        type: "loft",
        name: "Тестовое уведомление",
        phone: "+7 (000) 000-00-00",
        date: "2026-01-01",
        comment: "Проверка связи с Telegram-ботом",
      });
      if (!r.sent) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            r.reason === "not_configured"
              ? "Укажите токен бота и chat_id"
              : "Не удалось отправить. Проверьте токен и chat_id",
        });
      }
      return { ok: true };
    }),

  // ---------- PWA: клиенты, аналитика, QuickResto ----------
  customers: publicQuery
    .input(z.object(tokenInput))
    .query(async ({ input }) => {
      await assertAdmin(input.token);
      return getDb()
        .select()
        .from(customers)
        .orderBy(desc(customers.createdAt))
        .limit(300);
    }),

  appStats: publicQuery
    .input(z.object(tokenInput))
    .query(async ({ input }) => {
      await assertAdmin(input.token);
      const { getAppStats } = await import("../services/analytics");
      return getAppStats();
    }),

  testQuickResto: publicQuery
    .input(z.object(tokenInput))
    .mutation(async ({ input }) => {
      await assertAdmin(input.token);
      const { getRestoProvider, resetRestoProviderCache } = await import(
        "../quickresto/provider"
      );
      resetRestoProviderCache();
      const provider = await getRestoProvider();
      if (!provider) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Интеграция не настроена: включите qr_enabled и заполните слой, логин и пароль",
        });
      }
      const r = await provider.ping();
      if (!r.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: r.detail });
      }
      return { ok: true, mode: provider.mode, detail: r.detail };
    }),

  // Статус безопасности для баннера в админке
  securityStatus: publicQuery
    .input(z.object(tokenInput))
    .query(async ({ input }) => {
      await assertAdmin(input.token);
      const all = await getAllSettings();
      return {
        // Пароль ни разу не меняли — действует пароль по умолчанию
        defaultPassword: !all.admin_password_hash,
        // Пилотный вход: код подтверждения показывается в приложении
        otpDebugMode: all.otp_debug_mode !== "0",
      };
    }),
});
