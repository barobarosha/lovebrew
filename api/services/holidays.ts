/**
 * Официальные нерабочие праздничные дни РФ (производственный календарь).
 *
 * Основной источник — бесплатный API isdayoff.ru (запросы сервер→сервер,
 * ключи не нужны). Ответ — XML вида <day d="MMdd" t="N"/>, где t="1" —
 * нерабочий день (учтены и переносы выходных по постановлениям Правительства).
 *
 * При недоступности API используется встроенный fallback-список
 * (по Постановлениям Правительства РФ № 1466 от 24.09.2025 для 2026 г.
 * и № 1187 от 17.09.2026 для 2027 г.; для 2028 — только закреплённые
 * ст. 112 ТК РФ праздники, т.к. переносы ещё не утверждены).
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

type YearCache = { holidays: Set<string>; fetchedAt: number };
const cache = new Map<number, YearCache>();

/**
 * Нерабочие праздничные дни, приходящиеся на будни ("MM-DD").
 * Субботы/воскресенья не перечислены — они считаются отдельно.
 */
const FALLBACK_WEEKDAY_HOLIDAYS: Record<number, string[]> = {
  2026: [
    "01-01", "01-02", "01-05", "01-06", "01-07", "01-08", "01-09",
    "02-23", "03-09", "05-01", "05-11", "06-12", "11-04", "12-31",
  ],
  2027: [
    "01-01", "01-04", "01-05", "01-06", "01-07", "01-08",
    "02-22", "02-23", "03-08", "05-03", "05-10", "06-14",
    "11-04", "11-05", "12-31",
  ],
  // 2028: переносы выходных ещё не утверждены — только праздники по ст. 112 ТК РФ
  2028: [
    "01-03", "01-04", "01-05", "01-06", "01-07",
    "02-23", "03-08", "05-01", "05-09", "06-12",
  ],
};

function isWeekendDate(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

function fallbackHolidays(year: number): Set<string> {
  const list = FALLBACK_WEEKDAY_HOLIDAYS[year] ?? [];
  return new Set(list.map((md) => `${year}-${md}`));
}

async function fetchFromIsDayOff(year: number): Promise<Set<string> | null> {
  try {
    const res = await fetch(
      `https://isdayoff.ru/api/getdata?year=${year}&cc=ru`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    const xml = await res.text();
    const days = new Set<string>();
    const tagRe = /<day\b[^>]*>/g;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(xml)) !== null) {
      const tag = m[0];
      const d = /d="(\d{4})"/.exec(tag)?.[1];
      const t = /t="(\d+)"/.exec(tag)?.[1];
      // t="1" — нерабочий день; t="2" — сокращённый предпраздничный (рабочий)
      if (d && t === "1") {
        days.add(`${year}-${d.slice(0, 2)}-${d.slice(2)}`);
      }
    }
    return days.size > 0 ? days : null;
  } catch {
    return null;
  }
}

/** Нерабочие праздничные даты года ("YYYY-MM-DD"), с кэшем и fallback */
export async function getYearHolidays(year: number): Promise<Set<string>> {
  const hit = cache.get(year);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.holidays;
  const fetched = await fetchFromIsDayOff(year);
  const holidays = fetched ?? fallbackHolidays(year);
  cache.set(year, { holidays, fetchedAt: Date.now() });
  return holidays;
}

/** Отсортированный список праздничных дат года — для отдачи на клиент */
export async function getYearHolidayDates(year: number): Promise<string[]> {
  return [...(await getYearHolidays(year))].sort();
}

export async function isHoliday(date: string): Promise<boolean> {
  const year = Number(date.slice(0, 4));
  if (!Number.isFinite(year)) return false;
  return (await getYearHolidays(year)).has(date);
}

/** Доступна ли аренда лофта в эту дату: суббота/воскресенье или праздник */
export async function isLoftRentableDate(date: string): Promise<boolean> {
  return isWeekendDate(date) || (await isHoliday(date));
}
