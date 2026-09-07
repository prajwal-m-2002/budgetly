/**
 * Date and currency utility functions with timezone-safe local date operations.
 */

export function padZero(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Format a Date object as a local calendar string "YYYY-MM-DD".
 * Avoids UTC timezone shift errors by using local calendar components.
 */
export function toISODateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = padZero(date.getMonth() + 1);
  const day = padZero(date.getDate());
  return `${year}-${month}-${day}`;
}

/**
 * Parse "YYYY-MM-DD" into a local Date object.
 */
export function parseISODate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export interface DateRange {
  from: string; // "YYYY-MM-DD"
  to: string;   // "YYYY-MM-DD"
  label: string; // e.g. "September 2026"
  monthKey: string; // e.g. "2026-09"
  year: number;
  month: number; // 1-12
}

/**
 * Returns the range for the current calendar month based on reference date (defaults to today).
 * e.g. for Sep 7, 2026 => from: "2026-09-01", to: "2026-09-30", label: "September 2026"
 */
export function getCurrentMonthRange(refDate: Date = new Date()): DateRange {
  const year = refDate.getFullYear();
  const month = refDate.getMonth(); // 0-indexed
  const lastDay = new Date(year, month + 1, 0).getDate();

  const from = `${year}-${padZero(month + 1)}-01`;
  const to = `${year}-${padZero(month + 1)}-${padZero(lastDay)}`;
  const label = refDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const monthKey = `${year}-${padZero(month + 1)}`;

  return {
    from,
    to,
    label,
    monthKey,
    year,
    month: month + 1,
  };
}

/**
 * Returns the range for the previous calendar month.
 */
export function getPreviousMonthRange(refDate: Date = new Date()): DateRange {
  const year = refDate.getFullYear();
  const month = refDate.getMonth() - 1; // can be -1 for Dec prev year
  const prevDate = new Date(year, month, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth();
  const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();

  const from = `${prevYear}-${padZero(prevMonth + 1)}-01`;
  const to = `${prevYear}-${padZero(prevMonth + 1)}-${padZero(lastDay)}`;
  const label = prevDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const monthKey = `${prevYear}-${padZero(prevMonth + 1)}`;

  return {
    from,
    to,
    label,
    monthKey,
    year: prevYear,
    month: prevMonth + 1,
  };
}

/**
 * Returns the range for a specific "YYYY-MM" string.
 */
export function getSpecificMonthRange(monthKey: string): DateRange {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthStr); // 1-12
  const d = new Date(year, monthNum - 1, 1);
  const lastDay = new Date(year, monthNum, 0).getDate();

  const from = `${year}-${padZero(monthNum)}-01`;
  const to = `${year}-${padZero(monthNum)}-${padZero(lastDay)}`;
  const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return {
    from,
    to,
    label,
    monthKey,
    year,
    month: monthNum,
  };
}

/**
 * Returns the range for the current calendar year.
 */
export function getCurrentYearRange(refDate: Date = new Date()): { from: string; to: string; label: string } {
  const year = refDate.getFullYear();
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    label: `Year ${year}`,
  };
}

/**
 * Check if a date string ("YYYY-MM-DD") falls in the given range.
 */
export function isDateInRange(dateStr: string, from?: string, to?: string): boolean {
  if (!dateStr) return false;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

/**
 * Format month key "YYYY-MM" to readable name e.g. "September 2026".
 */
export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/**
 * Format INR currency cleanly with zero fallback.
 */
export function formatINR(amount: number | null | undefined): string {
  const num = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(num));
}
