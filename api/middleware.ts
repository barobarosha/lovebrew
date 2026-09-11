import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Ошибки валидации показываем пользователю первым понятным сообщением,
    // а не сырым JSON с описанием всех issues
    let message = shape.message;
    if (error.cause instanceof ZodError) {
      message =
        error.cause.issues[0]?.message ?? "Проверьте введённые данные";
    }
    return { ...shape, message };
  },
});

export const createRouter = t.router;
export const publicQuery = t.procedure;
