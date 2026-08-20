import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  BRAND,
  currentMonth,
  formatMonth,
  isWeekendDate,
  shiftMonth,
} from "@/lib/site";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

export function SlotsTab({ token }: { token: string }) {
  const [month, setMonth] = useState(currentMonth());
  const cal = trpc.admin.slotsCalendar.useQuery({ token, month });
  const utils = trpc.useUtils();
  const setSlot = trpc.admin.setSlot.useMutation({
    onSuccess: () => {
      utils.admin.slotsCalendar.invalidate();
      utils.site.calendar.invalidate();
    },
  });

  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const arr: (string | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++)
      arr.push(`${month}-${String(d).padStart(2, "0")}`);
    return arr;
  }, [month]);

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm opacity-70">
        Управляйте доступностью лофта: нажмите на слот, чтобы закрыть его для
        бронирования (например, для уборки или своего мероприятия), или
        открыть снова. Заявки клиентов занимают слоты автоматически.
      </p>

      <div className="overflow-hidden rounded-3xl" style={{ background: BRAND.white }}>
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: BRAND.sage }}
        >
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-full p-2 hover:bg-white/30">
            <ChevronLeft />
          </button>
          <p className="font-display text-xl font-bold">{formatMonth(month)}</p>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="rounded-full p-2 hover:bg-white/30">
            <ChevronRight />
          </button>
        </div>

        <div className="grid grid-cols-7 px-3 pt-3 sm:px-5">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className="pb-2 text-center text-[10px] font-bold tracking-widest"
              style={{ color: i >= 5 ? "#C4654F" : BRAND.sageDeep }}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5 px-3 pb-4 sm:gap-2 sm:px-5">
          {cells.map((date, i) => {
            if (!date) return <div key={`e${i}`} />;
            const d = cal.data?.days[date];
            const dayNum = parseInt(date.slice(-2), 10);
            const weekend = isWeekendDate(date);
            return (
              <div
                key={date}
                className="min-h-20 rounded-xl border p-1.5 sm:min-h-28 sm:rounded-2xl sm:p-2"
                style={{ borderColor: BRAND.creamDeep, background: BRAND.cream }}
              >
                <p className="font-display text-xs font-bold sm:text-sm" style={{ color: weekend ? "#C4654F" : BRAND.ink }}>
                  {dayNum}
                </p>
                <div className="mt-1 flex flex-col gap-1">
                  {d &&
                    Object.entries(d.loft).map(([slot, st]) => {
                      if (st === "past") return null;
                      const isBlocked = st === "blocked";
                      const isBooked = st === "booked";
                      return (
                        <button
                          key={slot}
                          disabled={isBooked || setSlot.isPending}
                          title={
                            isBooked
                              ? "Слот занят заявкой — управляйте через вкладку «Заявки»"
                              : isBlocked
                                ? "Нажмите, чтобы открыть слот"
                                : "Нажмите, чтобы закрыть слот"
                          }
                          onClick={() =>
                            setSlot.mutate({
                              token,
                              date,
                              slot: slot as "day" | "evening" | "fullday",
                              status: isBlocked ? "available" : "blocked",
                            })
                          }
                          className="rounded-md px-1.5 py-1 text-left text-[9px] font-bold uppercase leading-tight tracking-wide transition sm:text-[10px]"
                          style={{
                            background: isBooked
                              ? "#C4654F"
                              : isBlocked
                                ? "#B9B4A4"
                                : BRAND.sage,
                            color: isBooked ? "#fff" : BRAND.ink,
                            opacity: isBooked ? 0.85 : 1,
                          }}
                        >
                          {slot === "day" ? "день" : slot === "evening" ? "вечер" : "будни"}:{" "}
                          {isBooked ? "занят" : isBlocked ? "закрыт" : "свободен"}
                        </button>
                      );
                    })}
                </div>
                {d && d.events.length > 0 && (
                  <p className="mt-1 text-[9px] font-semibold" style={{ color: BRAND.sageDeep }}>
                    ★ {d.events.length} меропр.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs font-semibold opacity-80">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded" style={{ background: BRAND.sage }} /> свободен
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded" style={{ background: "#C4654F" }} /> занят заявкой
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded" style={{ background: "#B9B4A4" }} /> закрыт вами
        </span>
      </div>
    </div>
  );
}
