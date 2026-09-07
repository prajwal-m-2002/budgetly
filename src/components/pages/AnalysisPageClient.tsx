"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  TrendingDown,
  TrendingUp,
  BarChart2,
  Zap,
  RefreshCw,
  History,
  ChevronRight,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  ReceiptText,
} from "lucide-react";
import { ExpenseDonutChart, SpendingOverTimeChart } from "@/components/analysis/Charts";
import { TransactionList } from "@/components/transactions/TransactionList";
import { TransactionModal } from "@/components/transactions/TransactionModal";
import { DeleteConfirmDialog } from "@/components/transactions/DeleteConfirmDialog";
import { UndoToast } from "@/components/transactions/UndoToast";
import {
  getAnalyticsData,
  getDateRange,
  type AnalyticsData,
  type FilterType,
  type MonthlySummaryItem,
} from "@/lib/analytics";
import { softDeleteTransaction, restoreTransaction } from "@/lib/supabase/transactions";
import { getCategories } from "@/lib/supabase/categories";
import { formatINR, toISODateString, getCurrentMonthRange } from "@/lib/dateUtils";
import type { Transaction, Category, TransactionType } from "@/types/database";
import { cn } from "@/lib/utils";

/* ── Filter Bar ── */
interface FilterBarProps {
  filter: FilterType;
  customFrom: string;
  customTo: string;
  selectedMonthKey: string;
  onFilterChange: (f: FilterType) => void;
  onCustomChange: (from: string, to: string) => void;
}

const FILTER_PRESETS: { id: FilterType; label: string }[] = [
  { id: "this_month", label: "This Month" },
  { id: "prev_month", label: "Previous Month" },
  { id: "this_year", label: "This Year" },
  { id: "all", label: "All Time" },
  { id: "custom", label: "Custom" },
];

