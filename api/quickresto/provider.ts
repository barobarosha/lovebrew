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

/**
 * Имя, пришедшее из Quick Resto, считаем валидным, только если в нём
 * минимум 2 символа и все они — буквы (кириллица/латиница), пробел,
 * дефис или апостроф. Защита от боевого бага: кривой ответ API
 * клал в customers.name один эмодзи вместо имени.
 */
export function isValidQrName(v: string | undefined | null): v is string {
  if (!v) return false;
  const t = v.trim();
  if (t.length < 2) return false;
  return /^[A-Za-zА-Яа-яЁё\s\-']+$/.test(t);
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

/** Глубокий поиск массива contactMethods в объекте клиента */
function findContactMethods(v: unknown, depth = 0): Json[] {
  if (depth > 3 || v == null || typeof v !== "object") return [];
  if (Array.isArray(v)) return [];
  const obj = v as Json;
  const direct = obj["contactMethods"];
  if (Array.isArray(direct)) return asArray(direct);
  for (const val of Object.values(obj)) {
    const found = findContactMethods(val, depth + 1);
    if (found.length) return found;
  }
  return [];
}

/** Способы связи по умолчанию — телефон клиента.
 *  Формат поля contactMethods: { type: "phoneNumber", value } —
 *  НЕ token-схема { type, entry, key } (она только для customerToken
 *  в balance/operationHistory). */
function defaultContactMethods(phone: string): Json[] {
  return [{ type: "phoneNumber", value: phone }];
}

/**
 * Номер, заведённый на кассе вручную без кода страны (9XXXXXXXXX,
 * 10 цифр) → полный формат 79XXXXXXXXX. null — номер уже нормальный
 * или не похож на российский мобильный (трогать не надо).
 */
function normalizeLegacyPhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("9")) return `7${digits}`;
  return null;
}

/** Телефон из массива contactMethods (первая запись phoneNumber). */
function phoneFromContactMethods(methods: Json[]): string | undefined {
  for (const m of methods) {
    if (m && typeof m === "object" && !Array.isArray(m)) {
      const v = (m as Json)["value"];
      if (typeof v === "string" && v.replace(/\D/g, "").length >= 10) return v;
    }
  }
  return undefined;
}

/**
 * Тип бонусной операции QR → "credit" (начисление) / "debit" (списание).
 * QR отдаёт разные значения ("accrual", "writeOff", числовые коды и т.п.) —
 * поэтому матчим широко; неизвестный тип определяем по знаку суммы и
 * пишем сырой тип в лог, чтобы дополнить список по факту.
 */
function normalizeOperationType(
  rawType: string | undefined,
  amount: number,
): "credit" | "debit" {
  const t = (rawType ?? "").toLowerCase();
  if (/(credit|accrual|charge|deposit|earn|add|начис)/.test(t)) return "credit";
  if (/(debit|write.?off|withdraw|spend|redeem|спис)/.test(t)) return "debit";
  if (t) {
    console.warn(
      `[quickresto] неизвестный тип бонусной операции: ${JSON.stringify(rawType)}, сумма ${amount} — определён по знаку`,
    );
  }
  return amount >= 0 ? "credit" : "debit";
}

/** customerGuid для putCustomer в формате Quick Resto:
 *  customer_put-yyMMddHHmmssSSS (15 цифр) + 1 случайный символ [0-9A-Z].
 *  В свободном формате (app-…) putCustomer падает с HTTP 500 на их стороне. */
function newCustomerGuid(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const stamp =
    p(d.getFullYear() % 100) +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    p(d.getHours()) +
    p(d.getMinutes()) +
    p(d.getSeconds()) +
    p(d.getMilliseconds(), 3);
  const rnd = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[
    Math.floor(Math.random() * 36)
  ];
  return `customer_put-${stamp}${rnd}`;
}

/* ------------------------------------------------------------------ */
/* BackOfficeProvider — реализация на бесплатном Back Office API       */
/* ------------------------------------------------------------------ */

export class BackOfficeProvider implements RestoProvider {
  readonly mode = "backoffice";
  private accountGuidCache: string | null = null;
  private readonly client: BackOfficeClient;
  private readonly configuredAccountGuid: string;
  private readonly configuredSalePlace: string;

