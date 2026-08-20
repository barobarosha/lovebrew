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
  isWeekendDate,
  useSiteContent,
  formatDateRu,
} from "@/lib/site";
import { CheckCircle2, Loader2 } from "lucide-react";

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
    preset.slot ?? (preset.date && isWeekendDate(preset.date) ? "day" : "fullday"),
  );
  const [startTime, setStartTime] = useState("10:00");
  const [hours, setHours] = useState(2);
  const [guests, setGuests] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const weekend = date ? isWeekendDate(date) : false;
  const loftPrice = weekend
    ? parseInt(s.price_loft_weekend ?? "3500", 10)
    : parseInt(s.price_loft_weekday ?? "3000", 10);
  const cleaning = parseInt(s.price_cleaning ?? "1500", 10);
  const coworkPrice = parseInt(s.price_coworking_hour ?? "200", 10);

  const estimate =
    preset.type === "loft"
      ? weekend
        ? null
        : loftPrice * hours + cleaning
      : preset.type === "coworking"
        ? coworkPrice * hours * guests
        : null;

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
            ? weekend
              ? slot === "fullday"
                ? "day"
                : slot
              : "fullday"
            : undefined,
        startTime:
          preset.type === "kids"
            ? startTime
            : preset.type === "loft" && !weekend
              ? startTime
              : preset.type === "coworking"
                ? startTime
                : undefined,
        hours:
          preset.type === "kids"
            ? undefined
            : preset.type === "loft"
              ? weekend
                ? undefined
                : hours
              : hours,
        guests: preset.type === "coworking" ? guests : guests || undefined,
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: () => {
          utils.site.calendar.invalidate();
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
              if (preset.type === "loft" && e.target.value) {
                setSlot(
                  isWeekendDate(e.target.value) ? "day" : "fullday",
                );
              }
            }}
            className="rounded-xl"
          />
          {date && (
            <p className="text-xs opacity-60">{formatDateRu(date)}</p>
          )}
        </div>

        {preset.type === "loft" && date && weekend && (
          <div className="grid gap-2">
            <Label>Слот (в выходные лофт работает по слотам)</Label>
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

        {preset.type === "loft" && date && !weekend && (
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Начало</Label>
              <Input
                type="time"
                value={startTime}
                min="08:00"
                max="21:00"
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label>Часов (от 2)</Label>
              <Input
                type="number"
                min={2}
                max={13}
                value={hours}
                onChange={(e) => setHours(Math.max(2, +e.target.value || 2))}
                className="rounded-xl"
              />
            </div>
          </div>
        )}

        {preset.type === "coworking" && (
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Начало</Label>
              <Input
                type="time"
                value={startTime}
                min="08:00"
                max="20:00"
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label>Часов</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={hours}
                onChange={(e) => setHours(Math.max(1, +e.target.value || 1))}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label>Мест</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={guests}
                onChange={(e) => setGuests(Math.max(1, +e.target.value || 1))}
                className="rounded-xl"
              />
            </div>
          </div>
        )}

        {preset.type === "kids" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Время визита</Label>
              <Input
                type="time"
                value={startTime}
                min="08:00"
                max="15:00"
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label>Детей</Label>
              <Input
                type="number"
                min={1}
                max={15}
                value={guests}
                onChange={(e) => setGuests(Math.max(1, +e.target.value || 1))}
                className="rounded-xl"
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

        {preset.type === "loft" && weekend && (
          <div
            className="rounded-2xl px-4 py-3 text-sm"
            style={{ background: BRAND.cream }}
          >
            <span className="opacity-70">Тариф выходного дня: </span>
            <span className="font-display font-semibold">
              {loftPrice.toLocaleString("ru-RU")} ₽/ч
            </span>
            <span className="mt-1 block text-xs opacity-60">
              от 2-х часов + финальная уборка{" "}
              {cleaning.toLocaleString("ru-RU")} ₽ · акция «3+1» при брони от
              3 часов
            </span>
          </div>
        )}

        {estimate !== null && (
          <div
            className="rounded-2xl px-4 py-3 text-sm"
            style={{ background: BRAND.cream }}
          >
            <span className="opacity-70">Предварительная стоимость: </span>
            <span className="font-display font-semibold">
              ~{estimate.toLocaleString("ru-RU")} ₽
            </span>
            {preset.type === "loft" && (
              <span className="mt-1 block text-xs opacity-60">
                {weekend
                  ? `${loftPrice.toLocaleString("ru-RU")} ₽/ч × ${hours} ч + уборка ${cleaning.toLocaleString("ru-RU")} ₽ (итог уточнит администратор)`
                  : `${loftPrice.toLocaleString("ru-RU")} ₽/ч × ${hours} ч + уборка ${cleaning.toLocaleString("ru-RU")} ₽ · акция 3+1 применяется при подтверждении`}
              </span>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

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
          Нажимая кнопку, вы соглашаетесь с политикой обработки персональных
          данных
        </p>
      </div>
    </div>
  );
}
