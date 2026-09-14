import { useEffect, useRef } from "react";
import { trpc } from "@/providers/trpc";

export const BRAND = {
  cream: "#F4F1E8",
  creamDeep: "#E7E3D9",
  sage: "#AAAD91",
  sageDeep: "#6F7260",
  ink: "#2F3128",
  pink: "#F4C2C2",
  white: "#FBFAF6",
};

export type MenuItem = {
  id: number;
  category: string;
  name: string;
  description: string | null;
  volume: string | null;
  price: number;
  imageUrl: string | null;
};

export type SiteEvent = {
  id: number;
  title: string;
  description: string | null;
  date: string;
  time: string | null;
  price: string | null;
  imageUrl: string | null;
};

export type SlotStatus = "available" | "booked" | "blocked" | "past";

export type CalendarDay = {
  loft: Record<string, SlotStatus>;
  coworkingSeatsTaken: number;
  events: { id: number; title: string; time: string | null }[];
};

export function useSiteContent() {
  return trpc.site.content.useQuery(undefined, {
    staleTime: 60_000,
  });
}

export function useCalendar(month: string) {
  return trpc.site.calendar.useQuery(
    { month },
    { staleTime: 30_000, placeholderData: (prev) => prev },
  );
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const names = [
    "ЯНВАРЬ",
    "ФЕВРАЛЬ",
    "МАРТ",
    "АПРЕЛЬ",
    "МАЙ",
    "ИЮНЬ",
    "ИЮЛЬ",
    "АВГУСТ",
    "СЕНТЯБРЬ",
    "ОКТЯБРЬ",
    "НОЯБРЬ",
    "ДЕКАБРЬ",
  ];
  return `${names[m - 1]} ${y}`;
}

export function formatDateRu(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "short",
  });
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isWeekendDate(date: string): boolean {
  const d = new Date(date + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

/** Scroll-reveal hook: adds .is-visible when the element enters viewport */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add("reveal");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/** Маска ввода телефона: +7 (XXX) XXX-XX-XX */
export function formatPhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (d && !d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  if (!d) return "";
  let out = "+7";
  if (d.length > 1) out += ` (${d.slice(1, 4)}`;
  if (d.length >= 4) out += `) ${d.slice(4, 7)}`;
  if (d.length >= 7) out += `-${d.slice(7, 9)}`;
  if (d.length >= 9) out += `-${d.slice(9, 11)}`;
  return out;
}

/** Сжимает картинку на клиенте до data URI (JPEG ≤ maxPx по ширине) */
export function fileToImageDataUrl(file: File, maxPx = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Нужен файл изображения"));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать картинку"));
    };
    img.src = url;
  });
}

export function slotLabel(slot: string | null | undefined): string {  switch (slot) {
    case "day":
      return "дневной (до 15:00)";
    case "evening":
      return "вечерний (с 16:00)";
    case "fullday":
      return "весь день";
    default:
      return "—";
  }
}

export function bookingTypeLabel(t: string): string {
  switch (t) {
    case "loft":
      return "Лофт";
    case "coworking":
      return "Коворкинг";
    case "kids":
      return "Детская комната";
    default:
      return t;
  }
}


/* ------------------------------------------------------------------ */
/* Чат с менеджером в Telegram после отправки заявки                   */
/* ------------------------------------------------------------------ */

/** Username чата менеджера из настройки (принимает @user, t.me/user или user) */
export function managerUsername(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.)?t\.me\//i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .trim();
}

/** Ссылка на чат менеджера с предзаполненным сообщением (без перс. данных) */
export function managerChatUrl(
  rawUsername: string | undefined,
  text: string,
): string | null {
  const u = managerUsername(rawUsername);
  if (!u) return null;
  return `https://t.me/${u}?text=${encodeURIComponent(text)}`;
}

/** Текст сообщения, которое клиент отправляет менеджеру из чата */
export function bookingChatMessage(summary: string, comment?: string): string {
  const lines = [
    "🔔 Ваша заявка отправлена!",
    `📅 ${summary}`,
  ];
  if (comment?.trim()) lines.push(`💬 ${comment.trim()}`);
  lines.push(
    "Если у вас есть дополнительные комментарии, то смело укажите их в этом чате.",
  );
  return lines.join("\n");
}
