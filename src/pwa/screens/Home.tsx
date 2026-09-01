import QRCode from "react-qr-code";
import { ArrowRight, CalendarDays, Coffee, MapPin, Sparkles } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { usePwa } from "../store";
import { BRAND, formatDateRu } from "@/lib/site";

export default function HomeScreen() {
  const { customerToken, setTab, openLogin, track } = usePwa();
  const home = trpc.pwa.home.useQuery(
    { token: customerToken || undefined },
    { staleTime: 30_000 },
  );
  const s = home.data?.settings ?? {};
  const customer = home.data?.customer ?? null;

  return (
    <div className="px-4 pt-6">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div>
          <p
            className="font-display text-3xl font-extrabold uppercase leading-none"
            style={{ color: BRAND.ink }}
          >
            Лавбрю
          </p>
          <p
            className="mt-1 text-[11px] font-semibold uppercase tracking-[0.25em]"
            style={{ color: BRAND.sageDeep }}
          >
            лофт · праздники · кофе
          </p>
        </div>
        <a
          href="/"
          className="rounded-full px-3 py-2 text-xs font-semibold"
          style={{ background: BRAND.creamDeep, color: BRAND.ink }}
        >
          Сайт →
        </a>
      </div>

      {/* Карточка бонусов / приглашение войти */}
      {customer ? (
        <div
          className="mt-5 rounded-3xl p-5"
          style={{ background: BRAND.white }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: BRAND.sageDeep }}
              >
                {customer.name || "Ваши бонусы"}
              </p>
              <p
                className="font-display mt-1 text-5xl font-extrabold"
                style={{ color: BRAND.ink }}
              >
                {home.data?.bonusesConnected ? (home.data.balance ?? 0) : "—"}
              </p>
              <p className="mt-1 text-sm" style={{ color: BRAND.sageDeep }}>
                бонусов · 1 бонус = 1 ₽
              </p>
              {!home.data?.bonusesConnected && (
                <p className="mt-2 text-xs" style={{ color: BRAND.sageDeep }}>
                  Баланс подтянется из Quick Resto после подключения интеграции
                </p>
              )}
            </div>
            <button
              onClick={() => track("pwa_qr_shown")}
              className="rounded-2xl p-3"
              style={{ background: BRAND.cream }}
              title="Покажите код на кассе"
            >
              <QRCode
                value={`lavbrew:${customer.phone}`}
                size={86}
                fgColor={BRAND.ink}
                bgColor={BRAND.cream}
              />
              <p
                className="mt-2 text-center text-[10px] font-medium"
                style={{ color: BRAND.sageDeep }}
              >
                код на кассе
              </p>
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={openLogin}
          className="mt-5 w-full rounded-3xl p-5 text-left"
          style={{ background: BRAND.ink }}
        >
          <p className="font-display text-xl font-bold uppercase text-white">
            Войти по телефону
          </p>
          <p className="mt-1 text-sm" style={{ color: BRAND.creamDeep }}>
            Бонусы, история броней и быстрая запись — внутри
          </p>
        </button>
      )}

      {/* Быстрые действия */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => setTab("events")}
          className="rounded-3xl p-4 text-left"
          style={{ background: BRAND.pink }}
        >
          <CalendarDays size={22} />
          <p className="font-display mt-3 text-sm font-bold uppercase leading-tight">
            Забронировать
          </p>
          <p className="mt-0.5 text-xs" style={{ color: BRAND.ink }}>
            лофт · коворкинг · детская
          </p>
        </button>
        <button
          onClick={() => setTab("menu")}
          className="rounded-3xl p-4 text-left"
          style={{ background: BRAND.sage }}
        >
          <Coffee size={22} />
          <p className="font-display mt-3 text-sm font-bold uppercase leading-tight">
            Меню
          </p>
          <p className="mt-0.5 text-xs" style={{ color: BRAND.ink }}>
            кофе, десерты, завтраки
          </p>
        </button>
      </div>

      {/* Акции */}
      {(s.promo_text || s.offer_3plus1) && (
        <div className="mt-4 space-y-2">
          {s.promo_text && (
            <div
              className="flex items-start gap-3 rounded-2xl p-4"
              style={{ background: BRAND.white }}
            >
              <Sparkles size={18} className="mt-0.5 shrink-0" />
              <p className="text-sm leading-snug">{s.promo_text}</p>
            </div>
          )}
          {s.offer_3plus1 && (
            <div
              className="flex items-start gap-3 rounded-2xl p-4"
              style={{ background: BRAND.creamDeep }}
            >
              <Sparkles size={18} className="mt-0.5 shrink-0" />
              <p className="text-sm leading-snug">{s.offer_3plus1}</p>
            </div>
          )}
        </div>
      )}

      {/* Ближайшие события */}
      {!!home.data?.upcomingEvents?.length && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-lg font-bold uppercase">Афиша</p>
            <button
              onClick={() => setTab("events")}
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: BRAND.sageDeep }}
            >
              все <ArrowRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {home.data.upcomingEvents.map((e) => (
              <div
                key={e.id}
                className="rounded-2xl p-4"
                style={{ background: BRAND.white }}
              >
                <p className="text-xs font-semibold" style={{ color: BRAND.sageDeep }}>
                  {formatDateRu(e.date)}
                  {e.time ? ` · ${e.time}` : ""}
                </p>
                <p className="mt-1 font-bold">{e.title}</p>
                {e.price && (
                  <p className="mt-1 text-sm" style={{ color: BRAND.sageDeep }}>
                    {e.price}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Контакты */}
      <a
        href={`https://yandex.ru/maps/?text=${encodeURIComponent("Красногорск, " + (s.address ?? ""))}`}
        target="_blank"
        rel="noreferrer"
        className="mt-6 flex items-center gap-3 rounded-2xl p-4"
        style={{ background: BRAND.white }}
      >
        <MapPin size={18} className="shrink-0" />
        <div>
          <p className="text-sm font-semibold">{s.address}</p>
          <p className="text-xs" style={{ color: BRAND.sageDeep }}>
            будни {s.hours_weekday} · выходные {s.hours_weekend}
          </p>
        </div>
      </a>
    </div>
  );
}
