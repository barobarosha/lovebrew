import { useState } from "react";
import { BRAND, formatDateRu, useReveal } from "@/lib/site";
import { trpc } from "@/providers/trpc";
import { useBooking } from "@/components/booking/BookingProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarPlus, CheckCircle2, Loader2, Ticket } from "lucide-react";

const FALLBACK_IMAGES = [
  "/images/party.jpg",
  "/images/piano.jpg",
  "/images/hero-loft.jpg",
];

type SiteEvent = {
  id: number;
  title: string;
  description: string | null;
  date: string;
  time: string | null;
  price: string | null;
  imageUrl: string | null;
  isPublished: boolean;
  registrationOpen: boolean;
};

export function EventsSection() {
  const ref = useReveal<HTMLElement>();
  const eventsQuery = trpc.site.events.useQuery(undefined, {
    staleTime: 60_000,
  });
  const { openBooking } = useBooking();
  const [regEvent, setRegEvent] = useState<SiteEvent | null>(null);
  const upcoming = (eventsQuery.data?.upcoming ?? []) as SiteEvent[];

  return (
    <section
      id="events"
      ref={ref}
      className="py-16 sm:py-24"
      style={{ background: BRAND.ink }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <h2
            className="font-display text-3xl font-bold sm:text-5xl"
            style={{ color: BRAND.cream }}
          >
            АФИША
            <br />
            <span style={{ color: BRAND.pink }}>МЕРОПРИЯТИЙ</span>
          </h2>
          <p className="max-w-sm text-sm leading-relaxed" style={{ color: BRAND.sage }}>
            Киновечера, мастер-классы, детские праздники и живая музыка — всё,
            что происходит в лофте в ближайшее время.
          </p>
        </div>

        {upcoming.length === 0 && (
          <p
            className="rounded-3xl p-8 text-center text-sm"
            style={{ background: "rgba(244,241,232,0.06)", color: BRAND.creamDeep }}
          >
            Анонсы скоро появятся. Хотите провести своё мероприятие?
            Забронируйте лофт!
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((e, i) => (
            <article
              key={e.id}
              className="group overflow-hidden rounded-3xl transition-transform hover:-translate-y-1.5"
              style={{ background: "rgba(244,241,232,0.06)" }}
            >
              <div className="relative overflow-hidden">
                <img
                  src={e.imageUrl || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]}
                  alt={e.title}
                  className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <span
                  className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
                  style={{ background: BRAND.pink, color: BRAND.ink }}
                >
                  {formatDateRu(e.date)}
                  {e.time ? ` · ${e.time}` : ""}
                </span>
              </div>
              <div className="p-5">
                <h3
                  className="font-display text-lg font-semibold leading-snug"
                  style={{ color: BRAND.cream }}
                >
                  {e.title}
                </h3>
                {e.description && (
                  <p
                    className="mt-2 line-clamp-3 text-sm leading-relaxed"
                    style={{ color: BRAND.sage }}
                  >
                    {e.description}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  {e.price && (
                    <span
                      className="font-display text-base font-bold"
                      style={{ color: BRAND.pink }}
                    >
                      {e.price}
                    </span>
                  )}
                  {e.registrationOpen ? (
                    <button
                      onClick={() => setRegEvent(e)}
                      className="ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-transform hover:scale-105"
                      style={{ background: BRAND.pink, color: BRAND.ink }}
                    >
                      <Ticket className="h-4 w-4" /> Записаться
                    </button>
                  ) : (
                    <button
                      onClick={() => openBooking({ type: "loft", date: e.date })}
                      className="ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-transform hover:scale-105"
                      style={{ background: BRAND.cream, color: BRAND.ink }}
                    >
                      <CalendarPlus className="h-4 w-4" /> Хочу так же
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <EventRegistrationDialog
        event={regEvent}
        onClose={() => setRegEvent(null)}
      />
    </section>
  );
}

function EventRegistrationDialog({
  event,
  onClose,
}: {
  event: SiteEvent | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = trpc.site.registerEvent.useMutation({
    onSuccess: () => setDone(true),
    onError: (e) => setError(e.message),
  });

  const submit = () => {
    if (!event) return;
    setError(null);
    if (name.trim().length < 2) return setError("Укажите имя");
    if (phone.replace(/\D/g, "").length < 10)
      return setError("Укажите телефон");
    register.mutate({
      eventId: event.id,
      name: name.trim(),
      phone: phone.trim(),
    });
  };

  return (
    <Dialog
      open={!!event}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setDone(false);
          setError(null);
          setName("");
          setPhone("");
        }
      }}
    >
      <DialogContent
        className="rounded-3xl border-0 sm:max-w-md"
        style={{ background: BRAND.white, color: BRAND.ink }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {done ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle2 className="h-14 w-14" style={{ color: BRAND.sageDeep }} />
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                Вы в списке!
              </DialogTitle>
              <DialogDescription className="text-base leading-relaxed">
                Заявка отправлена — администратор подтвердит запись и свяжется
                с вами.
              </DialogDescription>
            </DialogHeader>
            <Button
              className="rounded-full px-8"
              style={{ background: BRAND.sageDeep, color: BRAND.white }}
              onClick={onClose}
            >
              Отлично
            </Button>
          </div>
        ) : (
          event && (
            <div className="space-y-5">
              <DialogHeader>
                <DialogTitle className="font-display text-xl leading-snug">
                  Запись: {event.title}
                </DialogTitle>
                <DialogDescription>
                  {formatDateRu(event.date)}
                  {event.time ? ` · ${event.time}` : ""}
                  {event.price ? ` · ${event.price}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Ваше имя</Label>
                  <Input
                    className="rounded-xl"
                    placeholder="Как к вам обращаться"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Телефон</Label>
                  <Input
                    className="rounded-xl"
                    placeholder="+7 (___) ___-__-__"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                {error && (
                  <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
                    {error}
                  </p>
                )}
                <Button
                  size="lg"
                  disabled={register.isPending}
                  onClick={submit}
                  className="w-full rounded-full text-base font-semibold"
                  style={{ background: BRAND.ink, color: BRAND.cream }}
                >
                  {register.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                      Отправляем…
                    </>
                  ) : (
                    "Записаться"
                  )}
                </Button>
                <p className="text-center text-xs opacity-50">
                  Нажимая кнопку, вы соглашаетесь с политикой обработки
                  персональных данных
                </p>
              </div>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