  constructor(
    client: BackOfficeClient,
    configuredAccountGuid: string,
    configuredSalePlace = "",
  ) {
    this.client = client;
    this.configuredAccountGuid = configuredAccountGuid;
    this.configuredSalePlace = configuredSalePlace;
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

  /** Полная карточка клиента из бонусной подсистемы по GUID */
  private async getCustomerByGuid(guid: string): Promise<Json | null> {
    const res = await this.client.bonuses("getCustomer", { customerGuid: guid });
    if (res && typeof res === "object" && !Array.isArray(res)) {
      return res as Json;
    }
    return firstArrayDeep(res)[0] ?? null;
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
    const guid = extractGuid(found)!;
    // Имя из QR берём только валидное (не мусор из одного эмодзи и т.п.)
    const rawName = pickString(found, "firstName", "name");
    let crmPhone =
      pickString(found, "phone", "phoneNumber") ??
      phoneFromContactMethods(findContactMethods(found));
    // Гость заведён на кассе вручную с номером без кода страны
    // (9XXXXXXXXX, 10 цифр)? Планшет ищет по полному номеру и такого
    // клиента не находит — нормализуем карточку в CRM до 79XXXXXXXXX.
    const normalized = normalizeLegacyPhone(crmPhone);
    if (normalized) {
      await this.normalizeCustomerPhone(guid, normalized).catch((e) =>
        console.error(
          "[quickresto] не удалось нормализовать телефон клиента:",
          (e as Error).message,
        ),
      );
      crmPhone = normalized;
    }
    return {
      guid,
      firstName: isValidQrName(rawName) ? rawName.trim() : undefined,
      phone: crmPhone ?? phone,
    };
  }

  /**
   * Нормализация телефона в карточке CRM (10 цифр → 79XXXXXXXXX).
   * Только putCustomer с полным набором полей (customerGuid, version,
   * firstName, contactMethods) — /api/update обнуляет непереданные поля.
   */
  private async normalizeCustomerPhone(
    guid: string,
    normalizedPhone: string,
  ): Promise<void> {
    const full = await this.getCustomerByGuid(guid);
    if (!full) return;
    const version = pickNumberDeep(full, ["version"]) ?? 0;
    const existing = findContactMethods(full);
    const contactMethods = existing.length
      ? existing.map((cm) => {
          if (!cm || typeof cm !== "object" || Array.isArray(cm)) return cm;
          const obj = cm as Json;
          const value = typeof obj["value"] === "string" ? obj["value"] : "";
          const fixed = normalizeLegacyPhone(value);
          return fixed ? { ...obj, value: fixed } : cm;
        })
      : defaultContactMethods(normalizedPhone);
    const rawName = pickString(full, "firstName", "name");
    await this.client.bonuses("putCustomer", {
      customerGuid: guid,
      version,
      firstName: isValidQrName(rawName) ? rawName.trim() : "Гость",
      contactMethods,
    });
  }

  async createCustomer(input: {
    phone: string;
    name: string;
  }): Promise<RestoCustomerRef | null> {
    // Сначала ищем — вдруг клиент уже есть в CRM (покупал на кассе)
    const existing = await this.findCustomerByPhone(input.phone).catch(() => null);
    if (existing) return existing;
    // Создание клиента — только /bonuses/putCustomer с полным набором полей.
    // /api/create /api/update crm.customer не используем: они обнуляют
    // непереданные поля (на проде так стёрся телефон живого клиента).
    // createTerminalSalePlaceDocId — колонка «Место создания» в CRM
    // (настройка qr_sale_place, напр. sale_place-250523065903399y).
    const payload: Record<string, unknown> = {
      customerGuid: newCustomerGuid(),
      version: 0,
      // Имя по умолчанию — «Гость»; своё имя из приложения передаём
      // только если оно валидное (защита от мусорных строк)
      firstName: isValidQrName(input.name) ? input.name.trim() : "Гость",
      contactMethods: defaultContactMethods(input.phone),
    };
    if (this.configuredSalePlace) {
      payload.createTerminalSalePlaceDocId = this.configuredSalePlace;
    }
    const created = await this.client.bonuses("putCustomer", payload);
    const items = firstArrayDeep(created);
    const obj = items[0] ?? (created as Json);
    const guid =
      (obj && typeof obj === "object" ? extractGuid(obj as Json) : undefined) ??
      (payload.customerGuid as string);
    return {
      guid,
      firstName: isValidQrName(input.name) ? input.name.trim() : "Гость",
      phone: input.phone,
    };
  }

  async updateCustomerName(
    phone: string,
    name: string,
  ): Promise<boolean> {
    const found = await this.findCustomerByPhone(phone).catch(() => null);
    if (!found) return false; // клиент ещё не привязан к CRM — нечего обновлять
    // putCustomer работает как частичное обновление по customerGuid, но
    // телефон/контакты передаём всегда — на всякий случай против затирания.
    const full = await this.getCustomerByGuid(found.guid).catch(() => null);
    const version =
      (full ? pickNumberDeep(full, ["version"]) : null) ??
      (full && typeof full["version"] === "number"
        ? (full["version"] as number)
        : 0) ??
      0;
    const contactMethods = full
      ? findContactMethods(full)
      : [];
    await this.client.bonuses("putCustomer", {
      customerGuid: found.guid,
      version,
      firstName: name,
      contactMethods: contactMethods.length
        ? contactMethods
        : defaultContactMethods(phone),
    });
    return true;
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
        .map((op) => {
          const rawAmount =
            pickNumberDeep(op, ["amount", "sum", "value", "bonuses"]) ?? 0;
          const rawType = pickString(op, "type", "operationType", "kind");
          const type = normalizeOperationType(rawType, rawAmount);
          // QR может отдавать сумму списания положительной — знак выставляем
          // по типу: начисление всегда с плюсом, списание с минусом.
          const amount = type === "debit" ? -Math.abs(rawAmount) : Math.abs(rawAmount);
          return {
            date:
              pickString(op, "date", "operationDate", "created", "createdAt") ?? "",
            type,
            amount,
            comment: pickString(op, "comment", "description", "orderNumber"),
          };
        })
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
      // Цена блюда в BO API лежит в dishPrices (привязка к контексту
      // цен/прайсу); корневых полей price/salePrice обычно нет — отсюда
      // прочерк в приложении. pickNumberDeep пройдёт и по вложенным массивам.
      const price = pickNumberDeep(d, [
        "price",
        "salePrice",
        "cost",
        "priceValue",
        "value",
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
  const key = [
    s.qr_layer,
    s.qr_login,
    s.qr_password,
    s.qr_account_guid,
    s.qr_sale_place,
  ].join("|");
  if (cache?.key === key) return cache.provider;
  const client = new BackOfficeClient(
    `https://${s.qr_layer}.quickresto.ru/platform/online`,
    s.qr_login,
    s.qr_password,
  );
  const provider = new BackOfficeProvider(
    client,
    s.qr_account_guid ?? "",
    s.qr_sale_place ?? "",
  );
  cache = { key, provider };
  return provider;
}

export function resetRestoProviderCache() {
  cache = null;
}
