import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { bookings, events, loftSlots } from "@db/schema";
import { getAllSettings } from "./settings";
import { getYearHolidays, isLoftRentableDate } from "./holidays";

export type LoftSlotId = "day" | "evening" | "fullday";
export type SlotStatus = "available" | "booked" | "blocked" | "past";

export function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Slots that exist for a given date — лофт работает по слотам «день»/«вечер» каждый день */
export function slotsForDate(_dateStr: string): LoftSlotId[] {
  return ["day", "evening"];
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function rangesOverlap(
  aStart: string,
  aHours: number,
  bStart: string,
  bHours: number,
): boolean {
  const a0 = toMinutes(aStart);
  const a1 = a0 + aHours * 60;
  const b0 = toMinutes(bStart);
  const b1 = b0 + bHours * 60;
  return a0 < b1 && b0 < a1;
}

export async function getMonthCalendar(month: string) {
  // month = "YYYY-MM"
  const db = getDb();
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${month}-${String(lastDay).padStart(2, "0")}`;

  const [slotRows, bookingRows, eventRows, s, holidaySet] = await Promise.all([
    db
      .select()
      .from(loftSlots)
      .where(and(gte(loftSlots.date, first), lte(loftSlots.date, last))),
    db
      .select()
      .from(bookings)
      .where(
        and(
          gte(bookings.date, first),
          lte(bookings.date, last),
          inArray(bookings.status, ["new", "confirmed"]),
        ),
      ),
    db
      .select()
      .from(events)
      .where(
        and(
          eq(events.isPublished, true),
          gte(events.date, first),
          lte(events.date, last),
        ),
      ),
    getAllSettings(),
    getYearHolidays(y),
  ]);

  const capacity = parseInt(s.coworking_capacity || "8", 10) || 8;
  const today = todayStr();

  const days: Record<
    string,
    {
      loft: Record<string, SlotStatus>;
      coworkingSeatsTaken: number;
      events: { id: number; title: string; time: string | null }[];
    }
  > = {};

  for (let d = 1; d <= lastDay; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const loft: Record<string, SlotStatus> = {};
    // Аренда лофта — только в выходные и праздники; в будни слоты закрыты,
    // если админ явно не открыл конкретный слот вручную
    const rentable = isWeekend(date) || holidaySet.has(date);
    for (const slot of slotsForDate(date)) {
      let status: SlotStatus = "available";
      if (date < today) status = "past";
      const override = slotRows.find(
        (r) => r.date === date && r.slot === slot,
      );
      if (override && override.status === "blocked") status = "blocked";
      if (
        !rentable &&
        status !== "past" &&
        !(override && override.status === "available")
      ) {
        status = "blocked";
      }
      const occupied = bookingRows.some(
        (b) =>
          b.type === "loft" &&
          b.date === date &&
          (b.slot === slot ||
            b.slot === "fullday" ||
            slot === "fullday"),
      );
      if (occupied && status !== "past") status = "booked";
      loft[slot] = status;
    }
    const coworkingSeatsTaken = bookingRows
      .filter((b) => b.type === "coworking" && b.date === date)
      .reduce((acc, b) => acc + (b.guests ?? 1), 0);
    days[date] = {
      loft,
      coworkingSeatsTaken,
      events: eventRows
        .filter((e) => e.date === date)
        .map((e) => ({ id: e.id, title: e.title, time: e.time })),
    };
  }

  const holidays = [...holidaySet].filter((d) => d.startsWith(month)).sort();

  return { days, capacity, holidays };
}

/** Check that a loft booking request can be accepted */
export async function checkLoftAvailability(
  date: string,
  slot: LoftSlotId,
): Promise<{ ok: boolean; reason?: string }> {
  if (date < todayStr()) return { ok: false, reason: "Дата уже прошла" };
  if (!slotsForDate(date).includes(slot)) {
    return { ok: false, reason: "Некорректный слот для этой даты" };
  }
  const db = getDb();
  // Любой override слота: админ может вручную закрыть слот в выходной
  // или, наоборот, открыть будний день под отдельную договорённость
  const overrides = await db
    .select()
    .from(loftSlots)
    .where(and(eq(loftSlots.date, date), eq(loftSlots.slot, slot)));
  const forcedOpen = overrides.some((o) => o.status === "available");
  if (!(await isLoftRentableDate(date)) && !forcedOpen) {
    return {
      ok: false,
      reason:
        "В будни лофт не арендуется — выберите выходной или праздничный день",
    };
  }
  if (overrides.some((o) => o.status === "blocked")) {
    return { ok: false, reason: "Слот закрыт администратором" };
  }
  const existing = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.type, "loft"),
        eq(bookings.date, date),
        inArray(bookings.status, ["new", "confirmed"]),
      ),
    );
  const clash = existing.some(
    (b) => b.slot === slot || b.slot === "fullday" || slot === "fullday",
  );
  if (clash) return { ok: false, reason: "Слот уже занят" };
  return { ok: true };
}

/** Check coworking capacity for a time range */
export async function checkCoworkingAvailability(
  date: string,
  startTime: string,
  hours: number,
  seats: number,
): Promise<{ ok: boolean; reason?: string }> {
  if (date < todayStr()) return { ok: false, reason: "Дата уже прошла" };
  const s = await getAllSettings();
  const capacity = parseInt(s.coworking_capacity || "8", 10) || 8;
  const db = getDb();
  const existing = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.type, "coworking"),
        eq(bookings.date, date),
        inArray(bookings.status, ["new", "confirmed"]),
      ),
    );
  let taken = 0;
  for (const b of existing) {
    if (!b.startTime || !b.hours) {
      taken += b.guests ?? 1;
      continue;
    }
    if (rangesOverlap(startTime, hours, b.startTime, b.hours)) {
      taken += b.guests ?? 1;
    }
  }
  if (taken + seats > capacity) {
    const left = Math.max(0, capacity - taken);
    return {
      ok: false,
      reason:
        left === 0
          ? "На это время мест нет"
          : `На это время свободно только ${left} мест(а)`,
    };
  }
  return { ok: true };
}
