import { BRAND, managerChatUrl, serviceChatMessage, useReveal, useSiteContent } from "@/lib/site";
import { useBooking } from "@/components/booking/BookingProvider";
import { ArrowUpRight } from "lucide-react";

export function Services() {
  const ref = useReveal<HTMLElement>();
  const { openBooking } = useBooking();
  const content = useSiteContent();
  const s = content.data?.settings ?? {};

  const cards = [
    {
      id: "loft",
      title: "Лофт для мероприятий",
      desc: "Праздники под ключ, дни рождения, мастер-классы и киновечера — в выходные и праздничные дни",
      price: `от ${s.price_loft_weekend ?? "3500"} ₽/ч`,
      img: "/images/party.jpg",
      cta: () => openBooking({ type: "loft" }),
      ctaLabel: "Занять слот",
    },
    {
      id: "kids",
      title: "Детская игровая",
      desc: "Без аренды лофта: ежедневно до 15:00 для малышей 0–7 лет",
      price: `${s.price_kids_hour ?? "300"} ₽/час · безлимит ${s.price_kids_unlimited ?? "1000"} ₽`,
      img: "/images/kids.jpg",
      href: managerChatUrl(s.telegram_manager, serviceChatMessage("kids")) ?? "#",
      ctaLabel: "Записаться в Telegram",
    },
    {
      id: "coworking",
      title: "Коворкинг",
      desc: "Работайте в спокойной атмосфере с кофе и быстрым Wi-Fi",
      price: `от ${s.price_coworking_hour ?? "300"} ₽/час`,
      img: "/images/coworking.jpg",
      href: managerChatUrl(s.telegram_manager, serviceChatMessage("coworking")) ?? "#",
      ctaLabel: "Бронь в Telegram",
    },
    {
      id: "menu",
      title: "Кофейня",
      desc: "Авторские напитки, десерты и завтраки",
      price: "меню ниже",
      img: "/images/coffee.jpg",
      cta: () => {
        document
          .getElementById("menu")
          ?.scrollIntoView({ behavior: "smooth" });
      },
      ctaLabel: "Смотреть меню",
    },
  ] as const;

  return (
    <section id="services" ref={ref} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <h2
          className="font-display text-3xl font-bold sm:text-5xl"
          style={{ color: BRAND.ink }}
        >
          ЧТО ЕСТЬ
          <br />
          <span style={{ color: BRAND.sageDeep }}>ВНУТРИ?</span>
        </h2>
        <p className="max-w-sm text-sm leading-relaxed opacity-70">
          Четыре пространства под одной крышей. Выбирайте услугу — цены
          прозрачные, бронь занимает две минуты.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <article
            key={c.id}
            className="group flex flex-col overflow-hidden rounded-3xl transition-transform duration-300 hover:-translate-y-1.5"
            style={{
              background: BRAND.white,
              boxShadow: "0 10px 40px -18px rgba(47,49,40,0.25)",
            }}
          >
            <div className="relative overflow-hidden">
              <img
                src={c.img}
                alt={c.title}
                className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <span
                className="absolute left-3 top-3 rounded-full px-3 py-1 font-display text-xs font-semibold"
                style={{
                  background: i % 2 ? BRAND.pink : BRAND.sage,
                  color: BRAND.ink,
                }}
              >
                {c.price}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-display text-lg font-semibold leading-snug">
                {c.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed opacity-70">
                {c.desc}
              </p>
              {"href" in c && c.href ? (
                <a
                  href={c.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors"
                  style={{ borderColor: BRAND.ink }}
                >
                  {c.ctaLabel}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : (
                <button
                  onClick={"cta" in c ? c.cta : undefined}
                  className="mt-4 inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors"
                  style={{ borderColor: BRAND.ink }}
                >
                  {c.ctaLabel}
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
