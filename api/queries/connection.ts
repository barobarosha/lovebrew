import { drizzle } from "drizzle-orm/mysql2";
import { TRPCError } from "@trpc/server";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    instance = drizzle(env.databaseUrl, {
      mode: "planetscale",
      schema: fullSchema,
    });
  }
  return instance;
}

/**
 * Дружелюбное сообщение об ошибке БД для клиента (сырой текст вида
 * "Failed query: insert into `menu_items`…" с сотнями килобайт data-URI
 * не отдаём). Сырой текст остаётся в серверном логе (console.error).
 */
export function friendlyDbError(e: unknown): never {
  const msg = String((e as Error)?.message ?? e);
  console.error("[db]", msg.slice(0, 2000));
  const lc = msg.toLowerCase();
  if (lc.includes("too long") || lc.includes("max_allowed_packet")) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Данные слишком большие — выберите файл поменьше",
    });
  }
  if (lc.includes("duplicate") || lc.includes("unique")) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Такая запись уже существует",
    });
  }
  if (lc.includes("connect") || lc.includes("econnrefused") || lc.includes("etimedout")) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Нет связи с базой данных — попробуйте ещё раз",
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Не удалось сохранить данные. Попробуйте ещё раз",
  });
}