function FilterBar({
  filter,
  customFrom,
  customTo,
  selectedMonthKey,
  onFilterChange,
  onCustomChange,
}: FilterBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_PRESETS.map((f) => (
          <button
            key={f.id}
            id={`filter-btn-${f.id}`}
            onClick={() => onFilterChange(f.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150",
              filter === f.id
                ? "bg-accent text-white shadow-sm shadow-accent/25"
                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
            )}
          >
            {f.label}
          </button>
        ))}

        {filter === "month_select" && (
          <div className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent/15 text-accent border border-accent/30 flex items-center gap-1.5">
            <span>Filtered: {selectedMonthKey}</span>
            <button
              onClick={() => onFilterChange("this_month")}
              className="text-muted-foreground hover:text-foreground font-bold ml-1"
              title="Clear month filter"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {filter === "custom" && (
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">From</span>
            <input
              type="date"
              value={customFrom}
              max={customTo || toISODateString()}
              onChange={(e) => onCustomChange(e.target.value, customTo)}
              className="px-2.5 py-1.5 rounded-xl text-xs bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">To</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={(e) => onCustomChange(customFrom, e.target.value)}
              className="px-2.5 py-1.5 rounded-xl text-xs bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  highlightNegative = false,
  isNegative = false,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  highlightNegative?: boolean;
  isNegative?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}20`, color }}
        >
          <Icon size={14} />
        </div>
        <span className="text-xs text-muted-foreground font-medium truncate">{label}</span>
      </div>
      <p
        className={cn(
          "text-base sm:text-lg font-bold tabular-nums truncate",
          highlightNegative && isNegative ? "text-expense" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

/* ── Main Page ── */
export function AnalysisPageClient() {
  const currentMonth = getCurrentMonthRange();

  const [filter, setFilter] = useState<FilterType>("this_month");
  const [customFrom, setCustomFrom] = useState(currentMonth.from);
  const [customTo, setCustomTo] = useState(toISODateString());
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("");

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and sub-filter for History table
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Modal / Delete / Undo state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [undoToast, setUndoToast] = useState<{ visible: boolean; txnId: string; label: string }>({
    visible: false,
    txnId: "",
    label: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(filter, {
        customFrom,
        customTo,
        selectedMonthKey,
      });
      const [result, cats] = await Promise.all([
        getAnalyticsData(from, to),
        getCategories().catch(() => []),
      ]);
      setData(result);
      setCategories(cats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter, customFrom, customTo, selectedMonthKey]);

  useEffect(() => {
    load();
  }, [load]);

  function handleFilterChange(f: FilterType) {
    setFilter(f);
    setSelectedMonthKey("");
    if (f === "this_month") {
      const cur = getCurrentMonthRange();
      setCustomFrom(cur.from);
      setCustomTo(toISODateString());
    }
  }

  function handleSelectMonth(monthKey: string) {
    setSelectedMonthKey(monthKey);
    setFilter("month_select");
  }

  function openEdit(t: Transaction) {
    setEditTarget(t);
    setModalOpen(true);
  }

  function openDelete(t: Transaction) {
    setDeleteTarget(t);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await softDeleteTransaction(deleteTarget.id);
      const deleted = deleteTarget;
      setDeleteTarget(null);
      setUndoToast({ visible: true, txnId: deleted.id, label: `"${deleted.description}" deleted` });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  }

  async function handleUndo() {
    if (!undoToast.txnId) return;
    setUndoToast((p) => ({ ...p, visible: false }));
    try {
      await restoreTransaction(undoToast.txnId);
      await load();
    } catch (err) {
      console.error(err);
    }
  }

  // Filtered transactions for the History section
  const historyTransactions = useMemo(() => {
    const rawList = data?.transactions ?? [];
    return rawList.filter((t) => {
      // Type match
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      // Category match
      if (categoryFilter !== "all" && (t.category_id ?? "uncategorized") !== categoryFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = (t.description || "").toLowerCase().includes(q);
        const matchFrom = (t.received_from || "").toLowerCase().includes(q);
        const matchNote = (t.note || "").toLowerCase().includes(q);
        const matchCat = (t.categories?.name || "").toLowerCase().includes(q);
        const matchAmt = String(t.amount).includes(q);
        return matchDesc || matchFrom || matchNote || matchCat || matchAmt;
      }
      return true;
    });
  }, [data, typeFilter, categoryFilter, searchQuery]);

  const { label: activePeriodLabel } = getDateRange(filter, {
    customFrom,
    customTo,
    selectedMonthKey,
  });

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto lg:max-w-5xl lg:px-8 lg:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Financial Analysis & History</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <span>Period:</span>
            <span className="font-semibold text-foreground">{activePeriodLabel}</span>
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          aria-label="Refresh analysis"
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground transition-all flex-shrink-0"
        >
          <RefreshCw size={15} className={cn(loading && "animate-spin")} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          <Filter size={13} className="text-accent" />
          <span>Select Period</span>
        </div>
        <FilterBar
          filter={filter}
          customFrom={customFrom}
          customTo={customTo}
          selectedMonthKey={selectedMonthKey}
          onFilterChange={handleFilterChange}
          onCustomChange={(f, t) => {
            setCustomFrom(f);
            setCustomTo(t);
          }}
        />
      </div>

      {/* Totals Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 h-20 animate-pulse" />
          ))
        ) : (
          <>
            <StatCard
              label="Total Income"
              value={formatINR(data?.totalIncome ?? 0)}
              icon={TrendingUp}
              color="var(--color-income)"
            />
            <StatCard
              label="Total Expense"
              value={formatINR(data?.totalExpense ?? 0)}
              icon={TrendingDown}
              color="var(--color-expense)"
            />
            <StatCard
              label="Net Balance"
              value={`${(data?.balance ?? 0) < 0 ? "−" : ""}${formatINR(data?.balance ?? 0)}`}
              icon={Calendar}
              color={(data?.balance ?? 0) >= 0 ? "var(--color-income)" : "var(--color-expense)"}
              highlightNegative
              isNegative={(data?.balance ?? 0) < 0}
            />
            <StatCard
              label="Transactions"
              value={String(data?.transactionCount ?? 0)}
              icon={BarChart2}
              color="#6366f1"
            />
          </>
        )}
      </div>

      {/* Monthly Summary Section — Historical Totals by Month */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Monthly Summary</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {data?.monthlySummaries?.length
              ? `${data.monthlySummaries.length} recorded month${data.monthlySummaries.length > 1 ? "s" : ""}`
              : ""}
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !data || data.monthlySummaries.length === 0 ? (
          <div className="p-10 text-center text-xs text-muted-foreground">
            No historical monthly records found yet.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {data.monthlySummaries.map((m: MonthlySummaryItem) => {
              const isSelected = filter === "month_select" && selectedMonthKey === m.monthKey;
              const isCurrent = m.monthKey === currentMonth.monthKey;

              return (
                <div
                  key={m.monthKey}
                  onClick={() => handleSelectMonth(m.monthKey)}
                  className={cn(
                    "px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all hover:bg-muted/40 group",
                    isSelected && "bg-accent/10 hover:bg-accent/15 border-l-4 border-l-accent"
                  )}
                >
                  {/* Month info */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-bold text-xs text-foreground group-hover:bg-accent group-hover:text-white transition-colors">
                      {m.monthKey.slice(5)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{m.monthLabel}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent">
                            Current
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent text-white">
                            Viewing
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.transactionCount} transaction{m.transactionCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Monthly Numbers */}
                  <div className="flex items-center justify-between sm:justify-end gap-5 text-xs">
                    {/* Income */}
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-muted-foreground block uppercase font-medium">Income</span>
                      <span className="font-semibold text-income tabular-nums flex items-center sm:justify-end gap-0.5">
                        <ArrowUpRight size={11} />
                        {formatINR(m.totalIncome)}
                      </span>
                    </div>

                    {/* Expense */}
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-muted-foreground block uppercase font-medium">Expense</span>
                      <span className="font-semibold text-expense tabular-nums flex items-center sm:justify-end gap-0.5">
                        <ArrowDownRight size={11} />
                        {formatINR(m.totalExpense)}
                      </span>
                    </div>

                    {/* Balance */}
                    <div className="text-left sm:text-right min-w-[75px]">
                      <span className="text-[10px] text-muted-foreground block uppercase font-medium">Balance</span>
                      <span
                        className={cn(
                          "font-bold tabular-nums",
                          m.balance >= 0 ? "text-income" : "text-expense"
                        )}
                      >
                        {m.balance < 0 ? "−" : ""}
                        {formatINR(m.balance)}
                      </span>
                    </div>

                    <ChevronRight
                      size={16}
                      className={cn(
                        "text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5 hidden sm:block",
                        isSelected && "text-accent"
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Expense Breakdown</h2>
            <span className="text-xs text-muted-foreground">{activePeriodLabel}</span>
          </div>
          {loading ? (
            <div className="h-52 bg-muted rounded-xl animate-pulse" />
          ) : (
            <ExpenseDonutChart data={data?.categoryBreakdown ?? []} />
          )}
        </div>

        {/* Bar chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Spending Over Time</h2>
            <span className="text-xs text-muted-foreground">{activePeriodLabel}</span>
          </div>
          {loading ? (
            <div className="h-52 bg-muted rounded-xl animate-pulse" />
          ) : (
            <SpendingOverTimeChart data={data?.dailySpending ?? []} />
          )}
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Category Breakdown</h2>
          {data?.highestCategory && (
            <span className="text-xs text-muted-foreground">
              Highest:{" "}
              <span className="font-semibold text-foreground">
                {data.highestCategory.icon} {data.highestCategory.name}
              </span>
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
            <p className="text-sm text-muted-foreground">No expense data recorded for this period.</p>
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
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                      {cat.count} txn{cat.count !== 1 ? "s" : ""}
                    </span>
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

      {/* Interactive History Transaction List with Search & Filters */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ReceiptText size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Transaction History</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {historyTransactions.length} of {data?.transactionCount ?? 0} records
            </span>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            {/* Search Box */}
            <div className="relative w-full sm:flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search description, payee, note, amount..."
                className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground font-bold"
                >
                  ×
                </button>
              )}
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center gap-1 w-full sm:w-auto">
              {(["all", "expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all",
                    typeFilter === t
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "all" ? "All Types" : t}
                </button>
              ))}
            </div>

            {/* Category Dropdown */}
            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : historyTransactions.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            {searchQuery || typeFilter !== "all" || categoryFilter !== "all"
              ? "No transactions match the search/filter criteria."
              : "No transactions recorded for the selected period."}
          </div>
        ) : (
          <TransactionList
            transactions={historyTransactions}
            onEdit={openEdit}
            onDelete={openDelete}
          />
        )}
      </div>

      {/* Insights Card */}
      {data && data.transactionCount > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              <Zap size={14} />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Insights for {activePeriodLabel}</h2>
          </div>
          <div className="space-y-2.5">
            {data.highestCategory && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground">🔥</span>
                <span className="text-foreground">
                  Biggest spending category:{" "}
                  <span className="font-semibold">
                    {data.highestCategory.icon} {data.highestCategory.name}
                  </span>{" "}
                  at <span className="font-semibold text-expense">{formatINR(data.highestCategory.total)}</span> (
                  {data.highestCategory.percentage}% of total expenses).
                </span>
              </div>
            )}
            {data.avgDailySpending > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground">📅</span>
                <span className="text-foreground">
                  Average daily spending:{" "}
                  <span className="font-semibold text-expense">{formatINR(data.avgDailySpending)}</span> per active
                  day.
                </span>
              </div>
            )}
            {data.balance >= 0 ? (
              <div className="flex items-start gap-2 text-sm">
                <span>✅</span>
                <span className="text-foreground">
                  Net savings of{" "}
                  <span className="font-semibold text-income">{formatINR(data.balance)}</span> in this period.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm">
                <span>⚠️</span>
                <span className="text-foreground">
                  Expenses exceeded income by{" "}
                  <span className="font-semibold text-expense">{formatINR(Math.abs(data.balance))}</span> in this
                  period.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit/Add Modal */}
      <TransactionModal
        open={modalOpen}
        editTransaction={editTarget}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />

      {/* Delete Confirm */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        description={deleteTarget?.description ?? ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      {/* Undo Toast */}
      <UndoToast
        visible={undoToast.visible}
        message={undoToast.label}
        onUndo={handleUndo}
        onDismiss={() => setUndoToast((p) => ({ ...p, visible: false }))}
      />
    </div>
  );
}
