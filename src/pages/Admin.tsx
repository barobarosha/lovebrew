import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { BRAND } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Lock, LogOut } from "lucide-react";
import { BookingsTab } from "./admin/BookingsTab";
import { SlotsTab } from "./admin/SlotsTab";
import { EventsTab } from "./admin/EventsTab";
import { MenuTab } from "./admin/MenuTab";
import { SettingsTab } from "./admin/SettingsTab";
import { AnalyticsTab } from "./admin/AnalyticsTab";

const TOKEN_KEY = "lavbrew_admin_token";

export function useAdminToken() {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const setToken = (t: string | null) => {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
    setTokenState(t);
  };
  return { token, setToken };
}

export default function Admin() {
  const { token, setToken } = useAdminToken();
  const check = trpc.admin.check.useQuery(
    { token: token ?? "" },
    { enabled: !!token, retry: false },
  );

  useEffect(() => {
    document.title = "Админка — Лавбрю";
  }, []);

  if (!token || check.isError) {
    if (check.isError && token) setToken(null);
    return <LoginScreen onLogin={setToken} />;
  }
  if (check.isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: BRAND.cream }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND.sageDeep }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: BRAND.cream, color: BRAND.ink }}>
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: BRAND.white, borderColor: BRAND.creamDeep }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-bold">ЛАВБРЮ</span>
            <span
              className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
              style={{ background: BRAND.sage, color: BRAND.ink }}
            >
              админка
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm font-semibold opacity-60 hover:opacity-100">
              ← На сайт
            </a>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setToken(null)}
            >
              <LogOut className="mr-1 h-4 w-4" /> Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Tabs defaultValue="bookings">
          <TabsList className="mb-6 flex h-auto flex-wrap justify-start gap-1 rounded-2xl p-1" style={{ background: BRAND.creamDeep }}>
            {[
              ["bookings", "Заявки"],
              ["slots", "Слоты лофта"],
              ["events", "Афиша"],
              ["menu", "Меню"],
              ["analytics", "Аналитика"],
              ["settings", "Настройки"],
            ].map(([v, l]) => (
              <TabsTrigger
                key={v}
                value={v}
                className="rounded-xl font-display text-xs font-semibold uppercase tracking-wider data-[state=active]:shadow"
              >
                {l}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="bookings">
            <BookingsTab token={token} />
          </TabsContent>
          <TabsContent value="slots">
            <SlotsTab token={token} />
          </TabsContent>
          <TabsContent value="events">
            <EventsTab token={token} />
          </TabsContent>
          <TabsContent value="menu">
            <MenuTab token={token} />
          </TabsContent>
          <TabsContent value="analytics">
            <AnalyticsTab token={token} />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab token={token} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (t: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = trpc.admin.login.useMutation({
    onSuccess: (r) => onLogin(r.token),
    onError: (e) => setError(e.message),
  });

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: BRAND.cream }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-8"
        style={{ background: BRAND.white, boxShadow: "0 20px 60px -30px rgba(47,49,40,0.35)" }}
      >
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: BRAND.sage }}
        >
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="font-display text-center text-xl font-bold">
          Вход в админку
        </h1>
        <p className="mt-1 text-center text-sm opacity-60">
          Кофейня-лофт «Лавбрю»
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            login.mutate({ password });
          }}
        >
          <Input
            type="password"
            placeholder="Пароль администратора"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl"
            autoFocus
          />
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-full"
            style={{ background: BRAND.ink, color: BRAND.cream }}
          >
            {login.isPending ? "Проверяем…" : "Войти"}
          </Button>
        </form>
      </div>
    </div>
  );
}
