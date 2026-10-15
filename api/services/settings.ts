import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { settings } from "@db/schema";

export const DEFAULT_SETTINGS: Record<string, string> = {
  phone: "+7 (933) 913-18-18",
  email: "love-brew@mail.ru",
  address: "Красногорский бульвар, 23к2, ЖК «Спасский мост», Красногорск",
  hours_weekday: "8:00 – 21:00",
  hours_weekend: "9:00 – 21:00",
  telegram_link: "https://t.me/love_brew",
  // Username чата менеджера (без @) — клиент попадает туда после заявки
  telegram_manager: "barobarosha",
  // Лофт сдаётся только в выходные/праздники — единая цена
  price_loft_weekend: "3500",
  price_cleaning: "1500",
  price_decor_hour: "1500", // декораторский час — опция к аренде лофта
  price_kids_hour: "300",
  price_kids_unlimited: "1000",
  price_coworking_hour: "300",
  price_coworking_day: "900",
  coworking_capacity: "8",
  promo_text:
    "В день аренды скидка 20% на напитки в кофейне по промокоду ЛЮБЛЮЛАВБРЮ",
  offer_3plus1: "При бронировании лофта от 3-х часов — 4-й час в подарок!",
  telegram_bot_token: "",
  telegram_chat_id: "",
  admin_password_hash: "",
  // QuickResto integration (Back Office API now, WL API later — same provider interface)
  qr_enabled: "0",
  qr_layer: "", // имя облака, напр. "lavbrew" → https://lavbrew.quickresto.ru/platform/online
  qr_login: "",
  qr_password: "",
  qr_account_guid: "", // GUID типа бонусного счёта (можно оставить пустым — возьмём первый)
  // «Место создания» клиента в CRM (колонка в CRM → Клиенты).
  // Значение — docId места реализации вида sale_place-250523065903399y.
  // Пусто — поле не передаём. НЕ публичная настройка.
  qr_sale_place: "",
  // Пилот: "1" — код входа показывается в приложении (SMS-шлюз не подключён).
  // После подключения SMS обязательно поставить "0".
  otp_debug_mode: "1",
  // Мобильная авторизация SMS Aero — только сервер, на клиент не отдавать!
  // НЕ добавлять в PUBLIC_SETTING_KEYS — секреты только для сервера.
  // Пустые e-mail/ключ = пилотный режим (код на экране)
  sms_aero_email: "",
  sms_aero_api_key: "",
  // Имя отправителя. Пусто = «SMS Aero» (подходит для тестового API-ключа)
  sms_aero_sign: "",
  // Порядок категорий меню у клиента (сайт + PWA): JSON-массив названий,
  // напр. ["Кофе","Десерты"]. Правится в админке → Меню → «Категории».
  // НЕ публичная настройка — порядок применяется сервером при отдаче меню.
  menu_category_order: "[]",
};

export const PUBLIC_SETTING_KEYS = [
  "phone",
  "email",
  "address",
  "hours_weekday",
  "hours_weekend",
  "telegram_link",
  "telegram_manager",
  "price_loft_weekend",
  "price_cleaning",
  "price_decor_hour",
  "price_kids_hour",
  "price_kids_unlimited",
  "price_coworking_hour",
  "price_coworking_day",
  "promo_text",
  "offer_3plus1",
];

export const DEFAULT_ADMIN_PASSWORD = "lavbrew2026";

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await getDb().select().from(settings);
  const map: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function getPublicSettings(): Promise<Record<string, string>> {
  const all = await getAllSettings();
  const out: Record<string, string> = {};
  for (const k of PUBLIC_SETTING_KEYS) out[k] = all[k];
  return out;
}

/** Порядок категорий меню из настройки menu_category_order (JSON-массив). */
export async function getMenuCategoryOrder(): Promise<string[]> {
  const all = await getAllSettings();
  try {
    const arr: unknown = JSON.parse(all.menu_category_order ?? "[]");
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string" && !!x.trim());
  } catch {
    return [];
  }
}

export async function setMenuCategoryOrder(order: string[]) {
  await setSetting("menu_category_order", JSON.stringify(order));
}

/**
 * Сортировка позиций меню по порядку категорий (стабильная: внутри
 * категории сохраняется sortOrder/id). Категории вне списка — в конце,
 * в исходном порядке появления.
 */
export function sortByCategoryOrder<T extends { category: string }>(
  rows: T[],
  order: string[],
): T[] {
  const rank = new Map(order.map((c, i) => [c, i]));
  return [...rows].sort(
    (a, b) => (rank.get(a.category) ?? order.length) - (rank.get(b.category) ?? order.length),
  );
}

export async function setSetting(key: string, value: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  if (existing.length) {
    await db
      .update(settings)
      .set({ value })
      .where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value });
  }
}
