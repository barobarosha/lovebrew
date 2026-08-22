import { BRAND, formatDateRu, useReveal } from "@/lib/site";
import { imagePath } from "@/lib/imagePath";
import { trpc } from "@/providers/trpc";
import { useBooking } from "@/components/booking/BookingProvider";
import { CalendarPlus } from "lucide-react";

const FALLBACK_IMAGES = [
  imagePath("images/party.jpg"),
  imagePath("images/piano.jpg"),
  imagePath("images/hero-loft.jpg"),
];

export function EventsSection() {
  const ref = useReveal<HTMLElement>();
  const eventsQuery = trpc.site.events.useQuery(undefined, {
    staleTime: 60_000,
  });
  const { openBooking } = useBooking();
  const upcoming = eventsQuery.data?.upcoming ?? [];

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
                  <button
                    onClick={() => openBooking({ type: "loft", date: e.date })}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-transform hover:scale-105"
                    style={{ background: BRAND.cream, color: BRAND.ink }}
                  >
                    <CalendarPlus className="h-4 w-4" /> Хочу так же
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
