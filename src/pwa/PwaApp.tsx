import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Coffee,
  Gift,
  CalendarDays,
  User,
  Home as HomeIcon,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import {
  PwaContext,
  getCustomerToken,
  getSessionKey,
  setCustomerToken,
  type PwaTab,
} from "./store";
import { BRAND } from "@/lib/site";
import HomeScreen from "./screens/Home";
import MenuScreen from "./screens/Menu";
import BonusesScreen from "./screens/Bonuses";
import EventsScreen, { BookingSheet } from "./screens/Events";
import ProfileScreen from "./screens/Profile";
import LoginScreen from "./screens/Login";

const TABS: { id: PwaTab; label: string; icon: typeof HomeIcon }[] = [
  { id: "home", label: "Главная", icon: HomeIcon },
  { id: "menu", label: "Меню", icon: Coffee },
  { id: "bonuses", label: "Бонусы", icon: Gift },
  { id: "events", label: "Афиша", icon: CalendarDays },
  { id: "profile", label: "Профиль", icon: User },
];

export default function PwaApp() {
  const [tab, setTab] = useState<PwaTab>("home");
  const [customerToken, setTokenState] = useState(getCustomerToken());
  const [loginOpen, setLoginOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);

  const trackMutation = trpc.pwa.track.useMutation();
  const track = useCallback(
    (event: string, meta?: Record<string, string | number>) => {
      trackMutation.mutate({
        event,
        sessionKey: getSessionKey(),
        token: getCustomerToken() || undefined,
        meta,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    track("pwa_open");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      tab,
      setTab,
      customerToken,
      setCustomerToken: (t: string) => {
        setCustomerToken(t);
        setTokenState(t);
      },
      track,
      openLogin: () => setLoginOpen(true),
      openBooking: () => {
        track("pwa_booking_start");
        setBookingOpen(true);
      },
      closeBooking: () => setBookingOpen(false),
      bookingOpen,
    }),
    [tab, customerToken, track, bookingOpen],
  );

  const authed = customerToken.length >= 10;

  return (
    <PwaContext.Provider value={value}>
      <div
        className="min-h-dvh w-full"
        style={{ background: BRAND.cream, color: BRAND.ink }}
      >
        {/* Мобильный холст по центру на десктопе */}
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col relative shadow-2xl shadow-black/5">
          <main className="flex-1 pb-24">
            {tab === "home" && <HomeScreen />}
            {tab === "menu" && <MenuScreen />}
            {tab === "bonuses" &&
              (authed ? <BonusesScreen /> : <LoginScreen inline />)}
            {tab === "events" && <EventsScreen />}
            {tab === "profile" &&
              (authed ? <ProfileScreen /> : <LoginScreen inline />)}
          </main>

          {/* Нижняя навигация */}
          <nav
            className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t px-2 pb-[env(safe-area-inset-bottom)]"
            style={{
              background: BRAND.white,
              borderColor: BRAND.creamDeep,
            }}
          >
            <div className="grid grid-cols-5">
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className="flex flex-col items-center gap-1 py-2.5"
                    style={{ color: active ? BRAND.ink : BRAND.sageDeep }}
                  >
                    <span
                      className="flex h-9 w-14 items-center justify-center rounded-full transition-colors"
                      style={{
                        background: active ? BRAND.pink : "transparent",
                      }}
                    >
                      <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                    </span>
                    <span className="text-[10px] font-semibold tracking-wide">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          {loginOpen && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
              <div className="w-full max-w-md">
                <LoginScreen onClose={() => setLoginOpen(false)} />
              </div>
            </div>
          )}

          {bookingOpen && <BookingSheet onClose={() => setBookingOpen(false)} />}
        </div>
      </div>
    </PwaContext.Provider>
  );
}
