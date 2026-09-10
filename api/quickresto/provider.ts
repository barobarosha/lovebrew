import { getAllSettings } from "../services/settings";
import { BackOfficeClient, QR_MODULES, QuickRestoError } from "./client";
import type {
  RestoBonusBalance,
  RestoBonusOperation,
  RestoCustomerRef,
  RestoMenuItem,
  RestoProvider,
} from "./types";

/* ------------------------------------------------------------------ */
/* Толерантные хелперы извлечения полей из ответов Back Office API.    */
/* Схемы ответов QR громоздкие и могут отличаться между версиями,      */
/* поэтому ищем данные по нескольким возможным путям.                  */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

function asArray(v: unknown): Json[] {
  if (Array.isArray(v)) return v.filter((x) => x && typeof x === "object") as Json[];
  return [];
}

function firstArrayDeep(v: unknown, depth = 0): Json[] {
  if (depth > 3 || v == null) return [];
  if (Array.isArray(v)) return asArray(v);
  if (typeof v === "object") {
    for (const key of ["items", "data", "customers", "list", "results", "objects"]) {
      const inner = (v as Json)[key];
      if (Array.isArray(inner) && inner.length) return asArray(inner);
    }
    for (const val of Object.values(v as Json)) {
      const found = firstArrayDeep(val, depth + 1);
      if (found.length) return found;
    }
  }
  return [];
}

function pickString(obj: Json, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function pickNumberDeep(v: unknown, keys: string[], depth = 0): number | null {
  if (depth > 4 || v == null || typeof v !== "object") return null;
  if (Array.isArray(v)) {
    for (const item of v) {
      const n = pickNumberDeep(item, keys, depth + 1);
      if (n !== null) return n;
    }
    return null;
  }
  const obj = v as Json;
  for (const k of keys) {
    const val = obj[k];
    if (typeof val === "number" && Number.isFinite(val)) return val;
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object") {
      const n = pickNumberDeep(val, keys, depth + 1);
      if (n !== null) return n;
    }
  }
  return null;
}

function extractGuid(obj: Json): string | undefined {
  return pickString(obj, "customerGuid", "guid", "id", "customerId");
}

/* ------------------------------------------------------------------ */
/* BackOfficeProvider — реализация на бесплатном Back Office API       */
/* ------------------------------------------------------------------ */

export class BackOfficeProvider implements RestoProvider {
  readonly mode = "backoffice";
  private accountGuidCache: string | null = null;
  private readonly client: BackOfficeClient;
  private readonly configuredAccountGuid: string;

  constructor(client: BackOfficeClient, configuredAccountGuid: string) {
    this.client = client;
    this.configuredAccountGuid = configuredAccountGuid;
  }

  async ping() {
    try {
      await this.resolveAccountGuid();
      return { ok: true, detail: "Связь установлена, доступ к бонусным счетам есть" };
    } catch (e) {
      return {
        ok: false,
        detail: e instanceof QuickRestoError ? e.message : String(e),
      };
    }
  }

  /** GUID типа бонусного счёта: из настроек либо первый из списка */
  private async resolveAccountGuid(): Promise<string> {
    if (this.configuredAccountGuid) return this.configuredAccountGuid;
    if (this.accountGuidCache) return this.accountGuidCache;
    const res = await this.client.list(
      QR_MODULES.accountType.moduleName,
      QR_MODULES.accountType.className,
    );
    const items = firstArrayDeep(res);
    const guid = items.map((it) => extractGuid(it)).find(Boolean);
    if (!guid) {
      throw new QuickRestoError(
        "Не найден тип бонусного счёта — укажите qr_account_guid в настройках",
      );
    }
    this.accountGuidCache = guid;
    return guid;
  }

  async findCustomerByPhone(phone: string): Promise<RestoCustomerRef | null> {
    const res = await this.client.bonuses("filterCustomers", {
      search: phone,
      typeList: ["customer"],
      limit: 5,
      offset: 0,
    });
    const items = firstArrayDeep(res);
    const found = items.find((it) => extractGuid(it));
    if (!found) return null;
    return {
      guid: extractGuid(found)!,
      firstName: pickString(found, "firstName", "name"),
      phone: pickString(found, "phone", "phoneNumber") ?? phone,
    };
  }

  async createCustomer(input: {
    phone: string;
    name: string;
  }): Promise<RestoCustomerRef | null> {
    // Сначала ищем — вдруг клиент уже есть в CRM (покупал на кассе)
    const existing = await this.findCustomerByPhone(input.phone).catch(() => null);
    if (existing) return existing;
    const created = await this.client.create(
      QR_MODULES.customer.moduleName,
      QR_MODULES.customer.className,
      {
        firstName: input.name || "Гость Лавбрю",
        phone: input.phone,
        phoneNumber: input.phone,
      },
    );
    const items = firstArrayDeep(created);
    const obj = items[0] ?? (created as Json);
    const guid = obj && typeof obj === "object" ? extractGuid(obj as Json) : undefined;
    if (!guid) return null;
    return { guid, firstName: input.name, phone: input.phone };
  }

