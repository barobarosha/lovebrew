import { getAllSettings } from "./settings";

const TYPE_LABELS: Record<string, string> = {
  loft: "Аренда лофта",
  coworking: "Коворкинг",
  kids: "Детская комната",
};

export async function notifyAdminNewBooking(b: {  type: string;
  name: string;
  phone: string;
  date: string;
  slot?: string | null;
  startTime?: string | null;
  hours?: number | null;
  guests?: number | null;
  comment?: string | null;
}) {
  try {
    const s = await getAllSettings();
    const token = s.telegram_bot_token;
    const chatId = s.telegram_chat_id;
    if (!token || !chatId) return { sent: false, reason: "not_configured" };

    const slotLabel =
      b.slot === "day"
        ? "дневной слот (до 15:00)"
        : b.slot === "evening"
          ? "вечерний слот (с 16:00)"
          : b.slot === "fullday"
            ? "будний день"
            : null;

    const lines = [
      `🔔 Новая заявка — ${TYPE_LABELS[b.type] ?? b.type}`,
      ``,
      `👤 Имя: ${b.name}`,
      `📞 Телефон: ${b.phone}`,
      `📅 Дата: ${b.date}`,
    ];
    if (slotLabel) lines.push(`🕐 Слот: ${slotLabel}`);
    if (b.startTime) lines.push(`🕐 Время: с ${b.startTime}`);
    if (b.hours) lines.push(`⏳ Длительность: ${b.hours} ч.`);
    if (b.guests) lines.push(`👥 Гостей/мест: ${b.guests}`);
    if (b.comment) lines.push(`💬 Комментарий: ${b.comment}`);
    lines.push(``, `Подтвердите заявку в админке сайта.`);

    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: lines.join("\n"),
        }),
      },
    );
    return { sent: res.ok };
  } catch (e) {
    console.error("Telegram notify failed", e);
    return { sent: false, reason: "error" };
  }
}

/** Уведомление о записи на мероприятие из афиши */
export async function notifyAdminEventRegistration(r: {
  eventTitle: string;
  eventDate: string;
  name: string;
  phone: string;
}) {
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
        body: JSON.stringify({
          chat_id: chatId,
          text: [
            `🎟 Новая запись на мероприятие`,
            ``,
            `📌 ${r.eventTitle}`,
            `📅 Дата: ${r.eventDate}`,
            `👤 Имя: ${r.name}`,
            `📞 Телефон: ${r.phone}`,
            ``,
            `Подтвердите запись в админке (вкладка «Афиша»).`,
          ].join("\n"),
        }),
      },
    );
    return { sent: res.ok };
  } catch (e) {
    console.error("Telegram notify failed", e);
    return { sent: false, reason: "error" };
  }
}
