import { getTransactionsByRange } from "@/lib/supabase/transactions";
import type { Transaction } from "@/types/database";

export type FilterType = "today" | "month" | "custom";

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
  date: string;       // "DD MMM"
  expense: number;
  income: number;
}

export async function getAnalyticsData(
  from: string,
  to: string
): Promise<AnalyticsData> {
  const transactions = await getTransactionsByRange(from, to);

  const expenses = transactions.filter((t) => t.type === "expense");
  const incomes  = transactions.filter((t) => t.type === "income");

  const totalExpense = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome  = incomes.reduce((s, t) => s + Number(t.amount), 0);

  // Category breakdown
  const catMap: Record<string, CategoryBreakdown> = {};
  for (const t of expenses) {
    const key = t.category_id ?? "uncategorized";
    if (!catMap[key]) {
      catMap[key] = {
        categoryId: t.category_id,
        name:  t.categories?.name  ?? "Other",
        icon:  t.categories?.icon  ?? "📦",
        color: t.categories?.color ?? "#6b7280",
        total: 0,
        percentage: 0,
        count: 0,
      };
    }
    catMap[key].total += Number(t.amount);
    catMap[key].count += 1;
  }

  const categoryBreakdown = Object.values(catMap)
    .map((c) => ({
      ...c,
      percentage: totalExpense > 0 ? Math.round((c.total / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Daily spending (group by date)
  const dailyMap: Record<string, { expense: number; income: number }> = {};
  for (const t of transactions) {
    if (!dailyMap[t.date]) dailyMap[t.date] = { expense: 0, income: 0 };
    if (t.type === "expense") dailyMap[t.date].expense += Number(t.amount);
    else dailyMap[t.date].income += Number(t.amount);
  }

  const dailySpending: DailySpending[] = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date: new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      }),
      ...vals,
    }));

  // Number of unique days with expenses
  const uniqueDays = new Set(expenses.map((t) => t.date)).size;
  const avgDailySpending = uniqueDays > 0 ? totalExpense / uniqueDays : 0;

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
  };
}

/** Returns ISO date strings for common filter ranges */
export function getDateRange(filter: FilterType, customFrom?: string, customTo?: string) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (filter === "today") {
    const t = fmt(now);
    return { from: t, to: t };
  }
  if (filter === "month") {
    const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const to = fmt(now);
    return { from, to };
  }
  if (filter === "custom" && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }
  // Default: current month
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  return { from, to: fmt(now) };
}
