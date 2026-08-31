import { BRAND, useSiteContent } from "@/lib/site";
import { useBooking } from "@/components/booking/BookingProvider";
import { ArrowDown, MapPin } from "lucide-react";

export function Hero() {
  const { openBooking } = useBooking();
  const content = useSiteContent();
  const s = content.data?.settings ?? {};

  return (
    <section id="top" className="relative overflow-hidden pt-24 sm:pt-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-end gap-8 lg:grid-cols-[1.15fr_1fr]">
          <div className="pb-4 lg:pb-14">
            <p
              className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em]"
              style={{ background: BRAND.pink, color: BRAND.ink }}
            >
              <MapPin className="h-3.5 w-3.5" />
              Красногорск · ЖК «Спасский мост»
            </p>
            <h1
              className="font-display text-[13vw] font-extrabold leading-[0.95] tracking-tight sm:text-7xl lg:text-[5.4rem]"
              style={{ color: BRAND.ink }}
            >
              КОФЕЙНЯ
              <br />
              <span style={{ color: BRAND.sageDeep }}>+ ЛОФТ</span>
              <br />
              <span className="font-light">ваше место</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed opacity-80 sm:text-lg">
              Идеальное место для отдыха, общения и мероприятий: просторный
              лофт для праздников под ключ, детская игровая комната, коворкинг
              и кофейня с профессиональным бариста.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => openBooking({ type: "loft" })}
                className="rounded-full px-8 py-4 font-display text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-105"
                style={{ background: BRAND.ink, color: BRAND.cream }}
              >
                Забронировать лофт
              </button>
              <a
                href="#calendar"
                className="rounded-full border-2 px-8 py-4 font-display text-sm font-semibold uppercase tracking-wide transition-colors"
                style={{ borderColor: BRAND.sageDeep, color: BRAND.sageDeep }}
              >
                Свободные даты
              </a>
            </div>
            <p
              className="mt-6 max-w-md rounded-2xl px-5 py-3 text-sm font-semibold"
              style={{ background: BRAND.creamDeep }}
            >
              {s.promo_text ??
                "В день аренды скидка 20% на напитки в кофейне"}
            </p>
          </div>

          <div className="relative">
            <div
              className="overflow-hidden"
              style={{
                borderRadius: "12rem 12rem 1.5rem 1.5rem",
              }}
            >
              <img
                src="/images/hero-loft.jpg"
                alt="Интерьер лофта Лавбрю"
                className="aspect-[4/5] w-full object-cover sm:aspect-[5/5]"
              />
            </div>
            <div
              className="absolute -left-4 bottom-8 hidden rotate-[-4deg] rounded-2xl px-5 py-3 shadow-xl sm:block"
              style={{ background: BRAND.sage, color: BRAND.ink }}
            >
              <p className="font-display text-2xl font-bold">
                {s.price_loft_weekday ?? "3000"} ₽/ч
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider">
                будни · выходные {s.price_loft_weekend ?? "3500"} ₽/ч
              </p>
            </div>
          </div>
        </div>
      </div>

      <a
        href="#services"
        className="mx-auto mt-8 flex w-max items-center gap-2 rounded-full px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] opacity-60 transition-opacity hover:opacity-100"
      >
        <ArrowDown className="h-4 w-4 animate-bounce" /> листайте
      </a>

      <Marquee />
    </section>
  );
}

export function Marquee() {
  const items = [
    "аренда лофта",
    "детская игровая",
    "коворкинг",
    "праздники под ключ",
    "проектор",
    "рояль",
    "настольные игры",
    "кофе и десерты",
  ];
  const row = [...items, ...items];
  return (
    <div
      className="mt-10 overflow-hidden py-4"
      style={{ background: BRAND.ink }}
    >
      <div className="animate-marquee flex w-max items-center gap-8 whitespace-nowrap">
        {row.map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-8 font-display text-sm uppercase tracking-[0.2em]"
            style={{ color: BRAND.cream }}
          >
            {t}
            <span style={{ color: BRAND.pink }}>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
