import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { trpc } from "@/providers/trpc";
import {
  BRAND,
  bookingChatMessage,
  isRentableDate,
  managerChatUrl,
  useHolidaysFor,
  useSiteContent,
  formatDateRu,
} from "@/lib/site";
import { CheckCircle2, Loader2, Send } from "lucide-react";

export type BookingPreset = {
  type: "loft";
  date?: string;
  slot?: "day" | "evening" | "fullday";
};

type BookingContextValue = {
  openBooking: (preset: BookingPreset) => void;
};

const BookingContext = createContext<BookingContextValue>({
  openBooking: () => {},
});

export function useBooking() {
  return useContext(BookingContext);
}

const TYPE_TITLE = "Аренда лофта";
const MIN_LOFT_HOURS = 2;
const MAX_LOFT_HOURS = 13;

export function BookingProvider({ children }: { children: ReactNode }) {
  const [preset, setPreset] = useState<BookingPreset | null>(null);
  const [done, setDone] = useState(false);

  const openBooking = useCallback((p: BookingPreset) => {
    setDone(false);
    setPreset(p);
  }, []);

  const value = useMemo(() => ({ openBooking }), [openBooking]);

  return (
    <BookingContext.Provider value={value}>
      {children}
      <Dialog
        open={!!preset}
        onOpenChange={(open) => !open && setPreset(null)}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto rounded-3xl border-0 sm:max-w-lg"
          style={{ background: BRAND.white, color: BRAND.ink }}
          // Не отдаём фокус первому полю при открытии — иначе на iOS/Android
          // сразу выскакивает нативный календарь у input[type=date]
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {preset && !done && (
            <BookingForm
              key={`${preset.type}-${preset.date ?? ""}-${preset.slot ?? ""}`}
              preset={preset}
              onDone={() => setDone(true)}
            />
          )}
          {preset && done && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <CheckCircle2
                className="h-14 w-14"
                style={{ color: BRAND.sageDeep }}
              />
              <DialogHeader>
                <DialogTitle
                  className="font-display text-xl"
                  style={{ color: BRAND.ink }}
                >
                  Заявка отправлена!
                </DialogTitle>
                <DialogDescription className="text-base leading-relaxed">
                  Мы получили вашу заявку и скоро свяжемся с вами для
                  подтверждения. Обычно отвечаем в течение 15 минут в рабочее
                  время.
                </DialogDescription>
              </DialogHeader>
              <Button
                className="rounded-full px-8"
                style={{ background: BRAND.sageDeep, color: BRAND.white }}
                onClick={() => setPreset(null)}
              >
                Отлично
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </BookingContext.Provider>
  );
}

function BookingForm({
  preset,
  onDone,
}: {
  preset: BookingPreset;
  onDone: () => void;
}) {
  const content = useSiteContent();
  const s = content.data?.settings ?? {};
  const createBooking = trpc.booking.create.useMutation();
  const utils = trpc.useUtils();

  const [date, setDate] = useState(preset.date ?? "");
  const [slot, setSlot] = useState<"day" | "evening" | "fullday">(
    preset.slot ?? "day",
  );
  const [startTime, setStartTime] = useState("10:00");
  const [hours, setHours] = useState(MIN_LOFT_HOURS);
  // Текстовое значение поля «Часов»: позволяем очистить поле и ввести
  // своё число; 0/1 и пустоту нельзя отправить, при расфокусе — минимум 2
  const [hoursText, setHoursText] = useState(String(MIN_LOFT_HOURS));
  const [guests, setGuests] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [goChat, setGoChat] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Праздники РФ на год выбранной даты — лофт сдаётся в выходные и праздники
  const { data: holidays } = useHolidaysFor(date || undefined);
  const rentable = date ? isRentableDate(date, holidays) : true;

  // Аренда только в выходные/праздники — всегда «выходной» тариф
  const loftPrice = parseInt(s.price_loft_weekend ?? "3500", 10);
  const cleaning = parseInt(s.price_cleaning ?? "1500", 10);

  // Акция «3+1»: каждый 4-й час аренды лофта — в подарок
  const freeHours = Math.floor(hours / 4);
  const paidHours = hours - freeHours;
  const estimate = loftPrice * paidHours + cleaning;

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

  const submit = () => {
    setError(null);
    if (!date) return setError("Выберите дату");
    if (!rentable) {
      return setError(
        "В будни лофт не арендуется — выберите выходной или праздничный день",
      );
    }
    const parsedHours = parseInt(hoursText, 10);
    if (hoursText.trim() === "" || Number.isNaN(parsedHours)) {
      return setError("Укажите длительность аренды");
    }
    if (parsedHours < MIN_LOFT_HOURS) {
      return setError("Минимальная аренда — 2 часа");
    }
    if (name.trim().length < 2) return setError("Укажите имя");
    if (phone.trim().length < 6) return setError("Укажите телефон");

    createBooking.mutate(
      {
        type: "loft",
        name: name.trim(),
        phone: phone.trim(),
        date,
        slot,
        startTime,
        hours: parsedHours,
        guests: guests || undefined,
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: (r) => {
          utils.site.calendar.invalidate();
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
          onDone();
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle
          className="font-display text-xl leading-snug"
          style={{ color: BRAND.ink }}
        >
          {TYPE_TITLE}
        </DialogTitle>
        <DialogDescription>
          Пространство 100 м² с детской игровой комнатой, проектором,
          настольными играми и кухней. Аренда — в выходные и праздничные дни.
          Оставьте заявку — администратор подтвердит бронь и свяжется с вами.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Дата</Label>
          <Input
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              setDate(e.target.value);
            }}
            className="w-full min-w-0 rounded-xl"
          />
          {date && (
            <p className="text-xs opacity-60">{formatDateRu(date)}</p>
          )}
          {date && !rentable && (
            <p
              className="rounded-xl px-3 py-2 text-xs font-medium"
              style={{ background: BRAND.cream }}
            >
              В будни лофт не сдаётся — выберите субботу, воскресенье или
              официальный праздник.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label>Слот</Label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["day", "Дневной · до 15:00"],
                ["evening", "Вечерний · с 16:00"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setSlot(v)}
                className="rounded-xl border px-3 py-3 text-sm font-semibold transition-all"
                style={{
                  background: slot === v ? BRAND.sageDeep : "transparent",
                  color: slot === v ? BRAND.white : BRAND.ink,
                  borderColor: slot === v ? BRAND.sageDeep : BRAND.creamDeep,
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid min-w-0 gap-2">
            <Label>Начало</Label>
            <Input
              type="time"
              value={startTime}
              min="08:00"
              max="21:00"
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full min-w-0 rounded-xl"
            />
          </div>
          <div className="grid min-w-0 gap-2">
            <Label>Часов (от 2)</Label>
            <Input
              type="number"
              min={MIN_LOFT_HOURS}
              max={MAX_LOFT_HOURS}
              inputMode="numeric"
              value={hoursText}
              onChange={onHoursChange}
              onBlur={onHoursBlur}
              className="w-full min-w-0 rounded-xl"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Гостей (примерно)</Label>
          <Input
            type="number"
            min={1}
            max={60}
            value={guests}
            onChange={(e) => setGuests(Math.max(1, +e.target.value || 1))}
            className="rounded-xl"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Ваше имя</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как к вам обращаться"
              className="rounded-xl"
            />
          </div>
          <div className="grid gap-2">
            <Label>Телефон</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 (___) ___-__-__"
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Комментарий</Label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Повод, пожелания по оформлению, нужен ли рояль…"
            className="min-h-20 rounded-xl"
          />
        </div>

        {freeHours > 0 && (
          <div
            className="rounded-2xl px-4 py-3 text-sm font-semibold"
            style={{ background: BRAND.pink, color: BRAND.ink }}
          >
            🎁 Класс! Акция «3+1»: каждый 4-й час — в подарок. Уже вычли из
            стоимости {freeHours} ч.
          </div>
        )}

        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{ background: BRAND.cream }}
        >
          <span className="opacity-70">Итого: </span>
          <span className="font-display font-semibold">
            {estimate.toLocaleString("ru-RU")} ₽
          </span>
          <span className="mt-1 block text-xs opacity-60">
            {loftPrice.toLocaleString("ru-RU")} ₽/ч × {paidHours} ч
            {freeHours > 0 && ` (+ ${freeHours} ч в подарок по акции «3+1»)`}
            {" · "}* Финальная уборка и вынос мусора —{" "}
            {cleaning.toLocaleString("ru-RU")} ₽ за весь праздник. Вы просто
            забираете подарки, порядок — на нас.
          </span>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <label
          className="flex cursor-pointer items-start gap-3 rounded-2xl px-4 py-3 text-sm"
          style={{ background: BRAND.cream }}
        >
          <input
            type="checkbox"
            checked={goChat}
            onChange={(e) => setGoChat(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#2f3b2c]"
          />
          <span>
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Send className="h-3.5 w-3.5" /> Перейти в чат с менеджером в
              Telegram?
            </span>
            <span className="mt-0.5 block text-xs opacity-60">
              Заявка продублируется в чат автоматически — там можно уточнить
              детали и дождаться подтверждения. Без персональных данных.
            </span>
          </span>
        </label>

        <Button
          size="lg"
          disabled={createBooking.isPending}
          onClick={submit}
          className="w-full rounded-full text-base font-semibold"
          style={{ background: BRAND.ink, color: BRAND.cream }}
        >
          {createBooking.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Отправляем…
            </>
          ) : (
            "Отправить заявку"
          )}
        </Button>
        <p className="text-center text-xs opacity-50">
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
    </div>
  );
}
