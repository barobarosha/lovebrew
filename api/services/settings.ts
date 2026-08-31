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
  price_loft_weekday: "3000",
  price_loft_weekend: "3500",
  price_cleaning: "1500",
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
};

export const PUBLIC_SETTING_KEYS = [
  "phone",
  "email",
  "address",
  "hours_weekday",
  "hours_weekend",
  "telegram_link",
  "price_loft_weekday",
  "price_loft_weekend",
  "price_cleaning",
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
