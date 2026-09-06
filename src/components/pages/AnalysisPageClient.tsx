"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, TrendingDown, TrendingUp, BarChart2, Zap, RefreshCw } from "lucide-react";
import { ExpenseDonutChart, SpendingOverTimeChart } from "@/components/analysis/Charts";
import { getAnalyticsData, getDateRange, type AnalyticsData, type FilterType } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const formatINR = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/* ── Filter Bar ── */
interface FilterBarProps {
  filter: FilterType;
  customFrom: string;
  customTo: string;
  onFilterChange: (f: FilterType) => void;
  onCustomChange: (from: string, to: string) => void;
}

function FilterBar({ filter, customFrom, customTo, onFilterChange, onCustomChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(["today", "month", "custom"] as FilterType[]).map((f) => (
        <button
          key={f}
          onClick={() => onFilterChange(f)}
          className={cn(
            "px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all duration-150",
            filter === f
              ? "bg-accent text-white shadow-sm shadow-accent/20"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          {f === "today" ? "Today" : f === "month" ? "This Month" : "Custom"}
        </button>
      ))}

      {filter === "custom" && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">From</span>
            <input
              type="date"
              value={customFrom}
              max={customTo || today()}
              onChange={(e) => onCustomChange(e.target.value, customTo)}
              className={cn(
                "px-2.5 py-1.5 rounded-xl text-xs",
                "bg-muted border border-border text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-accent"
              )}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">To</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={today()}
              onChange={(e) => onCustomChange(customFrom, e.target.value)}
              className={cn(
                "px-2.5 py-1.5 rounded-xl text-xs",
                "bg-muted border border-border text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-accent"
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}22`, color }}>
          <Icon size={14} />
        </div>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

/* ── Main Page ── */
export function AnalysisPageClient() {
  const [filter, setFilter]       = useState<FilterType>("month");
  const [customFrom, setCustomFrom] = useState(monthStart());
  const [customTo, setCustomTo]     = useState(today());
  const [data, setData]             = useState<AnalyticsData | null>(null);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(filter, customFrom, customTo);
      const result = await getAnalyticsData(from, to);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  function handleFilterChange(f: FilterType) {
    setFilter(f);
    if (f === "month") { setCustomFrom(monthStart()); setCustomTo(today()); }
    if (f === "today") { setCustomFrom(today()); setCustomTo(today()); }
  }

  const periodLabel = filter === "today" ? "Today" : filter === "month"
    ? new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : `${customFrom} → ${customTo}`;

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto lg:max-w-4xl lg:px-8 lg:py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Analysis</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{periodLabel}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          aria-label="Refresh"
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground transition-all flex-shrink-0"
        >
          <RefreshCw size={15} className={cn(loading && "animate-spin")} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="mb-6">
        <FilterBar
          filter={filter}
          customFrom={customFrom}
          customTo={customTo}
          onFilterChange={handleFilterChange}
          onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
        />
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 h-20 animate-pulse" />
          ))
        ) : (
          <>
            <StatCard label="Total Expense"    value={formatINR(data?.totalExpense ?? 0)}    icon={TrendingDown} color="var(--color-expense)" />
            <StatCard label="Total Income"     value={formatINR(data?.totalIncome ?? 0)}     icon={TrendingUp}   color="var(--color-income)"  />
            <StatCard label="Avg Daily Spend"  value={formatINR(data?.avgDailySpending ?? 0)} icon={Calendar}     color="#6366f1" />
            <StatCard label="Transactions"     value={String(data?.transactionCount ?? 0)}   icon={BarChart2}    color="#f97316" />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Donut chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Expense Breakdown</h2>
          {loading ? (
            <div className="h-52 bg-muted rounded-xl animate-pulse" />
          ) : (
            <ExpenseDonutChart data={data?.categoryBreakdown ?? []} />
          )}
        </div>

        {/* Bar chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Spending Over Time</h2>
          {loading ? (
            <div className="h-52 bg-muted rounded-xl animate-pulse" />
          ) : (
            <SpendingOverTimeChart data={data?.dailySpending ?? []} />
          )}
        </div>
      </div>

      {/* Category Breakdown table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Category Breakdown</h2>
          {data?.highestCategory && (
            <span className="text-xs text-muted-foreground">
              Highest: <span className="font-semibold text-foreground">{data.highestCategory.icon} {data.highestCategory.name}</span>
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-muted animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
                  <div className="h-2 bg-muted rounded animate-pulse w-full" />
                </div>
                <div className="h-3 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : !data || data.categoryBreakdown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-3xl mb-2">📊</div>
            <p className="text-sm text-muted-foreground">No expense data for this period.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {data.categoryBreakdown.map((cat) => (
              <div key={cat.categoryId ?? cat.name} className="flex items-center gap-3 px-5 py-3.5">
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                  style={{ backgroundColor: `${cat.color}22` }}
                >
                  {cat.icon}
                </div>

                {/* Name + bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{cat.name}</span>
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{cat.count} txn{cat.count !== 1 ? "s" : ""}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>

                {/* Amount + % */}
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-semibold text-foreground">{formatINR(cat.total)}</p>
                  <p className="text-xs text-muted-foreground">{cat.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Insights card */}
      {data && data.transactionCount > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              <Zap size={14} />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Insights</h2>
          </div>
          <div className="space-y-2.5">
            {data.highestCategory && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground">🔥</span>
                <span className="text-foreground">
                  Your biggest spending category is{" "}
                  <span className="font-semibold">{data.highestCategory.icon} {data.highestCategory.name}</span>
                  {" "}at{" "}
                  <span className="font-semibold text-expense">{formatINR(data.highestCategory.total)}</span>
                  {" "}({data.highestCategory.percentage}% of total expenses).
                </span>
              </div>
            )}
            {data.avgDailySpending > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground">📅</span>
                <span className="text-foreground">
                  You spend an average of{" "}
                  <span className="font-semibold text-expense">{formatINR(data.avgDailySpending)}</span>
                  {" "}per day in this period.
                </span>
              </div>
            )}
            {data.balance >= 0 ? (
              <div className="flex items-start gap-2 text-sm">
                <span>✅</span>
                <span className="text-foreground">
                  You saved{" "}
                  <span className="font-semibold text-income">{formatINR(data.balance)}</span>
                  {" "}this period. Keep it up!
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm">
                <span>⚠️</span>
                <span className="text-foreground">
                  Your expenses exceeded income by{" "}
                  <span className="font-semibold text-expense">{formatINR(Math.abs(data.balance))}</span>
                  {" "}this period.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
