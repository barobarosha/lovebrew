import { getAllSettings } from "./settings";

const SHORT_TYPE: Record<string, string> = {
  loft: "Лофт",
  coworking: "Коворкинг",
  kids: "Детская",
};

function ddmm(date: string): string {
  // "2026-09-14" → "14.09"
  const [, m, d] = date.split("-");
  return `${d}.${m}`;
}

function endTime(start: string, hours: number): string {
  const [h, m] = start.split(":").map(Number);
  const end = (h + hours) % 24;
  return `${String(end).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Короткая сводка заявки без персональных данных, напр.:
 * "14.09, 16:00–20:00 · Лофт" / "14.09, с 11:00 · Детская" /
 * "14.09, вечерний слот (с 16:00) · Лофт"
 */
export function bookingSummaryLine(b: {
  type: string;
  date: string;
  slot?: string | null;
  startTime?: string | null;
  hours?: number | null;
}): string {
  let time = "";
  if (b.startTime && b.hours) {
    time = `${b.startTime}–${endTime(b.startTime, b.hours)}`;
  } else if (b.startTime) {
    time = `с ${b.startTime}`;
  } else if (b.slot === "day") {
    time = "дневной слот (до 15:00)";
  } else if (b.slot === "evening") {
    time = "вечерний слот (с 16:00)";
  }
  return `${ddmm(b.date)}${time ? `, ${time}` : ""} · ${SHORT_TYPE[b.type] ?? b.type}`;
}

/** Сводка записи на мероприятие: "25.09, 19:00 · Киновечер на проекторе" */
export function eventSummaryLine(ev: {
  date: string;
  time?: string | null;
  title: string;
}): string {
  return `${ddmm(ev.date)}${ev.time ? `, ${ev.time}` : ""} · ${ev.title}`;
}

async function sendTelegram(text: string) {
  try {
    const s = await getAllSettings();
    const token = s.telegram_bot_token;
    const chatId = s.telegram_chat_id;
    if (!token || !chatId) return { sent: false, reason: "not_configured" };
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      },
    );
    return { sent: res.ok };
  } catch (e) {
    console.error("Telegram notify failed", e);
    return { sent: false, reason: "error" };
  }
}

/**
 * Отбивка менеджеру о новой заявке — без персональных данных клиента
 * (имя/телефон смотрим в админке).
 */
export async function notifyAdminNewBooking(b: {
  id: number;
  summary: string;
  source: "сайт" | "приложение";
}) {
  return sendTelegram(
    [
      `🔔 Новая заявка №${b.id}`,
      `📅 ${b.summary}`,
      `📱 Источник: ${b.source}`,
      `👉 Подробности в админке`,
    ].join("\n"),
  );
}

/** Проверка связи с ботом из админки */
export async function notifyAdminTest() {
  return sendTelegram("✅ Проверка связи: бот Лавбрю на связи, уведомления работают.");
}

/** Уведомление о записи на мероприятие из афиши */
export async function notifyAdminEventRegistration(r: {
  id: number;
  summary: string;
  source: "сайт" | "приложение";
}) {
  return sendTelegram(
    [
      `🎟 Новая запись на мероприятие №${r.id}`,
      `📅 ${r.summary}`,
      `📱 Источник: ${r.source}`,
      `👉 Подробности в админке (вкладка «Афиша»)`,
    ].join("\n"),
  );
}
