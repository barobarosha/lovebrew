import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { bookings } from "@db/schema";
import {
  checkCoworkingAvailability,
  checkLoftAvailability,
} from "../services/availability";
import { bookingSummaryLine, notifyAdminNewBooking } from "../services/telegram";
import { clientIp, rateLimitOrThrow } from "../lib/rateLimit";
import { formatPhone, normalizePhone } from "../services/customerAuth";

const phoneRegex = /^[+\d][\d\s()\-]{6,20}$/;

/** Слот лофта — отсекаем "unlimited" (это тариф детской, не слот лофта) */
function loftSlot(
  s: "day" | "evening" | "fullday" | "unlimited" | undefined,
): "day" | "evening" | "fullday" {
  return s === "day" || s === "evening" || s === "fullday" ? s : "fullday";
}

export const bookingRouter = createRouter({
  create: publicQuery
    .input(
      z.object({
        type: z.enum(["loft", "coworking", "kids"]),
        name: z.string().min(2, "Укажите имя").max(120),
        phone: z.string().regex(phoneRegex, "Укажите корректный телефон"),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Выберите дату"),
        // slot: day/evening/fullday — лофт; unlimited — безлимитный тариф детской
        slot: z.enum(["day", "evening", "fullday", "unlimited"]).optional(),
        startTime: z
          .string()
          .regex(/^\d{2}:\d{2}$/, "Укажите время")
          .optional(),
        hours: z.number().int().min(1).max(24).optional(),
        guests: z.number().int().min(1).max(100).optional(),
        comment: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      rateLimitOrThrow(`booking:ip:${clientIp(ctx.req)}`, 10, 10 * 60 * 1000);
      if (input.type === "kids") {
        // Два тарифа: почасовой (нужны время и часы) и безлимит до 15:00
        if (input.slot !== "unlimited" && (!input.startTime || !input.hours)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Укажите время начала и длительность визита",
          });
        }
      }
      if (input.type === "loft") {
        const slot = loftSlot(input.slot);
        const check = await checkLoftAvailability(input.date, slot);
        if (!check.ok) {
          throw new TRPCError({
            code: "CONFLICT",
            message: check.reason ?? "Слот недоступен",
          });
        }
        const hours = input.hours ?? 2;
        if (hours < 2) {
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
        const seats = input.guests ?? 1;
        const check = await checkCoworkingAvailability(
          input.date,
          input.startTime,
          input.hours,
          seats,
        );
        if (!check.ok) {
          throw new TRPCError({
            code: "CONFLICT",
            message: check.reason ?? "Нет свободных мест",
          });
        }
      }

      const db = getDb();
      // Нормализуем телефон, чтобы заявка с сайта находилась в профиле приложения
      const normalized = normalizePhone(input.phone);
      const phone = normalized ? formatPhone(normalized) : input.phone;
      const kidsUnlimited = input.type === "kids" && input.slot === "unlimited";
      const [result] = await db.insert(bookings).values({
        type: input.type,
        name: input.name,
        phone,
        date: input.date,
        slot:
          input.type === "loft"
            ? loftSlot(input.slot)
            : kidsUnlimited
              ? "unlimited"
              : null,
        startTime: input.startTime ?? null,
        hours: kidsUnlimited ? null : (input.hours ?? null),
        guests: input.guests ?? null,
        comment: input.comment ?? null,
        status: "new",
      });

      const id = Number((result as { insertId?: number }).insertId ?? 0);
      // Сводка без персональных данных — для отбивки менеджеру и чата с клиентом
      const summary = bookingSummaryLine({
        type: input.type,
        date: input.date,
        slot:
          input.type === "loft"
            ? loftSlot(input.slot)
            : kidsUnlimited
              ? "unlimited"
              : null,
        startTime: input.startTime,
        hours: kidsUnlimited ? null : (input.hours ?? null),
      });

      // Fire-and-forget notification to admin
      void notifyAdminNewBooking({ id, summary, source: "сайт" });

      return { id, summary };
    }),
});
