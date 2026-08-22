import { BRAND, useReveal, useSiteContent } from "@/lib/site";
import { imagePath } from "@/lib/imagePath";
import { useBooking } from "@/components/booking/BookingProvider";
import { ArrowUpRight, Check } from "lucide-react";

export function CoworkingSection() {
  const ref = useReveal<HTMLElement>();
  const { openBooking } = useBooking();
  const content = useSiteContent();
  const s = content.data?.settings ?? {};

  return (
    <section id="coworking" ref={ref} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div
          className="overflow-hidden"
          style={{ borderRadius: "1.5rem 8rem 1.5rem 1.5rem" }}
        >
          <img
            src={imagePath("images/coworking.jpg")}
            alt="Коворкинг в Лавбрю"
            className="aspect-[4/3] w-full object-cover"
            loading="lazy"
          />
        </div>
        <div>
          <p
            className="mb-3 text-xs font-bold uppercase tracking-[0.25em]"
            style={{ color: BRAND.sageDeep }}
          >
            02 — Работа и учёба
          </p>
          <h2 className="font-display text-3xl font-bold sm:text-5xl">
            КОВОРКИНГ
            <br />
            <span style={{ color: BRAND.sageDeep }}>С КОФЕ</span>
          </h2>
          <p className="mt-5 max-w-md leading-relaxed opacity-80">
            Спокойное светлое пространство для работы, учёбы и встреч. Быстрый
            Wi-Fi, розетки, а кофе и десерты — прямо из нашей кофейни.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div
              className="rounded-3xl px-6 py-5"
              style={{ background: BRAND.white }}
            >
              <p className="font-display text-3xl font-bold">
                {s.price_coworking_hour ?? "200"} ₽
                <span className="text-base font-medium opacity-60">/час</span>
              </p>
              <p className="mt-1 text-sm opacity-70">
                бронируйте место на нужное время
              </p>
            </div>
            <ul className="space-y-2 text-sm">
              {["Wi-Fi и розетки", "Спокойная атмосфера", "Напитки и десерты рядом"].map(
                (t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="h-4 w-4" style={{ color: BRAND.sageDeep }} />
                    {t}
                  </li>
                ),
              )}
            </ul>
          </div>
          <button
            onClick={() => openBooking({ type: "coworking" })}
            className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 font-display text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-105"
            style={{ background: BRAND.ink, color: BRAND.cream }}
          >
            Забронировать место <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

export function KidsSection() {
  const ref = useReveal<HTMLElement>();
  const { openBooking } = useBooking();
  const content = useSiteContent();
  const s = content.data?.settings ?? {};

  return (
    <section
      id="kids"
      ref={ref}
      className="py-16 sm:py-24"
      style={{ background: BRAND.sage }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] opacity-70">
              03 — Для малышей
            </p>
            <h2 className="font-display text-3xl font-bold sm:text-5xl">
              ДЕТСКАЯ
              <br />
              ИГРОВАЯ
            </h2>
            <p className="mt-5 max-w-md leading-relaxed opacity-90">
              Приходите играть без аренды лофта! Ежедневно до 15:00 ждём
              малышей от 0 до 7 лет. Комната создана из экологичных материалов
              и продумана до мелочей.
            </p>

            <div className="mt-6 grid max-w-md grid-cols-2 gap-4">
              <div className="rounded-3xl p-5" style={{ background: BRAND.white }}>
                <p className="font-display text-3xl font-bold">
                  {s.price_kids_hour ?? "300"} ₽
                </p>
                <p className="mt-1 text-sm opacity-70">1 час игры</p>
              </div>
              <div className="rounded-3xl p-5" style={{ background: BRAND.pink }}>
                <p className="font-display text-3xl font-bold">
                  {s.price_kids_unlimited ?? "1000"} ₽
                </p>
                <p className="mt-1 text-sm opacity-80">
                  безлимит до 15:00 + напиток в подарок
                </p>
              </div>
            </div>

            <ul className="mt-6 max-w-md space-y-2 text-sm leading-relaxed">
              <li>
                · Свободный вход и выход, напиток из классического меню любого
                объёма — бесплатно при безлимите
              </li>
              <li>· Формат свободной игры: присмотр осуществляют родители</li>
              <li>
                · В дни, когда лофт арендован под праздник, проход может быть
                ограничен — смотрите календарь
              </li>
            </ul>

            <button
              onClick={() => openBooking({ type: "kids" })}
              className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 font-display text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-105"
              style={{ background: BRAND.ink, color: BRAND.cream }}
            >
              Записаться на визит <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
          <div
            className="order-1 overflow-hidden lg:order-2"
            style={{ borderRadius: "8rem 1.5rem 1.5rem 1.5rem" }}
          >
            <img
              src={imagePath("images/kids.jpg")}
              alt="Детская игровая комната"
              className="aspect-[4/3] w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
