import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Check, ChevronLeft, ChevronRight, Gift, Send, Ticket, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { usePwa } from "../store";
import {
  BRAND,
  bookingChatMessage,
  currentMonth,
  formatDateRu,
  formatMonth,
  isWeekendDate,
  managerChatUrl,
  serviceChatMessage,
  shiftMonth,
} from "@/lib/site";

type BookingType = "loft" | "coworking" | "kids";

const TYPE_META: Record<BookingType, { title: string; desc: string }> = {
  loft: { title: "Лофт 100 м²", desc: "праздники и камерные события" },
  coworking: { title: "Коворкинг", desc: "рабочее место в кофейне" },
  kids: { title: "Детская", desc: "игровая комната" },
};

const MIN_LOFT_HOURS = 2;
const MAX_LOFT_HOURS = 13;

export default function EventsScreen() {
  const { track, openBooking, customerToken, openLogin } = usePwa();
  const events = trpc.pwa.events.useQuery(undefined, { staleTime: 60_000 });
  const utils = trpc.useUtils();
  const [registered, setRegistered] = useState<Record<number, boolean>>({});

  useEffect(() => {
    track("pwa_events_view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = trpc.pwa.registerEvent.useMutation({
    onSuccess: (_r, vars) => {
      setRegistered((prev) => ({ ...prev, [vars.eventId]: true }));
      utils.pwa.myEventRegistrations.invalidate();
    },
  });
  const myRegs = trpc.pwa.myEventRegistrations.useQuery(
    { token: customerToken },
    { enabled: customerToken.length >= 10, staleTime: 30_000 },
  );
  const myRegEventIds = useMemo(
    () => new Set((myRegs.data ?? []).filter((r) => r.status !== "rejected").map((r) => r.eventId)),
    [myRegs.data],
  );

  return (
    <div className="px-4 pt-6">
      <div className="flex items-end justify-between">
        <p className="font-display text-3xl font-extrabold uppercase">Афиша</p>
      </div>

      <button
        onClick={openBooking}
        className="font-display mt-4 w-full rounded-full py-4 text-base font-bold uppercase text-white"
        style={{ background: BRAND.ink }}
      >
        Забронировать
      </button>

      <div className="mt-5 space-y-3">
        {events.data?.upcoming.map((e) => (
          <div key={e.id} className="rounded-3xl p-5" style={{ background: BRAND.white }}>
            {e.imageUrl && (
              <img
                src={e.imageUrl}
                alt={e.title}
                className="mb-3 h-36 w-full rounded-2xl object-cover"
              />
            )}
            <p className="text-xs font-semibold" style={{ color: BRAND.sageDeep }}>
              {formatDateRu(e.date)}
              {e.time ? ` · ${e.time}` : ""}
            </p>
            <p className="font-display mt-1 text-lg font-bold uppercase leading-tight">
              {e.title}
            </p>
            {e.description && (
              <p className="mt-2 text-sm leading-snug" style={{ color: BRAND.sageDeep }}>
                {e.description}
              </p>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              {e.price && <p className="text-sm font-bold">{e.price}</p>}
              {e.registrationOpen && (
                <button
                  disabled={
                    register.isPending ||
                    registered[e.id] ||
                    myRegEventIds.has(e.id)
                  }
                  onClick={() => {
                    if (customerToken.length < 10) {
                      openLogin();
                      return;
                    }
                    register.mutate({ token: customerToken, eventId: e.id });
                  }}
                  className="ml-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase disabled:opacity-60"
                  style={{
                    background:
                      registered[e.id] || myRegEventIds.has(e.id)
                        ? BRAND.sage
                        : BRAND.pink,
                    color: BRAND.ink,
                  }}
                >
                  {registered[e.id] || myRegEventIds.has(e.id) ? (
                    <>
                      <Check size={14} /> Вы записаны
                    </>
                  ) : (
                    <>
                      <Ticket size={14} />
                      {register.isPending ? "Записываем…" : "Записаться"}
                    </>
                  )}
                </button>
              )}
            </div>
            {registered[e.id] && (
              <p className="mt-2 text-xs" style={{ color: BRAND.sageDeep }}>
                Заявка отправлена — администратор подтвердит запись
              </p>
            )}
            {register.error && !registered[e.id] && (
              <p className="mt-2 text-xs font-medium text-red-700">
                {register.error.message}
              </p>
            )}
          </div>
        ))}
        {!events.isLoading && !events.data?.upcoming.length && (
          <p className="py-8 text-center text-sm" style={{ color: BRAND.sageDeep }}>
            Скоро анонсируем новые события
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function BookingSheet({ onClose }: { onClose: () => void }) {
  const { customerToken, openLogin } = usePwa();
  const utils = trpc.useUtils();
  const content = trpc.site.content.useQuery(undefined, { staleTime: 60_000 });
  const s = content.data?.settings ?? {};

  const [type, setType] = useState<BookingType>("loft");
  const [month, setMonth] = useState(currentMonth());
  const calendar = trpc.site.calendar.useQuery(
    { month },
    { staleTime: 30_000, placeholderData: (p) => p },
  );

  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<string>("");
  const [hours, setHours] = useState(MIN_LOFT_HOURS);
  // Текстовое значение поля «Часов»: можно очистить и ввести своё число;
  // пустое/0/1 нельзя отправить, при расфокусе — минимум 2
  const [hoursText, setHoursText] = useState(String(MIN_LOFT_HOURS));
  const [guests, setGuests] = useState(1);
  const [comment, setComment] = useState("");
  const [goChat, setGoChat] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const createBooking = trpc.pwa.createBooking.useMutation({
    onSuccess: (r) => {
      utils.site.calendar.invalidate();
      utils.pwa.myBookings.invalidate();
      if (goChat) {
        const url = managerChatUrl(
          s.telegram_manager,
          bookingChatMessage(r.summary, comment),
        );
        if (url) {
          window.location.href = url;
          return;
        }
      }
      setDone(true);
    },
    onError: (e) => setError(e.message),
  });

  const dayInfo = date ? calendar.data?.days[date] : undefined;
  const holidays = calendar.data?.holidays;

  // Аренда только в выходные/праздники — всегда «выходной» тариф
  const loftHourPrice = Number(s.price_loft_weekend || 3500);
  const cleaning = Number(s.price_cleaning || 1500);
  const coworkHour = Number(s.price_coworking_hour || 300);
  const coworkDay = Number(s.price_coworking_day || 900);
  const kidsPrice = Number(s.price_kids_hour || 300);
  const kidsUnlimitedPrice = Number(s.price_kids_unlimited || 1000);

  // Акция «3+1»: каждый 4-й час аренды лофта — в подарок
  const freeHours = Math.floor(hours / 4);
  const paidHours = hours - freeHours;
  const estimate = loftHourPrice * paidHours + cleaning;

  const onHoursChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 2);
    setHoursText(raw);
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= MIN_LOFT_HOURS && n <= MAX_LOFT_HOURS) {
      setHours(n);
    }
  };

  const onHoursBlur = () => {
    const n = parseInt(hoursText, 10);
    if (Number.isNaN(n) || n < MIN_LOFT_HOURS) {
      setHoursText(String(MIN_LOFT_HOURS));
      setHours(MIN_LOFT_HOURS);
    } else if (n > MAX_LOFT_HOURS) {
      setHoursText(String(MAX_LOFT_HOURS));
      setHours(MAX_LOFT_HOURS);
    }
  };

  const canSubmit = !!date && !!slot && customerToken.length >= 10;

  const submit = () => {
    setError("");
    const parsedHours = parseInt(hoursText, 10);
    if (hoursText.trim() === "" || Number.isNaN(parsedHours)) {
      return setError("Укажите длительность аренды");
    }
    if (parsedHours < MIN_LOFT_HOURS) {
      return setError("Минимальная аренда — 2 часа");
    }
    createBooking.mutate({
      token: customerToken,
      type: "loft",
      date,
      slot: slot as "day" | "evening",
      hours: parsedHours,
      guests,
      comment: comment || undefined,
    });
  };

  // календарная сетка
  const grid = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7; // пн=0
    const cells: (string | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= lastDay; d++) {
      cells.push(`${month}-${String(d).padStart(2, "0")}`);
    }
    return cells;
  }, [month]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const chatUrl =
    type === "coworking" || type === "kids"
      ? managerChatUrl(s.telegram_manager, serviceChatMessage(type))
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 pb-8"
        style={{ background: BRAND.cream }}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="font-display text-xl font-extrabold uppercase">
            Бронирование
          </p>
          <button
            onClick={onClose}
            className="rounded-full p-2"
            style={{ background: BRAND.creamDeep }}
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="py-8 text-center">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: BRAND.sage }}
            >
              <Check size={30} />
            </div>
            <p className="font-display mt-4 text-xl font-bold uppercase">
              Заявка отправлена!
            </p>
            <p className="mx-auto mt-2 max-w-xs text-sm" style={{ color: BRAND.sageDeep }}>
              Мы получили вашу бронь и скоро подтвердим. Статус можно смотреть
              в профиле — раздел «Мои брони».
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-full py-3.5 font-semibold text-white"
              style={{ background: BRAND.ink }}
            >
              Отлично
            </button>
          </div>
        ) : (
          <>
            {/* Тип */}
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_META) as BookingType[]).map((t) => {
                const active = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setType(t);
                      setSlot("");
                      setHours(MIN_LOFT_HOURS);
                      setHoursText(String(MIN_LOFT_HOURS));
                      setGuests(1);
                      setError("");
                    }}
                    className="rounded-2xl p-3 text-left"
                    style={{
                      background: active ? BRAND.ink : BRAND.white,
                      color: active ? BRAND.white : BRAND.ink,
                    }}
                  >
                    <p className="text-[13px] font-bold leading-tight">
                      {TYPE_META[t].title}
                    </p>
                    <p
                      className="mt-1 text-[10px] leading-tight"
                      style={{ color: active ? BRAND.creamDeep : BRAND.sageDeep }}
                    >
                      {TYPE_META[t].desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Коворкинг и детская — только через чат с менеджером */}
            {type !== "loft" ? (
              <div
                className="mt-4 rounded-2xl p-4"
                style={{ background: BRAND.white }}
              >
                <p className="font-display text-base font-bold uppercase">
                  {TYPE_META[type].title}
                </p>
                <p className="mt-1 text-xs" style={{ color: BRAND.sageDeep }}>
                  {type === "kids"
                    ? `Ежедневно до 15:00 · ${kidsPrice.toLocaleString("ru-RU")} ₽/час · безлимит ${kidsUnlimitedPrice.toLocaleString("ru-RU")} ₽ (цена за ребёнка)`
                    : `${coworkHour.toLocaleString("ru-RU")} ₽/час · день (от 3 часов) — ${coworkDay.toLocaleString("ru-RU")} ₽`}
                </p>
                <p className="mt-3 text-sm leading-snug">
                  Онлайн-бронирование здесь отключено — напишите нам в Telegram,
                  ответим быстро и всё оформим.
                </p>
                <a
                  href={chatUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="font-display mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold uppercase"
                  style={{ background: BRAND.ink, color: BRAND.cream }}
                >
                  <Send size={16} /> {type === "kids" ? "Записаться" : "Бронь"}
                </a>
              </div>
            ) : (
              <>
                {/* Месяц */}
                <div className="mt-4 rounded-2xl p-4" style={{ background: BRAND.white }}>
                  <div className="mb-3 flex items-center justify-between">
                    <button onClick={() => setMonth(shiftMonth(month, -1))}>
                      <ChevronLeft size={20} />
                    </button>
                    <p className="font-display text-sm font-bold">{formatMonth(month)}</p>
                    <button onClick={() => setMonth(shiftMonth(month, 1))}>
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {["П", "В", "С", "Ч", "П", "С", "В"].map((d, i) => (
                      <p key={i} className="text-[10px] font-bold" style={{ color: BRAND.sageDeep }}>
                        {d}
                      </p>
                    ))}
                    {grid.map((d, i) => {
                      if (!d) return <span key={i} />;
                      const info = calendar.data?.days[d];
                      const past = d < todayStr;
                      const hasFree =
                        info && Object.values(info.loft).some((st) => st === "available");
                      // Лофт сдаётся в выходные и праздники; будний день доступен,
                      // только если админ вручную открыл слот (hasFree)
                      const rentableDay =
                        isWeekendDate(d) || !!holidays?.includes(d);
                      const closed = !past && !rentableDay && !hasFree;
                      const selected = date === d;
                      return (
                        <button
                          key={i}
                          disabled={past || closed}
                          title={closed ? "В будни лофт не сдаётся" : undefined}
                          onClick={() => {
                            setDate(d);
                            setSlot("");
                          }}
                          className="relative flex h-9 items-center justify-center rounded-full text-sm font-semibold disabled:opacity-30"
                          style={{
                            background: selected ? BRAND.pink : "transparent",
                            color: BRAND.ink,
                          }}
                        >
                          {Number(d.slice(-2))}
                          {!past && info && (
                            <span
                              className="absolute bottom-0.5 h-1 w-1 rounded-full"
                              style={{
                                background: hasFree ? BRAND.sageDeep : "#C9C4B4",
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p
                    className="mt-3 text-center text-[11px] leading-snug"
                    style={{ color: BRAND.sageDeep }}
                  >
                    Лофт сдаётся в выходные и праздничные дни
                  </p>
                </div>

                {/* Параметры */}
                {date && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-semibold">{formatDateRu(date)}</p>

                    <div className="flex gap-2">
                      {(
                        [
                          ["day", "День · до 15:00"],
                          ["evening", "Вечер · с 16:00"],
                        ] as const
                      ).map(([id, label]) => {
                        const st = dayInfo?.loft[id];
                        const disabled = st !== "available";
                        return (
                          <button
                            key={id}
                            disabled={disabled}
                            onClick={() => setSlot(id)}
                            className="flex-1 rounded-2xl px-3 py-3 text-xs font-bold disabled:opacity-40"
                            style={{
                              background: slot === id ? BRAND.pink : BRAND.white,
                            }}
                          >
                            {label}
                            {disabled && st === "booked" && (
                              <span className="block text-[10px] font-medium">занято</span>
                            )}
                            {disabled && st === "blocked" && (
                              <span className="block text-[10px] font-medium">закрыто</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1 rounded-2xl p-3" style={{ background: BRAND.white }}>
                        <p className="text-xs" style={{ color: BRAND.sageDeep }}>
                          Часов (минимум 2)
                        </p>
                        <div className="mt-1 flex items-center justify-between">
                          <button
                            onClick={() => {
                              const n = Math.max(MIN_LOFT_HOURS, hours - 1);
                              setHours(n);
                              setHoursText(String(n));
                            }}
                            className="h-8 w-8 rounded-full font-bold"
                            style={{ background: BRAND.creamDeep }}
                          >
                            −
                          </button>
                          <input
                            value={hoursText}
                            inputMode="numeric"
                            onChange={onHoursChange}
                            onBlur={onHoursBlur}
                            aria-label="Часов"
                            className="w-12 bg-transparent text-center text-lg font-extrabold outline-none"
                          />
                          <button
                            onClick={() => {
                              const n = Math.min(MAX_LOFT_HOURS, hours + 1);
                              setHours(n);
                              setHoursText(String(n));
                            }}
                            className="h-8 w-8 rounded-full font-bold"
                            style={{ background: BRAND.creamDeep }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 rounded-2xl p-3" style={{ background: BRAND.white }}>
                        <p className="text-xs" style={{ color: BRAND.sageDeep }}>
                          Гостей
                        </p>
                        <div className="mt-1 flex items-center justify-between">
                          <button
                            onClick={() => setGuests(Math.max(1, guests - 1))}
                            className="h-8 w-8 rounded-full font-bold"
                            style={{ background: BRAND.creamDeep }}
                          >
                            −
                          </button>
                          <span className="text-lg font-extrabold">{guests}</span>
                          <button
                            onClick={() => setGuests(Math.min(60, guests + 1))}
                            className="h-8 w-8 rounded-full font-bold"
                            style={{ background: BRAND.creamDeep }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Комментарий (необязательно)"
                      className="w-full rounded-2xl border-none px-4 py-3 text-sm outline-none"
                      style={{ background: BRAND.white }}
                    />

                    {freeHours > 0 && (
                      <p
                        className="flex items-start gap-2 rounded-2xl p-3 text-xs font-semibold leading-snug"
                        style={{ background: BRAND.pink, color: BRAND.ink }}
                      >
                        <Gift size={16} className="mt-0.5 shrink-0" />
                        Класс! Акция «3+1»: каждый 4-й час — в подарок. Уже вычли из
                        стоимости {freeHours} ч.
                      </p>
                    )}

                    {/* Цена */}
                    <div
                      className="rounded-2xl p-4"
                      style={{ background: BRAND.white }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Итого</p>
                        <p className="font-display text-xl font-extrabold">
                          {estimate.toLocaleString("ru-RU")} ₽
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug" style={{ color: BRAND.sageDeep }}>
                        * Включена финальная уборка и вынос мусора —{" "}
                        {cleaning.toLocaleString("ru-RU")} ₽ за весь праздник.
                        Вы просто забираете подарки, порядок — на нас.
                        {freeHours > 0 &&
                          ` Акция «3+1» применена: оплачиваете ${paidHours} из ${hours} ч.`}
                      </p>
                    </div>

                    {error && (
                      <p className="text-center text-sm font-medium text-red-700">{error}</p>
                    )}

                    {customerToken.length >= 10 && (
                      <label
                        className="flex cursor-pointer items-start gap-3 rounded-2xl p-3"
                        style={{ background: BRAND.white }}
                      >
                        <input
                          type="checkbox"
                          checked={goChat}
                          onChange={(e) => setGoChat(e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#2f3b2c]"
                        />
                        <span className="text-xs leading-snug">
                          <span className="font-semibold">
                            Перейти в чат с менеджером в Telegram?
                          </span>
                          <span className="mt-0.5 block" style={{ color: BRAND.sageDeep }}>
                            Заявка продублируется в чат автоматически — там можно
                            уточнить детали и дождаться подтверждения. Без
                            персональных данных.
                          </span>
                        </span>
                      </label>
                    )}

                    {customerToken.length >= 10 ? (
                      <button
                        disabled={!canSubmit || createBooking.isPending}
                        onClick={submit}
                        className="font-display w-full rounded-full py-4 text-sm font-bold uppercase text-white disabled:opacity-50"
                        style={{ background: BRAND.ink }}
                      >
                        {createBooking.isPending ? "Отправляем…" : "Отправить заявку"}
                      </button>
                    ) : (
                      <button
                        onClick={openLogin}
                        className="font-display w-full rounded-full py-4 text-sm font-bold uppercase text-white"
                        style={{ background: BRAND.ink }}
                      >
                        Войти и забронировать
                      </button>
                    )}

                    <p
                      className="text-center text-[11px] leading-snug"
                      style={{ color: BRAND.sageDeep }}
                    >
                      Нажимая кнопку, вы принимаете{" "}
                      <a href="/legal/offer" target="_blank" className="underline">
                        договор оферты
                      </a>{" "}
                      и даёте{" "}
                      <a href="/legal/consent" target="_blank" className="underline">
                        согласие на обработку персональных данных
                      </a>
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
