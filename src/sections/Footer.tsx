import { BRAND, useSiteContent } from "@/lib/site";
import { useBooking } from "@/components/booking/BookingProvider";
import { Clock, Mail, MapPin, Phone, Send } from "lucide-react";

export function Footer() {
  const content = useSiteContent();
  const s = content.data?.settings ?? {};
  const { openBooking } = useBooking();
  const phone = s.phone ?? "+7 (933) 913-18-18";

  return (
    <footer id="contacts" style={{ background: BRAND.creamDeep }}>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="font-display text-3xl font-bold sm:text-5xl">
              С НЕТЕРПЕНИЕМ
              <br />
              <span style={{ color: BRAND.sageDeep }}>ЖДЁМ ВАС В ГОСТИ!</span>
            </h2>
            <p className="mt-5 max-w-md leading-relaxed opacity-80">
              Остались вопросы? Свяжитесь с нами в удобном мессенджере или
              оставьте заявку — администратор ответит в течение 15 минут в
              рабочее время.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => openBooking({ type: "loft" })}
                className="rounded-full px-8 py-4 font-display text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-105"
                style={{ background: BRAND.ink, color: BRAND.cream }}
              >
                Забронировать
              </button>
              <a
                href={s.telegram_link ?? "https://t.me/love_brew"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border-2 px-8 py-4 font-display text-sm font-semibold uppercase tracking-wide"
                style={{ borderColor: BRAND.ink, color: BRAND.ink }}
              >
                <Send className="h-4 w-4" /> Telegram
              </a>
            </div>
          </div>

          <div className="grid content-start gap-4">
            {[
              {
                icon: MapPin,
                label: "Адрес",
                value: s.address ?? "Красногорский бульвар, 23к2, Красногорск",
                href: `https://yandex.ru/maps/?text=${encodeURIComponent(
                  "Красногорск, " + (s.address ?? "Красногорский бульвар, 23к2"),
                )}`,
              },
              { icon: Phone, label: "Телефон", value: phone, href: `tel:${phone.replace(/[^+\d]/g, "")}` },
              { icon: Mail, label: "Почта", value: s.email ?? "love-brew@mail.ru", href: `mailto:${s.email ?? "love-brew@mail.ru"}` },
              {
                icon: Clock,
                label: "Время работы",
                value: `Будни ${s.hours_weekday ?? "8:00 – 21:00"} · Выходные ${s.hours_weekend ?? "9:00 – 21:00"}`,
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-start gap-4 rounded-3xl p-5"
                style={{ background: BRAND.white }}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: BRAND.cream, color: BRAND.sageDeep }}
                >
                  <row.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider opacity-50">
                    {row.label}
                  </p>
                  {row.href ? (
                    <a
                      href={row.href}
                      target={row.href.startsWith("http") ? "_blank" : undefined}
                      rel={row.href.startsWith("http") ? "noreferrer" : undefined}
                      className="font-display text-sm font-semibold hover:underline"
                    >
                      {row.value}
                    </a>
                  ) : (
                    <p className="font-display text-sm font-semibold">{row.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mt-14 flex flex-col items-start justify-between gap-4 border-t pt-6 text-xs opacity-60 sm:flex-row sm:items-center"
          style={{ borderColor: BRAND.sage }}
        >
          <p>© 2026 ЛАВБРЮ · Кофейня-лофт в Красногорске</p>
          <p>ИП Аветисян Е.С. · ИНН 773119647813 · ОГРНИП 322774600388110</p>
          <a
            href="https://baroshacode.ru/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold uppercase tracking-wider hover:opacity-100"
          >
            Сайт made by Бароша
          </a>
        </div>
      </div>
    </footer>
  );
}
