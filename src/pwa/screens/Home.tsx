import { useState } from "react";
import QRCode from "react-qr-code";
import { ArrowRight, CalendarDays, Coffee, MapPin, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { usePwa } from "../store";
import { BRAND, formatDateRu } from "@/lib/site";

export default function HomeScreen() {
  const { customerToken, setTab, openLogin, openBooking, track } = usePwa();
  const [qrOpen, setQrOpen] = useState(false);
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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: BRAND.sageDeep }}
              >
                {customer.name || "Ваши бонусы"}
              </p>
              <p
                className="font-display mt-1 text-4xl font-extrabold"
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
              onClick={() => {
                track("pwa_qr_shown");
                setQrOpen(true);
              }}
              className="w-[112px] shrink-0 rounded-2xl p-2.5"
              style={{ background: BRAND.cream }}
              title="Нажмите, чтобы увеличить код для кассы"
            >
              <QRCode
                value={`lavbrew:${customer.phone}`}
                size={96}
                fgColor={BRAND.ink}
                bgColor={BRAND.cream}
                style={{ width: "100%", height: "auto" }}
              />
              <p
                className="mt-1.5 text-center text-[10px] font-medium leading-tight"
                style={{ color: BRAND.sageDeep }}
              >
                код на кассе · нажмите, чтобы увеличить
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
          onClick={openBooking}
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

      {/* Увеличенный QR для кассы */}
      {qrOpen && customer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl p-6 text-center"
            style={{ background: BRAND.white }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-sm font-bold uppercase">
                Карта гостя
              </p>
              <button
                onClick={() => setQrOpen(false)}
                className="rounded-full p-2"
                style={{ background: BRAND.cream }}
              >
                <X size={16} />
              </button>
            </div>
            <div
              className="mx-auto w-fit rounded-2xl p-4"
              style={{ background: BRAND.cream }}
            >
              <QRCode
                value={`lavbrew:${customer.phone}`}
                size={240}
                fgColor={BRAND.ink}
                bgColor={BRAND.cream}
                style={{ width: "100%", height: "auto", maxWidth: 240 }}
              />
            </div>
            <p className="mt-3 text-sm font-bold">{customer.phoneFormatted}</p>
            <p className="mt-1 text-xs" style={{ color: BRAND.sageDeep }}>
              Покажите код бариста — бонусы начислятся на этот номер.
              Совет: прибавьте яркость экрана, так сканер считает быстрее.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
