import { useEffect, useMemo, useState } from "react";
import { Coffee } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { usePwa } from "../store";
import { BRAND } from "@/lib/site";

export default function MenuScreen() {
  const { track } = usePwa();
  const menu = trpc.pwa.menu.useQuery(undefined, { staleTime: 120_000 });
  const [activeCat, setActiveCat] = useState("");

  useEffect(() => {
    track("pwa_menu_view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => menu.data?.categories ?? [], [menu.data]);
  const cat = categories.find((c) => c.name === activeCat) ?? categories[0];

  return (
    <div className="pt-6">
      <div className="px-4">
        <p className="font-display text-3xl font-extrabold uppercase">Меню</p>
        <p className="mt-1 text-xs" style={{ color: BRAND.sageDeep }}>
          {menu.data?.source === "quickresto"
            ? "позиции и цены — из Quick Resto"
            : "меню кофейни"}
        </p>
      </div>

      {/* Категории */}
      <div
        className="sticky top-0 z-10 mt-4 flex gap-2 overflow-x-auto px-4 pb-3 pt-1"
        style={{ background: BRAND.cream }}
      >
        {categories.map((c) => {
          const active = (cat?.name ?? "") === c.name;
          return (
            <button
              key={c.name}
              onClick={() => setActiveCat(c.name)}
              className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
              style={{
                background: active ? BRAND.pink : BRAND.white,
                color: BRAND.ink,
              }}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      {/* Позиции */}
      <div className="space-y-3 px-4 pt-2">
        {menu.isLoading &&
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-3xl"
              style={{ background: BRAND.creamDeep }}
            />
          ))}
        {cat?.items.map((item) => (
          <div
            key={item.id}
            className="flex gap-4 rounded-3xl p-4"
            style={{ background: BRAND.white }}
          >
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
              style={{ background: BRAND.creamDeep }}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Coffee size={26} style={{ color: BRAND.sageDeep }} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold uppercase leading-tight">
                {item.name}
              </p>
              {item.description && (
                <p
                  className="mt-1 line-clamp-2 text-xs leading-snug"
                  style={{ color: BRAND.sageDeep }}
                >
                  {item.description}
                </p>
              )}
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-lg font-extrabold">
                  {item.price != null ? `${item.price} ₽` : "—"}
                </p>
                {item.volume && (
                  <p className="text-xs" style={{ color: BRAND.sageDeep }}>
                    {item.volume}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        {!menu.isLoading && !cat?.items.length && (
          <p className="py-10 text-center text-sm" style={{ color: BRAND.sageDeep }}>
            Меню скоро появится
          </p>
        )}
      </div>
    </div>
  );
}
