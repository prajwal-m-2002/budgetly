import { getAllActiveTransactions } from "@/lib/supabase/transactions";
import {
  getCurrentMonthRange,
  getPreviousMonthRange,
  getCurrentYearRange,
  getSpecificMonthRange,
  formatMonthKey,
} from "@/lib/dateUtils";
import type { Transaction } from "@/types/database";

export type FilterType = "this_month" | "prev_month" | "this_year" | "all" | "custom" | "month_select";

export interface MonthlySummaryItem {
  monthKey: string; // "YYYY-MM"
  monthLabel: string; // e.g. "September 2026"
  year: number;
  month: number; // 1-12
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
}

export interface CategoryBreakdown {
  categoryId: string | null;
  name: string;
  icon: string;
  color: string;
  total: number;
  percentage: number;
  count: number;
}

export interface DailySpending {
  date: string; // Formatted date e.g. "7 Sep" or "Sep 2026"
  rawDate: string; // "YYYY-MM-DD"
  expense: number;
  income: number;
}

export interface AnalyticsData {
  transactions: Transaction[];
  totalExpense: number;
  totalIncome: number;
  balance: number;
  categoryBreakdown: CategoryBreakdown[];
  dailySpending: DailySpending[];
  highestCategory: CategoryBreakdown | null;
  avgDailySpending: number;
  transactionCount: number;
  monthlySummaries: MonthlySummaryItem[];
}

/**
 * Group all transactions by Year-Month (e.g. "2026-09", "2026-08", "2025-09")
 * preserving distinct years and calculating totals.
 */
export function getHistoricalMonthlySummaries(transactions: Transaction[]): MonthlySummaryItem[] {
  const monthMap: Record<string, { totalIncome: number; totalExpense: number; count: number }> = {};

  for (const t of transactions) {
    if (!t.date) continue;
    const monthKey = t.date.slice(0, 7); // "YYYY-MM"
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = { totalIncome: 0, totalExpense: 0, count: 0 };
    }
    const amt = Number(t.amount) || 0;
    if (t.type === "expense") {
      monthMap[monthKey].totalExpense += amt;
    } else {
      monthMap[monthKey].totalIncome += amt;
    }
    monthMap[monthKey].count += 1;
  }

  // Sort descending by monthKey (e.g. 2026-09, 2026-08, 2026-07...)
  const keys = Object.keys(monthMap).sort((a, b) => b.localeCompare(a));

  return keys.map((key) => {
    const [yearStr, monthStr] = key.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const item = monthMap[key];
    const totalIncome = item.totalIncome;
    const totalExpense = item.totalExpense;
    const balance = totalIncome - totalExpense;

    return {
      monthKey: key,
      monthLabel: formatMonthKey(key),
      year,
      month,
      totalIncome,
      totalExpense,
      balance,
      transactionCount: item.count,
    };
  });
}

/**
 * Compute aggregate analytics for a list of transactions.
 */
export function computeAnalyticsFromTransactions(
  transactions: Transaction[],
  allHistoricalTransactions: Transaction[] = transactions
): AnalyticsData {
  const expenses = transactions.filter((t) => t.type === "expense");
  const incomes = transactions.filter((t) => t.type === "income");

  const totalExpense = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalIncome = incomes.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  // Category breakdown
  const catMap: Record<string, CategoryBreakdown> = {};
  for (const t of expenses) {
    const key = t.category_id ?? "uncategorized";
    if (!catMap[key]) {
      catMap[key] = {
        categoryId: t.category_id,
        name: t.categories?.name ?? "Other",
        icon: t.categories?.icon ?? "📦",
        color: t.categories?.color ?? "#6b7280",
        total: 0,
        percentage: 0,
        count: 0,
      };
    }
    catMap[key].total += Number(t.amount) || 0;
    catMap[key].count += 1;
  }

  const categoryBreakdown = Object.values(catMap)
    .map((c) => ({
      ...c,
      percentage: totalExpense > 0 ? Math.round((c.total / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Daily / timeline spending
  const dailyMap: Record<string, { expense: number; income: number }> = {};
  for (const t of transactions) {
    if (!t.date) continue;
    if (!dailyMap[t.date]) dailyMap[t.date] = { expense: 0, income: 0 };
    const amt = Number(t.amount) || 0;
    if (t.type === "expense") dailyMap[t.date].expense += amt;
    else dailyMap[t.date].income += amt;
  }

  const dailySpending: DailySpending[] = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rawDate, vals]) => {
      const [y, m, d] = rawDate.split("-").map(Number);
      const dateObj = new Date(y, (m || 1) - 1, d || 1);
      return {
        date: dateObj.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
        rawDate,
        ...vals,
      };
    });

  // Unique days with expenses for average daily spend calculation
  const uniqueExpenseDays = new Set(expenses.map((t) => t.date)).size;
  const avgDailySpending = uniqueExpenseDays > 0 ? totalExpense / uniqueExpenseDays : 0;

  // Compute monthly history across all historical data
  const monthlySummaries = getHistoricalMonthlySummaries(allHistoricalTransactions);

  return {
    transactions,
    totalExpense,
    totalIncome,
    balance: totalIncome - totalExpense,
    categoryBreakdown,
    dailySpending,
    highestCategory: categoryBreakdown[0] ?? null,
    avgDailySpending,
    transactionCount: transactions.length,
    monthlySummaries,
  };
}

/**
 * Fetch analytics data from Supabase according to date boundaries.
 */
export async function getAnalyticsData(from?: string, to?: string): Promise<AnalyticsData> {
  // Always fetch all active transactions to build the complete monthly history summary
  const allHistorical = await getAllActiveTransactions();

  let filteredTransactions: Transaction[];
  if (from && to) {
    // If range matches cached or we can filter in-memory from allHistorical
    filteredTransactions = allHistorical.filter(
      (t) => t.date && t.date >= from && t.date <= to
    );
  } else if (from) {
    filteredTransactions = allHistorical.filter((t) => t.date && t.date >= from);
  } else if (to) {
    filteredTransactions = allHistorical.filter((t) => t.date && t.date <= to);
  } else {
    filteredTransactions = allHistorical;
  }

  return computeAnalyticsFromTransactions(filteredTransactions, allHistorical);
}

/**
 * Returns date range parameters for given filter type.
 */
export function getDateRange(
  filter: FilterType,
  options?: { customFrom?: string; customTo?: string; selectedMonthKey?: string }
): { from?: string; to?: string; label: string } {
  if (filter === "this_month") {
    const cur = getCurrentMonthRange();
    return { from: cur.from, to: cur.to, label: cur.label };
  }

  if (filter === "prev_month") {
    const prev = getPreviousMonthRange();
    return { from: prev.from, to: prev.to, label: prev.label };
  }

  if (filter === "this_year") {
    const yr = getCurrentYearRange();
    return { from: yr.from, to: yr.to, label: yr.label };
  }

  if (filter === "month_select" && options?.selectedMonthKey) {
    const sel = getSpecificMonthRange(options.selectedMonthKey);
    return { from: sel.from, to: sel.to, label: sel.label };
  }

  if (filter === "custom" && options?.customFrom && options?.customTo) {
    return {
      from: options.customFrom,
      to: options.customTo,
      label: `${options.customFrom} → ${options.customTo}`,
    };
  }

  if (filter === "all") {
    return { label: "All Time" };
  }

  // Default to this month
  const def = getCurrentMonthRange();
  return { from: def.from, to: def.to, label: def.label };
}
