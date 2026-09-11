import { createContext, useContext } from "react";
import { trpc } from "@/providers/trpc";

const TOKEN_KEY = "lavbrew_customer_token";
const SESSION_KEY = "lavbrew_pwa_session";

export function getCustomerToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setCustomerToken(token: string) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Анонимный ключ сессии для аналитики (до входа по телефону) */
export function getSessionKey(): string {
  let k = localStorage.getItem(SESSION_KEY);
  if (!k) {
    k = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(SESSION_KEY, k);
  }
  return k;
}

export type PwaTab = "home" | "menu" | "bonuses" | "events" | "profile";

export interface PwaContextValue {
  tab: PwaTab;
  setTab: (t: PwaTab) => void;
  customerToken: string;
  setCustomerToken: (t: string) => void;
  track: (event: string, meta?: Record<string, string | number>) => void;
  openLogin: () => void;
  /** Открыть шторку бронирования (лофт/коворкинг/детская) из любого экрана */
  openBooking: () => void;
  closeBooking: () => void;
  bookingOpen: boolean;
}

export const PwaContext = createContext<PwaContextValue>({
  tab: "home",
  setTab: () => {},
  customerToken: "",
  setCustomerToken: () => {},
  track: () => {},
  openLogin: () => {},
  openBooking: () => {},
  closeBooking: () => {},
  bookingOpen: false,
});

export function usePwa() {
  return useContext(PwaContext);
}

/** Профиль текущего клиента (если есть токен) */
export function useMe() {
  const { customerToken } = usePwa();
  return trpc.pwa.me.useQuery(
    { token: customerToken },
    { enabled: customerToken.length >= 10, retry: false, staleTime: 30_000 },
  );
}
