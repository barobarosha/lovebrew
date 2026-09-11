import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { bookings } from "@db/schema";
import {
  checkCoworkingAvailability,
  checkLoftAvailability,
} from "../services/availability";
import { notifyAdminNewBooking } from "../services/telegram";
import { clientIp, rateLimitOrThrow } from "../lib/rateLimit";

const phoneRegex = /^[+\d][\d\s()\-]{6,20}$/;

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
        slot: z.enum(["day", "evening", "fullday"]).optional(),
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
      if (input.type === "loft") {
        const slot = input.slot ?? "fullday";
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
        status: "new",
      });

      // Fire-and-forget notification to admin
      void notifyAdminNewBooking({
        type: input.type,
        name: input.name,
        phone: input.phone,
        date: input.date,
        slot: input.slot,
        startTime: input.startTime,
        hours: input.hours,
        guests: input.guests,
        comment: input.comment,
      });

      return { id: Number((result as { insertId?: number }).insertId ?? 0) };
    }),
});
