import { useMemo, useState } from "react";
import {
  BRAND,
  currentMonth,
  formatDateRu,
  formatMonth,
  isWeekendDate,
  isRentableDate,
  managerChatUrl,
  serviceChatMessage,
  shiftMonth,
  useCalendar,
  useReveal,
  useSiteContent,
  type SlotStatus,
} from "@/lib/site";
import { useBooking } from "@/components/booking/BookingProvider";
import { ChevronLeft, ChevronRight, CalendarDays, Send } from "lucide-react";

const WEEKDAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

const SLOT_STYLE: Record<SlotStatus, { dot: string; label: string }> = {
  available: { dot: "#6A8F5A", label: "свободно" },
  booked: { dot: "#C4654F", label: "занято" },
  blocked: { dot: "#C4654F", label: "занято" }, // закрытый админом слот показываем как занятый
  past: { dot: "#D8D4C6", label: "прошло" },
};

export function BookingCalendar() {
  const ref = useReveal<HTMLElement>();
  const [month, setMonth] = useState(currentMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const cal = useCalendar(month);
  const { openBooking } = useBooking();
  const content = useSiteContent();
  const s = content.data?.settings ?? {};

  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    // Monday-first offset
    const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const arr: (string | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push(`${month}-${String(d).padStart(2, "0")}`);
    }
    return arr;
  }, [month]);

  const holidays = cal.data?.holidays;
  const dayData = selected ? cal.data?.days[selected] : undefined;
  const weekend = selected ? isWeekendDate(selected) : false;
  const holidayDay = selected ? !!holidays?.includes(selected) : false;
  // Аренда лофта: только выходные и праздничные дни
  const rentable = selected ? isRentableDate(selected, holidays) : false;
  const capacity = cal.data?.capacity ?? 8;

  const coworkChatUrl = managerChatUrl(
    s.telegram_manager,
    serviceChatMessage("coworking"),
  );
  const kidsChatUrl = managerChatUrl(
    s.telegram_manager,
    serviceChatMessage("kids"),
  );

  return (
    <section id="calendar" ref={ref} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-3xl font-bold sm:text-5xl">
          КАЛЕНДАРЬ
          <br />
          <span style={{ color: BRAND.sageDeep }}>СВОБОДНЫХ СЛОТОВ</span>
        </h2>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold">
          {(Object.keys(SLOT_STYLE) as SlotStatus[])
            .filter((k) => k !== "past" && k !== "blocked")
            .map((k) => (
              <span key={k} className="flex items-center gap-2 opacity-80">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: SLOT_STYLE[k].dot }}
                />
                {SLOT_STYLE[k].label}
              </span>
            ))}
          <span className="flex items-center gap-2 opacity-80">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: BRAND.creamDeep }}
            />
            будни · лофт не сдаётся
          </span>
          <span className="flex items-center gap-2 opacity-80">
            <span
              className="flex h-4 w-4 items-center justify-center rounded-full text-[9px]"
              style={{ background: BRAND.pink, color: BRAND.ink }}
            >
              ★
            </span>
            мероприятие
          </span>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-[2rem]"
        style={{ background: BRAND.white, boxShadow: "0 20px 60px -30px rgba(47,49,40,0.3)" }}
      >
        {/* Month header */}
        <div
          className="flex items-center justify-between px-5 py-4 sm:px-8"
          style={{ background: BRAND.sage }}
        >
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="rounded-full p-2 transition hover:bg-white/30"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft />
          </button>
          <p className="font-display text-xl font-bold tracking-wide sm:text-2xl">
            {formatMonth(month)}
          </p>
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="rounded-full p-2 transition hover:bg-white/30"
            aria-label="Следующий месяц"
          >
            <ChevronRight />
          </button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 px-3 pt-4 sm:px-6">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className="pb-2 text-center text-[10px] font-bold tracking-widest sm:text-xs"
              style={{ color: i >= 5 ? "#C4654F" : BRAND.sageDeep }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1 px-3 pb-4 sm:gap-2 sm:px-6 sm:pb-6">
          {cells.map((date, i) => {
            if (!date) return <div key={`e${i}`} />;
            const d = cal.data?.days[date];
            const dayNum = parseInt(date.slice(-2), 10);
            const isPast = d
              ? Object.values(d.loft).every((v) => v === "past")
              : date < new Date().toISOString().slice(0, 10);
            const isSelected = selected === date;
            // Будни (не праздники): лофт не сдаётся — заливаем серым,
            // точки слотов не рисуем. День остаётся кликабельным:
            // внизу доступны коворкинг и детская.
            const weekdayClosed =
              !isPast && !isRentableDate(date, holidays ?? undefined);
            return (
              <button
                key={date}
                onClick={() => setSelected(isSelected ? null : date)}
                disabled={isPast}
                className="relative flex min-h-14 flex-col items-center justify-start rounded-xl border px-1 py-1.5 transition-all sm:min-h-20 sm:rounded-2xl"
                style={{
                  borderColor: isSelected ? BRAND.ink : BRAND.creamDeep,
                  background: isSelected
                    ? BRAND.cream
                    : isPast
                      ? "transparent"
                      : weekdayClosed
                        ? BRAND.creamDeep
                        : BRAND.white,
                  opacity: isPast ? 0.4 : 1,
                  boxShadow: isSelected
                    ? "0 8px 24px -12px rgba(47,49,40,0.4)"
                    : undefined,
                }}
              >
                <span className="flex items-center gap-0.5">
                  <span
                    className="font-display text-sm font-semibold sm:text-base"
                    style={{
                      color:
                        weekdayClosed
                          ? "#8A8572"
                          : isWeekendDate(date) && !isPast
                            ? "#C4654F"
                            : BRAND.ink,
                    }}
                  >
                    {dayNum}
                  </span>
                  {d && d.events.length > 0 && (
                    <span
                      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] leading-none"
                      style={{ background: BRAND.pink, color: BRAND.ink }}
                      title="В этот день есть мероприятие"
                    >
                      ★
                    </span>
                  )}
                </span>
                {d && !isPast && !weekdayClosed && (
                  <span className="mt-1 flex flex-wrap items-center justify-center gap-1">
                    {Object.entries(d.loft).map(([slot, st]) => (
                      <span
                        key={slot}
                        className="h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2"
                        style={{ background: SLOT_STYLE[st].dot }}
                        title={`${slot}: ${SLOT_STYLE[st].label}`}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day panel */}
        {selected && dayData && (
          <div
            className="border-t px-5 py-6 sm:px-8"
            style={{ borderColor: BRAND.creamDeep, background: BRAND.cream }}
          >
            <p className="font-display text-lg font-semibold capitalize">
              {formatDateRu(selected)}
              {weekend && (
                <span className="ml-2 rounded-full px-3 py-1 align-middle text-xs"
                  style={{ background: BRAND.pink }}>
                  выходной
                </span>
              )}
              {!weekend && holidayDay && (
                <span className="ml-2 rounded-full px-3 py-1 align-middle text-xs"
                  style={{ background: BRAND.pink }}>
                  праздник
                </span>
              )}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {/* Loft slots — аренда только в выходные и праздники */}
              {(["day", "evening"] as const).map((slot) => {
                const st = dayData.loft[slot] ?? "available";
                const free = st === "available";
                return (
                  <div
                    key={slot}
                    className="rounded-2xl p-4"
                    style={{ background: BRAND.white }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider opacity-60">
                      Лофт · {slot === "day" ? "дневной до 15:00" : "вечерний с 16:00"}
                    </p>
                    <p
                      className="font-display mt-1 text-sm font-semibold"
                      style={{
                        color: !rentable ? "#B9B4A4" : SLOT_STYLE[st].dot,
                      }}
                    >
                      {!rentable ? "в будни не сдаётся" : SLOT_STYLE[st].label}
                    </p>
                    <button
                      disabled={!free || !rentable}
                      onClick={() =>
                        openBooking({ type: "loft", date: selected, slot })
                      }
                      className="mt-3 w-full rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-transform enabled:hover:scale-105 disabled:opacity-40"
                      style={{
                        background: free && rentable ? BRAND.ink : BRAND.creamDeep,
                        color: free && rentable ? BRAND.cream : BRAND.ink,
                      }}
                    >
                      {!rentable
                        ? "Только выходные и праздники"
                        : free
                          ? `Занять · ${s.price_loft_weekend ?? "3500"} ₽/ч`
                          : "Недоступно"}
                    </button>
                  </div>
                );
              })}

              {/* Coworking — бронь только через чат с менеджером */}
              <div className="rounded-2xl p-4" style={{ background: BRAND.white }}>
                <p className="text-xs font-bold uppercase tracking-wider opacity-60">
                  Коворкинг
                </p>
                <p className="font-display mt-1 text-sm font-semibold" style={{ color: BRAND.sageDeep }}>
                  свободно ~{Math.max(0, capacity - dayData.coworkingSeatsTaken)} из {capacity} мест
                </p>
                <a
                  href={coworkChatUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-transform hover:scale-105"
                  style={{ background: BRAND.sageDeep, color: BRAND.white }}
                >
                  <Send className="h-3.5 w-3.5" /> Бронь ·{" "}
                  {s.price_coworking_hour ?? "300"} ₽/ч
                </a>
              </div>

              {/* Kids — запись только через чат с менеджером */}
              <div className="rounded-2xl p-4" style={{ background: BRAND.white }}>
                <p className="text-xs font-bold uppercase tracking-wider opacity-60">
                  Детская игровая
                </p>
                <p className="font-display mt-1 text-sm font-semibold" style={{ color: BRAND.sageDeep }}>
                  до 15:00 · {s.price_kids_hour ?? "300"} ₽/час · безлимит{" "}
                  {s.price_kids_unlimited ?? "1000"} ₽
                </p>
                <a
                  href={kidsChatUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-transform hover:scale-105"
                  style={{ background: BRAND.pink, color: BRAND.ink }}
                >
                  <Send className="h-3.5 w-3.5" /> Записаться
                </a>
              </div>
            </div>

            {dayData.events.length > 0 && (
              <div className="mt-4 rounded-2xl p-4" style={{ background: BRAND.pink }}>
                <p className="text-xs font-bold uppercase tracking-wider">
                  Мероприятия в этот день
                </p>
                {dayData.events.map((e) => (
                  <p key={e.id} className="font-display mt-1 text-sm font-semibold">
                    {e.time ? `${e.time} · ` : ""}
                    {e.title}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {!cal.data && (
          <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm opacity-60">
            <CalendarDays className="h-4 w-4 animate-pulse" /> Загружаем
            календарь…
          </div>
        )}
      </div>
    </section>
  );
}
