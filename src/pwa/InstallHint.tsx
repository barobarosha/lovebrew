import { MoreVertical, Share, Smartphone, X } from "lucide-react";
import { BRAND } from "@/lib/site";

/**
 * Подсказка «добавьте приложение на экран "Домой"».
 * Показывается при первой авторизации (модалка в PwaApp)
 * и постоянно — карточкой на экране профиля.
 * Если приложение уже установлено (standalone), не показываем ничего.
 */

const HINT_SEEN_KEY = "lavbrew_install_hint_seen";

export function installHintSeen(): boolean {
  return localStorage.getItem(HINT_SEEN_KEY) === "1";
}

export function markInstallHintSeen() {
  localStorage.setItem(HINT_SEEN_KEY, "1");
}

/** Приложение открыто как установленное (standalone) — подсказка не нужна */
export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function steps(): { icon: typeof Share; text: string }[] {
  const p = detectPlatform();
  if (p === "ios") {
    return [
      {
        icon: Share,
        text: "Нажмите «Поделиться» — квадрат со стрелкой вверх внизу Safari",
      },
      {
        icon: Smartphone,
        text: "Прокрутите список и выберите «На экран „Домой“»",
      },
      {
        icon: Smartphone,
        text: "Нажмите «Добавить» — иконка Лавбрю появится рядом с приложениями",
      },
    ];
  }
  if (p === "android") {
    return [
      {
        icon: MoreVertical,
        text: "Нажмите ⋮ (меню) в правом верхнем углу браузера",
      },
      {
        icon: Smartphone,
        text: "Выберите «На экран „Домой“» или «Установить приложение»",
      },
      {
        icon: Smartphone,
        text: "Подтвердите — иконка Лавбрю появится на рабочем столе",
      },
    ];
  }
  return [
    { icon: MoreVertical, text: "Откройте меню браузера" },
    {
      icon: Smartphone,
      text: "Выберите «На экран „Домой“» или «Установить приложение»",
    },
  ];
}

/** Нумерованный список шагов — общий для модалки и карточки в профиле */
export function InstallHintSteps() {
  return (
    <ol className="space-y-2.5">
      {steps().map((s, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
            style={{ background: BRAND.pink, color: BRAND.ink }}
          >
            {i + 1}
          </span>
          <span className="flex items-start gap-2 text-sm leading-snug">
            <s.icon
              size={16}
              className="mt-0.5 shrink-0"
              style={{ color: BRAND.sageDeep }}
            />
            {s.text}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Компактная карточка для экрана профиля */
export function InstallHintCard() {
  if (isStandaloneMode()) return null;
  return (
    <div className="mt-6 rounded-3xl p-5" style={{ background: BRAND.white }}>
      <div className="flex items-center gap-2">
        <Smartphone size={18} style={{ color: BRAND.sageDeep }} />
        <p className="font-display text-lg font-bold uppercase">
          На рабочий экран
        </p>
      </div>
      <p className="mt-1.5 mb-4 text-sm" style={{ color: BRAND.sageDeep }}>
        Добавьте приложение на экран «Домой» — бонусы и брони всегда под рукой
      </p>
      <InstallHintSteps />
    </div>
  );
}

/** Модалка при первой авторизации */
export function InstallHintModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div
        className="w-full max-w-md rounded-t-3xl p-6 pb-8 sm:rounded-3xl"
        style={{ background: BRAND.cream, color: BRAND.ink }}
      >
        <div className="flex items-start justify-between">
          <p className="font-display text-2xl font-extrabold uppercase leading-tight">
            Добавьте на экран «Домой»
          </p>
          <button
            onClick={onClose}
            className="rounded-full p-2"
            style={{ background: BRAND.creamDeep }}
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-2 mb-5 text-sm" style={{ color: BRAND.sageDeep }}>
          Чтобы приложение открывалось в один клик, как обычное — без браузера
          и адресной строки
        </p>
        <InstallHintSteps />
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-full py-3.5 font-semibold"
          style={{ background: BRAND.sage, color: BRAND.ink }}
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
