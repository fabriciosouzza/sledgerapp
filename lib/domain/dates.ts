// Calendar arithmetic on ISO strings. Everything is done in UTC on purpose: a
// `date` has no time and no zone, and the only "now" the app needs is today's
// date in America/Sao_Paulo (PROMPT.md §2).

import { formatInTimeZone } from "date-fns-tz";
import type { IsoDate, Period } from "./types";

export const TIME_ZONE = "America/Sao_Paulo";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const PERIOD = /^(\d{4})-(\d{2})$/;

export function isIsoDate(value: string): value is IsoDate {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function isPeriod(value: string): value is Period {
  const m = PERIOD.exec(value);
  if (!m) return false;
  const month = Number(m[2]);
  return month >= 1 && month <= 12;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function toIsoDate(year: number, month: number, day: number): IsoDate {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function toPeriodString(year: number, month: number): Period {
  return `${year}-${pad(month)}`;
}

export function parseIsoDate(date: IsoDate): { year: number; month: number; day: number } {
  const m = ISO_DATE.exec(date);
  if (!m) throw new RangeError(`not an ISO date: ${date}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function parsePeriod(period: Period): { year: number; month: number } {
  const m = PERIOD.exec(period);
  if (!m) throw new RangeError(`not a period: ${period}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Today's date where the user lives, regardless of the server's zone. */
export function today(now: Date = new Date()): IsoDate {
  return formatInTimeZone(now, TIME_ZONE, "yyyy-MM-dd");
}

/** `2026-11-05` → `2026-11` */
export function periodOf(date: IsoDate): Period {
  return date.slice(0, 7);
}

/** `2026-11` → `2026-11-01` — how the `period` column stores it. */
export function periodStart(period: Period): IsoDate {
  const { year, month } = parsePeriod(period);
  return toIsoDate(year, month, 1);
}

export function periodEnd(period: Period): IsoDate {
  const { year, month } = parsePeriod(period);
  return toIsoDate(year, month, daysInMonth(year, month));
}

export function addMonths(period: Period, months: number): Period {
  const { year, month } = parsePeriod(period);
  const index = year * 12 + (month - 1) + months;
  return toPeriodString(Math.floor(index / 12), (index % 12) + 1);
}

/** Inclusive list of periods from `from` to `to`. */
export function periodRange(from: Period, to: Period): Period[] {
  const out: Period[] = [];
  for (let p = from; p <= to; p = addMonths(p, 1)) out.push(p);
  return out;
}

/**
 * Day-of-month clamping (§5.5): due day 31 in a short month becomes its last
 * day. Unit tested against February.
 */
export function clampDay(period: Period, day: number): IsoDate {
  const { year, month } = parsePeriod(period);
  return toIsoDate(year, month, Math.min(Math.max(day, 1), daysInMonth(year, month)));
}

export function dayOf(date: IsoDate): number {
  return parseIsoDate(date).day;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const { year, month, day } = parseIsoDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Signed number of days from `from` to `to`. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / 86_400_000);
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** `2026-11-05` → `05/11/2026` (pt-BR formatting, §2). */
export function formatDate(date: IsoDate): string {
  const { year, month, day } = parseIsoDate(date);
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** `2026-11-05` → `05/11`, for tiles where the year is obvious. */
export function formatDayMonth(date: IsoDate): string {
  const { month, day } = parseIsoDate(date);
  return `${pad(day)}/${pad(month)}`;
}

/** `2026-11` → `Nov/26` — the preview format in §7 (`Oct/26 → Sep/27`). */
export function formatPeriodShort(period: Period): string {
  const { year, month } = parsePeriod(period);
  return `${MONTHS_SHORT[month - 1]}/${year.toString().slice(-2)}`;
}

/** `2026-11` → `November 2026` */
export function formatPeriodLong(period: Period): string {
  const { year, month } = parsePeriod(period);
  return `${MONTHS_LONG[month - 1]} ${year}`;
}
