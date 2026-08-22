import { BRAND, useReveal, useSiteContent } from "@/lib/site";
import { imagePath } from "@/lib/imagePath";
import { useBooking } from "@/components/booking/BookingProvider";
import {
  Wifi,
  Gamepad2,
  Projector,
  Speaker,
  Music4,
  Baby,
  CookingPot,
  Ruler,
  Coffee,
} from "lucide-react";

const FEATURES = [
  {
    icon: Ruler,
    title: "Просторное помещение",
    text: "Площадь 100 м² и высота потолков от 3,5 м",
  },
  {
    icon: Coffee,
    title: "Кофейня с бариста",
    text: "Скидка 20% на напитки в день аренды по промокоду",
  },
  { icon: Wifi, title: "Wi-Fi", text: "Быстрый интернет для гостей и работы" },
  {
    icon: Gamepad2,
    title: "Настольные игры",
    text: "Большой выбор игр для любой компании",
  },
  {
    icon: Projector,
    title: "Проектор",
    text: "Киновечера и видео в высоком качестве",
  },
  {
    icon: Speaker,
    title: "Умная колонка",
    text: "Музыкальный помощник вашего мероприятия",
  },
  {
    icon: Music4,
    title: "Рояль",
    text: "Живая музыка и творческие вечера · 1 500 ₽ за мероприятие",
  },
  {
    icon: Baby,
    title: "Детская игровая",
    text: "Экологичные материалы, продумана до мелочей",
  },
  {
    icon: CookingPot,
    title: "Кухня",
    text: "Необходимая техника, включая холодильник",
  },
];

export function LoftSection() {
  const ref = useReveal<HTMLElement>();
  const { openBooking } = useBooking();
  const content = useSiteContent();
  const s = content.data?.settings ?? {};

  return (
    <section id="loft" ref={ref} className="py-16 sm:py-24" style={{ background: BRAND.creamDeep }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p
              className="mb-3 text-xs font-bold uppercase tracking-[0.25em]"
              style={{ color: BRAND.sageDeep }}
            >
              01 — Основная услуга
            </p>
            <h2 className="font-display text-3xl font-bold sm:text-5xl">
              ЛОФТ ДЛЯ
              <br />
              МЕРОПРИЯТИЙ
            </h2>
            <p className="mt-5 max-w-md leading-relaxed opacity-80">
              Дни рождения, детские праздники, камерные свадьбы, мастер-классы,
              йога и тренинги. Пространство трансформируется под ваш формат, а
              праздник можно заказать «под ключ».
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div
                className="rounded-3xl p-6"
                style={{ background: BRAND.white }}
              >
                <p className="text-xs font-bold uppercase tracking-wider opacity-60">
                  Будние дни
                </p>
                <p className="font-display mt-2 text-3xl font-bold">
                  {s.price_loft_weekday ?? "3000"} ₽
                  <span className="text-base font-medium opacity-60">/час</span>
                </p>
                <p className="mt-1 text-sm opacity-70">от 2-х часов</p>
              </div>
              <div
                className="rounded-3xl p-6"
                style={{ background: BRAND.sage }}
              >
                <p className="text-xs font-bold uppercase tracking-wider opacity-70">
                  Выходные и праздники
                </p>
                <p className="font-display mt-2 text-3xl font-bold">
                  {s.price_loft_weekend ?? "3500"} ₽
                  <span className="text-base font-medium opacity-70">/час</span>
                </p>
                <p className="mt-1 text-sm opacity-80">
                  слоты: дневной до 15:00 · вечерний с 16:00
                </p>
              </div>
            </div>

            <ul className="mt-6 space-y-3 text-sm leading-relaxed">
              <li className="flex gap-3">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: BRAND.sageDeep }}
                />
                <span>
                  <b>Акция «3+1»</b> — {s.offer_3plus1 ??
                    "при бронировании от 3-х часов 4-й час в подарок!"}
                </span>
              </li>
              <li className="flex gap-3">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: BRAND.sageDeep }}
                />
                <span>
                  Финальная уборка и вынос мусора —{" "}
                  <b>{s.price_cleaning ?? "1500"} ₽</b> за весь праздник. Вы
                  просто забираете подарки, порядок — на нас.
                </span>
              </li>
              <li className="flex gap-3">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: BRAND.sageDeep }}
                />
                <span>
                  <b>Организаторам</b> мастер-классов и групповых занятий —
                  специальные условия и скидки.
                </span>
              </li>
            </ul>

            <button
              onClick={() => openBooking({ type: "loft" })}
              className="mt-8 rounded-full px-8 py-4 font-display text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-105"
              style={{ background: BRAND.ink, color: BRAND.cream }}
            >
              Занять слот в лофте
            </button>
          </div>

          <div className="grid content-start gap-4">
            <img
              src={imagePath("images/party.jpg")}
              alt="Праздник в лофте"
              className="w-full rounded-3xl object-cover"
              style={{ aspectRatio: "16/10" }}
              loading="lazy"
            />
            <div className="grid grid-cols-2 gap-4">
              <img
                src={imagePath("images/piano.jpg")}
                alt="Рояль в лофте"
                className="w-full rounded-3xl object-cover"
                style={{ aspectRatio: "1/1", borderRadius: "6rem 1.5rem 1.5rem 1.5rem" }}
                loading="lazy"
              />
              <img
                src={imagePath("images/hero-loft.jpg")}
                alt="Зал лофта"
                className="w-full rounded-3xl object-cover"
                style={{ aspectRatio: "1/1", borderRadius: "1.5rem 1.5rem 6rem 1.5rem" }}
                loading="lazy"
              />
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="flex items-start gap-4 rounded-3xl p-5 transition-transform hover:-translate-y-1"
              style={{
                background: i === 6 ? BRAND.pink : BRAND.white,
              }}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: BRAND.cream, color: BRAND.sageDeep }}
              >
                <f.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-sm font-semibold">{f.title}</p>
                <p className="mt-1 text-sm leading-snug opacity-70">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
