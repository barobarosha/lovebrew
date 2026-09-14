import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
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
  isWeekendDate,
  managerChatUrl,
  useSiteContent,
  formatDateRu,
} from "@/lib/site";
import { CheckCircle2, Loader2, Send } from "lucide-react";

export type BookingPreset = {
  type: "loft" | "coworking" | "kids";
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

const TYPE_TITLES: Record<BookingPreset["type"], string> = {
  loft: "Аренда лофта",
  coworking: "Бронь места в коворкинге",
  kids: "Детская игровая комната",
};

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
  const [hours, setHours] = useState(2);
  const [guests, setGuests] = useState(1);
  const [kidsTariff, setKidsTariff] = useState<"hourly" | "unlimited">("hourly");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [goChat, setGoChat] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekend = date ? isWeekendDate(date) : false;
  const loftPrice = weekend
    ? parseInt(s.price_loft_weekend ?? "3500", 10)
    : parseInt(s.price_loft_weekday ?? "3000", 10);
  const cleaning = parseInt(s.price_cleaning ?? "1500", 10);
  const coworkPrice = parseInt(s.price_coworking_hour ?? "300", 10);
  const coworkDayPrice = parseInt(s.price_coworking_day ?? "900", 10);
  const kidsPrice = parseInt(s.price_kids_hour ?? "300", 10);
  const kidsUnlimitedPrice = parseInt(s.price_kids_unlimited ?? "1000", 10);

  // Акция «3+1»: каждый 4-й час аренды лофта — в подарок
  const freeHours = preset.type === "loft" ? Math.floor(hours / 4) : 0;
  const paidHours = hours - freeHours;

  const estimate =
    preset.type === "loft"
      ? loftPrice * paidHours + cleaning
      : preset.type === "coworking"
        ? (hours >= 3 ? coworkDayPrice : coworkPrice * hours) * guests
        : kidsTariff === "unlimited"
          ? kidsUnlimitedPrice * guests
          : kidsPrice * hours * guests;

  const submit = () => {
    setError(null);
    if (!date) return setError("Выберите дату");
    if (name.trim().length < 2) return setError("Укажите имя");
    if (phone.trim().length < 6) return setError("Укажите телефон");

    createBooking.mutate(
      {
        type: preset.type,
        name: name.trim(),
        phone: phone.trim(),
        date,
        slot:
          preset.type === "loft"
            ? slot
            : preset.type === "kids" && kidsTariff === "unlimited"
              ? ("unlimited" as const)
              : undefined,
        startTime:
          preset.type === "kids" && kidsTariff === "unlimited"
            ? undefined
            : startTime,
        hours:
          preset.type === "kids"
            ? kidsTariff === "hourly"
              ? hours
              : undefined
            : hours,
        guests: preset.type === "coworking" ? guests : guests || undefined,
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
          {TYPE_TITLES[preset.type]}
        </DialogTitle>
        <DialogDescription>
          {preset.type === "loft"
            ? "Пространство 100 м² с детской игровой комнатой, проектором, настольными играми и кухней. Оставьте заявку — администратор подтвердит бронь и свяжется с вами."
            : "Оставьте заявку — администратор подтвердит бронь и свяжется с вами."}
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
        </div>

        {preset.type === "loft" && (
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
                    background:
                      slot === v ? BRAND.sageDeep : "transparent",
                    color: slot === v ? BRAND.white : BRAND.ink,
                    borderColor:
                      slot === v ? BRAND.sageDeep : BRAND.creamDeep,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        {preset.type === "loft" && (
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
                min={2}
                max={13}
                value={hours}
                onChange={(e) => setHours(Math.max(2, +e.target.value || 2))}
                className="w-full min-w-0 rounded-xl"
              />
            </div>
          </div>
        )}

        {preset.type === "coworking" && (
          <div
            className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
            style={{ background: BRAND.cream }}
          >
            <b>Важно:</b> время работы коворкинга зависит от расписания лофта —
            уточняйте свободные часы заранее. Тарифы: 1 час — {coworkPrice} ₽, 2
            часа — {(coworkPrice * 2).toLocaleString("ru-RU")} ₽, день (от 3
            часов) — {coworkDayPrice.toLocaleString("ru-RU")} ₽. Гостям
            коворкинга — скидка 20% на напитки в кофейне.
          </div>
        )}

        {preset.type === "coworking" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="grid min-w-0 gap-2">
              <Label>Начало</Label>
              <Input
                type="time"
                value={startTime}
                min="08:00"
                max="20:00"
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full min-w-0 rounded-xl"
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Часов</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={hours}
                onChange={(e) => setHours(Math.max(1, +e.target.value || 1))}
                className="w-full min-w-0 rounded-xl"
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Мест</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={guests}
                onChange={(e) => setGuests(Math.max(1, +e.target.value || 1))}
                className="w-full min-w-0 rounded-xl"
              />
            </div>
          </div>
        )}

        {preset.type === "kids" && (
          <div className="grid gap-2">
            <Label>Тариф (цена за 1 ребёнка)</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["hourly", `Почасовой · ${kidsPrice.toLocaleString("ru-RU")} ₽/час`],
                  ["unlimited", `Безлимит до 15:00 · ${kidsUnlimitedPrice.toLocaleString("ru-RU")} ₽`],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setKidsTariff(v)}
                  className="rounded-xl border px-3 py-3 text-sm font-semibold transition-all"
                  style={{
                    background: kidsTariff === v ? BRAND.sageDeep : "transparent",
                    color: kidsTariff === v ? BRAND.white : BRAND.ink,
                    borderColor: kidsTariff === v ? BRAND.sageDeep : BRAND.creamDeep,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            {kidsTariff === "unlimited" && (
              <p className="text-xs opacity-60">
                Свободный вход/выход + напиток из классического меню кофейни
                любого объёма — бесплатно
              </p>
            )}
          </div>
        )}

        {preset.type === "kids" && (
          <div
            className={`grid grid-cols-1 gap-3 ${kidsTariff === "hourly" ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}
          >
            {kidsTariff === "hourly" && (
              <>
                <div className="grid min-w-0 gap-2">
                  <Label>Начало визита</Label>
                  <Input
                    type="time"
                    value={startTime}
                    min="08:00"
                    max="15:00"
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full min-w-0 rounded-xl"
                  />
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label>Часов</Label>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={hours}
                    onChange={(e) => setHours(Math.max(1, +e.target.value || 1))}
                    className="w-full min-w-0 rounded-xl"
                  />
                </div>
              </>
            )}
            <div className="grid min-w-0 gap-2">
              <Label>Детей</Label>
              <Input
                type="number"
                min={1}
                max={15}
                value={guests}
                onChange={(e) => setGuests(Math.max(1, +e.target.value || 1))}
                className="w-full min-w-0 rounded-xl"
              />
            </div>
          </div>
        )}

        {preset.type === "loft" && (
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
        )}

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
            placeholder={
              preset.type === "loft"
                ? "Повод, пожелания по оформлению, нужен ли рояль…"
                : "Пожелания или вопросы"
            }
            className="min-h-20 rounded-xl"
          />
        </div>

        {preset.type === "loft" && freeHours > 0 && (
          <div
            className="rounded-2xl px-4 py-3 text-sm font-semibold"
            style={{ background: BRAND.pink, color: BRAND.ink }}
          >
            🎁 Класс! Акция «3+1»: каждый 4-й час — в подарок. Уже вычли из
            стоимости {freeHours} ч.
          </div>
        )}

        {estimate !== null && (
          <div
            className="rounded-2xl px-4 py-3 text-sm"
            style={{ background: BRAND.cream }}
          >
            <span className="opacity-70">
              {preset.type === "loft" ? "Итого: " : "Предварительная стоимость: "}
            </span>
            <span className="font-display font-semibold">
              {estimate.toLocaleString("ru-RU")} ₽
            </span>
            {preset.type === "loft" && (
              <span className="mt-1 block text-xs opacity-60">
                {loftPrice.toLocaleString("ru-RU")} ₽/ч × {paidHours} ч
                {freeHours > 0 && ` (+ ${freeHours} ч в подарок по акции «3+1»)`}
                {" · "}* Финальная уборка и вынос мусора —{" "}
                {cleaning.toLocaleString("ru-RU")} ₽ за весь праздник. Вы
                просто забираете подарки, порядок — на нас.
              </span>
            )}
            {preset.type === "kids" && (
              <span className="mt-1 block text-xs opacity-60">
                {kidsTariff === "unlimited"
                  ? `${kidsUnlimitedPrice.toLocaleString("ru-RU")} ₽ × ${guests} дет. · безлимит до 15:00`
                  : `${kidsPrice.toLocaleString("ru-RU")} ₽/час × ${hours} ч × ${guests} дет.`}
              </span>
            )}
          </div>
        )}

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
