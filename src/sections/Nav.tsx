import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BRAND, useSiteContent } from "@/lib/site";
import { useBooking } from "@/components/booking/BookingProvider";

const LINKS = [
  ["Лофт", "#loft"],
  ["Коворкинг", "#coworking"],
  ["Детская", "#kids"],
  ["Меню", "#menu"],
  ["Афиша", "#events"],
  ["Календарь", "#calendar"],
  ["Контакты", "#contacts"],
] as const;

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { openBooking } = useBooking();
  const content = useSiteContent();
  const phone = content.data?.settings.phone ?? "+7 (933) 913-18-18";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(244,241,232,0.9)" : "transparent",
        backdropFilter: scrolled ? "blur(14px)" : "none",
        borderBottom: scrolled ? `1px solid ${BRAND.creamDeep}` : "none",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <a href="#top" className="flex flex-col leading-none">
          <span
            className="font-display text-lg font-bold tracking-wide"
            style={{ color: BRAND.ink }}
          >
            ЛАВБРЮ
          </span>
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.28em]"
            style={{ color: BRAND.sageDeep }}
          >
            лофт · праздники · кофе
          </span>
        </a>

        <nav className="hidden items-center gap-6 lg:flex">
          {LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-semibold uppercase tracking-wide opacity-70 transition-opacity hover:opacity-100"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={`tel:${phone.replace(/[^+\d]/g, "")}`}
            className="text-sm font-bold"
            style={{ color: BRAND.ink }}
          >
            {phone}
          </a>
          <button
            onClick={() => openBooking({ type: "loft" })}
            className="rounded-full px-5 py-2.5 text-sm font-bold uppercase tracking-wide transition-transform hover:scale-105"
            style={{ background: BRAND.ink, color: BRAND.cream }}
          >
            Забронировать
          </button>
        </div>

        <button
          className="lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Меню"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div
          className="border-t px-6 py-4 lg:hidden"
          style={{ background: BRAND.cream, borderColor: BRAND.creamDeep }}
        >
          <div className="flex flex-col gap-4">
            {LINKS.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="font-display text-lg"
              >
                {label}
              </a>
            ))}
            <button
              onClick={() => {
                setOpen(false);
                openBooking({ type: "loft" });
              }}
              className="mt-2 rounded-full px-5 py-3 text-sm font-bold uppercase"
              style={{ background: BRAND.ink, color: BRAND.cream }}
            >
              Забронировать
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
