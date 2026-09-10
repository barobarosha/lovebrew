import { trpc } from "@/providers/trpc";
import { BRAND } from "@/lib/site";
import { Users, Activity, MousePointerClick } from "lucide-react";

export function AnalyticsTab({ token }: { token: string }) {
  const stats = trpc.admin.appStats.useQuery({ token, }, { refetchInterval: 60_000 });
  const customers = trpc.admin.customers.useQuery({ token });

  if (stats.isLoading) {
    return <p className="py-10 text-center text-sm opacity-60">Считаем метрики…</p>;
  }
  const d = stats.data;
  if (!d) return null;

  const maxFunnel = Math.max(1, ...d.funnel.map((f) => f.count));
  const maxDay = Math.max(1, ...d.eventsByDay.map((e) => e.count));

  return (
    <div className="space-y-6">
      {/* Метрики */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "DAU", value: d.dau, hint: "активные за день" },
          { label: "WAU", value: d.wau, hint: "активные за неделю" },
          { label: "MAU", value: d.mau, hint: "активные за месяц" },
          { label: "Клиенты", value: d.totalCustomers, hint: "всего в приложении" },
        ].map((m) => (
          <div key={m.label} className="rounded-3xl p-5" style={{ background: BRAND.white }}>
            <p className="font-display text-xs font-bold uppercase tracking-wider" style={{ color: BRAND.sageDeep }}>
              {m.label}
            </p>
            <p className="font-display mt-2 text-4xl font-extrabold">{m.value}</p>
            <p className="mt-1 text-xs opacity-50">{m.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Воронка */}
        <section className="rounded-3xl p-6" style={{ background: BRAND.white }}>
          <h3 className="font-display flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: BRAND.sageDeep }}>
            <MousePointerClick className="h-4 w-4" /> Воронка за 30 дней
          </h3>
          <div className="mt-4 space-y-2">
            {d.funnel.map((f) => (
              <div key={f.event}>
                <div className="flex justify-between text-xs font-semibold">
                  <span>{f.label}</span>
                  <span>{f.count}</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full" style={{ background: BRAND.creamDeep }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(f.count / maxFunnel) * 100}%`, background: BRAND.sageDeep }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-4 text-xs">
            {(d.bookingsBySource.length ? d.bookingsBySource : [{ source: "—", count: 0 }]).map((b) => (
              <span key={b.source} className="rounded-full px-3 py-1 font-semibold" style={{ background: BRAND.cream }}>
                {b.source === "pwa" ? "из приложения" : b.source === "site" ? "с сайта" : b.source}: {b.count}
              </span>
            ))}
          </div>
        </section>

        {/* Активность по дням */}
        <section className="rounded-3xl p-6" style={{ background: BRAND.white }}>
          <h3 className="font-display flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: BRAND.sageDeep }}>
            <Activity className="h-4 w-4" /> События за 14 дней
          </h3>
          <div className="mt-4 flex h-32 items-end gap-1.5">
            {d.eventsByDay.length === 0 && (
              <p className="text-sm opacity-50">Данных пока нет — появятся после первых запусков приложения</p>
            )}
            {d.eventsByDay.map((e) => (
              <div key={e.day} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${Math.max(4, (e.count / maxDay) * 100)}%`,
                    background: BRAND.sage,
                  }}
                  title={`${e.day}: ${e.count}`}
                />
                <span className="text-[9px] opacity-50">{e.day.slice(8)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Клиенты */}
      <section className="rounded-3xl p-6" style={{ background: BRAND.white }}>
        <h3 className="font-display flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: BRAND.sageDeep }}>
          <Users className="h-4 w-4" /> Клиенты приложения ({customers.data?.length ?? 0})
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase opacity-50">
                <th className="pb-2 pr-4">Имя</th>
                <th className="pb-2 pr-4">Телефон</th>
                <th className="pb-2 pr-4">Quick Resto</th>
                <th className="pb-2">Регистрация</th>
              </tr>
            </thead>
            <tbody>
              {customers.data?.map((c) => (
                <tr key={c.id} className="border-t" style={{ borderColor: BRAND.creamDeep }}>
                  <td className="py-2.5 pr-4 font-semibold">{c.name || "—"}</td>
                  <td className="py-2.5 pr-4">+{c.phone}</td>
                  <td className="py-2.5 pr-4">
                    {c.qrCustomerGuid ? (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: BRAND.sage }}>
                        связан
                      </span>
                    ) : (
                      <span className="text-xs opacity-40">нет</span>
                    )}
                  </td>
                  <td className="py-2.5 text-xs opacity-60">
                    {new Date(c.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))}
              {!customers.data?.length && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm opacity-50">
                    Клиентов пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
