import { useMemo, useState } from "react";
import { BRAND, useReveal, useSiteContent } from "@/lib/site";

export function MenuSection() {
  const ref = useReveal<HTMLElement>();
  const content = useSiteContent();
  const menu = content.data?.menu ?? [];

  const categories = useMemo(
    () => [...new Set(menu.map((m) => m.category))],
    [menu],
  );
  const [active, setActive] = useState<string | null>(null);
  const current = active ?? categories[0] ?? null;
  const items = menu.filter((m) => m.category === current);

  return (
    <section id="menu" ref={ref} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <h2 className="font-display text-3xl font-bold sm:text-5xl">
          МЕНЮ,
          <br />
          <span style={{ color: BRAND.sageDeep }}>ОТ КОТОРОГО ТЕПЛО</span>
        </h2>
        <div className="overflow-hidden rounded-3xl" style={{ width: 200 }}>
          <img
            src="/images/coffee.jpg"
            alt="Кофе в Лавбрю"
            className="aspect-[3/2] w-full object-cover"
            loading="lazy"
          />
        </div>
      </div>

      {categories.length > 1 && (
        <div className="no-scrollbar mb-8 flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className="shrink-0 rounded-full px-5 py-2.5 font-display text-xs font-semibold uppercase tracking-wider transition-all"
              style={{
                background: current === c ? BRAND.ink : BRAND.white,
                color: current === c ? BRAND.cream : BRAND.ink,
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p className="rounded-3xl p-8 text-center opacity-60" style={{ background: BRAND.white }}>
          Меню скоро появится — администратор ещё не добавил позиции.
        </p>
      )}

      <div className="grid gap-x-10 gap-y-1 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-baseline gap-3 border-b py-4"
            style={{ borderColor: BRAND.creamDeep }}
          >
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold leading-snug sm:text-base">
                {item.name}
                {item.volume && (
                  <span className="ml-2 text-xs font-medium opacity-50">
                    {item.volume}
                  </span>
                )}
              </p>
              {item.description && (
                <p className="mt-1 text-sm leading-snug opacity-60">
                  {item.description}
                </p>
              )}
            </div>
            <span
              className="mx-1 flex-1 border-b border-dotted"
              style={{ borderColor: BRAND.sage }}
            />
            <span className="font-display shrink-0 text-base font-bold">
              {item.price} ₽
            </span>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm opacity-60">
        В день аренды лофта — скидка 20% на напитки по промокоду ЛЮБЛЮЛАВБРЮ
      </p>
    </section>
  );
}