  async getBonusBalanceByPhone(phone: string): Promise<RestoBonusBalance | null> {
    const accountGuid = await this.resolveAccountGuid();
    try {
      const res = await this.client.bonuses("balance", {
        customerToken: { type: "phone", entry: "manual", key: phone },
        accountType: { accountGuid },
      });
      const balance = pickNumberDeep(res, [
        "balance",
        "rest",
        "amount",
        "available",
        "totalAvailableBonuses",
      ]);
      if (balance === null) return { accountGuid, accountName: "Бонусы", balance: 0 };
      return { accountGuid, accountName: "Бонусы", balance };
    } catch {
      // Клиент ещё не заведён в бонусной системе — считаем баланс нулевым
      return { accountGuid, accountName: "Бонусы", balance: 0 };
    }
  }

  async getBonusHistoryByPhone(phone: string): Promise<RestoBonusOperation[]> {
    const accountGuid = await this.resolveAccountGuid();
    try {
      const res = await this.client.bonuses("operationHistory", {
        customerToken: { type: "phone", entry: "manual", key: phone },
        accountType: { accountGuid },
      });
      return firstArrayDeep(res)
        .map((op) => ({
          date:
            pickString(op, "date", "operationDate", "created", "createdAt") ?? "",
          type: pickString(op, "type", "operationType", "kind") ?? "operation",
          amount:
            pickNumberDeep(op, ["amount", "sum", "value", "bonuses"]) ?? 0,
          comment: pickString(op, "comment", "description", "orderNumber"),
        }))
        .slice(0, 30);
    } catch {
      return [];
    }
  }

  async getMenu(): Promise<RestoMenuItem[]> {
    // Категории: id → имя
    const catRes = await this.client
      .list(QR_MODULES.dishCategory.moduleName, QR_MODULES.dishCategory.className)
      .catch(() => null);
    const categories = new Map<string, string>();
    for (const c of firstArrayDeep(catRes)) {
      const id = extractGuid(c);
      const name = pickString(c, "name", "title");
      if (id && name) categories.set(id, name);
    }

    const dishRes = await this.client.list(
      QR_MODULES.dish.moduleName,
      QR_MODULES.dish.className,
    );
    const dishes = firstArrayDeep(dishRes);
    const items: RestoMenuItem[] = [];
    for (const d of dishes) {
      const name = pickString(d, "name", "shortName", "title");
      if (!name) continue;
      // категория может быть вложенным объектом или id
      let categoryName = pickString(d, "categoryName", "groupName");
      const catObj = d["category"] ?? d["dishCategory"] ?? d["group"];
      if (!categoryName && catObj && typeof catObj === "object") {
        categoryName = pickString(catObj as Json, "name", "title");
        const catId = extractGuid(catObj as Json);
        if (!categoryName && catId) categoryName = categories.get(catId);
      }
      if (!categoryName && typeof catObj === "string") {
        categoryName = categories.get(catObj);
      }
      const price = pickNumberDeep(d, [
        "price",
        "salePrice",
        "cost",
        "priceValue",
      ]);
      items.push({
        id: extractGuid(d) ?? name,
        categoryName: categoryName ?? "Меню",
        name,
        description: pickString(d, "description", "comment"),
        price,
        volume: pickString(d, "volume", "weight", "portion"),
        imageUrl: pickString(d, "imageUrl", "image", "photoUrl"),
      });
    }
    return items;
  }
}

/* ------------------------------------------------------------------ */
/* Фабрика провайдера. Позже здесь появится WLProvider (платный WL API)*/
/* — выбор по настройке qr_api_mode, без изменений вызывающего кода.   */
/* ------------------------------------------------------------------ */

interface CacheEntry {
  key: string;
  provider: RestoProvider;
}
let cache: CacheEntry | null = null;

export async function getRestoProvider(): Promise<RestoProvider | null> {
  const s = await getAllSettings();
  if (s.qr_enabled !== "1" || !s.qr_layer || !s.qr_login || !s.qr_password) {
    return null;
  }
  const key = [s.qr_layer, s.qr_login, s.qr_password, s.qr_account_guid].join("|");
  if (cache?.key === key) return cache.provider;
  const client = new BackOfficeClient(
    `https://${s.qr_layer}.quickresto.ru/platform/online`,
    s.qr_login,
    s.qr_password,
  );
  const provider = new BackOfficeProvider(client, s.qr_account_guid ?? "");
  cache = { key, provider };
  return provider;
}

export function resetRestoProviderCache() {
  cache = null;
}
