import { getAllSettings } from "./settings";
import { QR_MODULES } from "../quickresto/client";

/**
 * Синхронизация имени клиента в Quick Resto.
 *
 * Отдельный сервис, а не метод BackOfficeClient: папку api/quickresto/
 * (интеграцию) менять нельзя, а у клиента там нет метода /api/update.
 * Поэтому запрос идёт напрямую по той же схеме (Basic auth, layer из настроек).
 *
 * Вызывается только в фоне (void ...) — ошибки пишутся в лог и никогда
 * не блокируют смену имени в приложении.
 */

const REQUEST_TIMEOUT_MS = 9000;

type Json = Record<string, unknown>;

function collectObjects(v: unknown, depth = 0): Json[] {
  if (depth > 3 || v == null) return [];
  if (Array.isArray(v)) {
    return v.filter((x) => x && typeof x === "object") as Json[];
  }
  if (typeof v === "object") {
    for (const key of ["items", "data", "customers", "list", "results", "objects"]) {
      const inner = (v as Json)[key];
      if (Array.isArray(inner) && inner.length) {
        return inner.filter((x) => x && typeof x === "object") as Json[];
      }
    }
  }
  return [];
}

function extractGuid(obj: Json): string | undefined {
  for (const k of ["customerGuid", "guid", "id", "customerId"]) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

export async function syncCustomerNameToQuickResto(
  phone: string,
  name: string,
): Promise<void> {
  try {
    const s = await getAllSettings();
    if (s.qr_enabled !== "1" || !s.qr_layer || !s.qr_login || !s.qr_password) {
      return;
    }
    const baseUrl = `https://${s.qr_layer}.quickresto.ru/platform/online`;
    const auth =
      "Basic " +
      Buffer.from(`${s.qr_login}:${s.qr_password}`).toString("base64");

    async function req(
      method: "GET" | "POST",
      path: string,
      body?: unknown,
    ): Promise<unknown> {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
          Connection: "keep-alive",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Quick Resto ${res.status}: ${text.slice(0, 200)}`);
      }
      return text ? JSON.parse(text) : null;
    }

    // 1. Ищем GUID клиента по телефону через бонусную подсистему
    const found = await req("POST", "/bonuses/filterCustomers", {
      search: phone,
      typeList: ["customer"],
      limit: 5,
      offset: 0,
    });
    const guid = collectObjects(found).map(extractGuid).find(Boolean);
    if (!guid) return; // клиент ещё не привязан к CRM — нечего обновлять

    // 2. Забираем полный объект клиента (/api/update требует объект целиком)
    const listParams = new URLSearchParams({
      moduleName: QR_MODULES.customer.moduleName,
      className: QR_MODULES.customer.className,
      filters: JSON.stringify([{ field: "id", operation: "eq", value: guid }]),
    });
    const full = await req("GET", `/api/list?${listParams.toString()}`);
    const customer =
      collectObjects(full)[0] ??
      (full && typeof full === "object" && !Array.isArray(full)
        ? (full as Json)
        : null);
    if (!customer) return;

    // 3. Обновляем имя
    const updParams = new URLSearchParams({
      moduleName: QR_MODULES.customer.moduleName,
      className: QR_MODULES.customer.className,
    });
    await req("POST", `/api/update?${updParams.toString()}`, {
      ...customer,
      firstName: name,
    });
  } catch (e) {
    console.error("[quickresto] sync name failed:", (e as Error).message);
  }
}
