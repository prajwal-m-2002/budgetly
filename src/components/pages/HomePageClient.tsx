"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingDown,
  TrendingUp,
  Wallet,
  Plus,
  LogOut,
  Settings,
  RefreshCw,
  CalendarDays,
  ArrowRight,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { TransactionModal } from "@/components/transactions/TransactionModal";
import { TransactionList } from "@/components/transactions/TransactionList";
import { DeleteConfirmDialog } from "@/components/transactions/DeleteConfirmDialog";
import { UndoToast } from "@/components/transactions/UndoToast";
import { BudgetProgressCard } from "@/components/dashboard/BudgetProgressCard";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  getTransactions,
  getActiveTransactionCount,
  getDashboardSummary,
  softDeleteTransaction,
  restoreTransaction,
} from "@/lib/supabase/transactions";
import { getCategories } from "@/lib/supabase/categories";
import { getCurrentMonthRange, formatINR, isDateInRange } from "@/lib/dateUtils";
import type { Transaction, DashboardSummary } from "@/types/database";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

function SummaryCard({
  label,
  amount,
  icon: Icon,
  variant,
}: {
  label: string;
  amount: number;
  icon: React.ElementType;
  variant: "expense" | "income" | "wallet";
}) {
  const isNegative = variant === "wallet" && amount < 0;

  const styles = {
    expense: {
      container: "border-expense/25 bg-card hover:border-expense/40",
      icon: "bg-expense-muted text-expense",
      amount: "text-expense",
    },
    income: {
      container: "border-income/25 bg-card hover:border-income/40",
      icon: "bg-income-muted text-income",
      amount: "text-income",
    },
    negativeWallet: {
      container: "border-expense/30 bg-card hover:border-expense/50",
      icon: "bg-expense-muted text-expense",
      amount: "text-expense",
    },
    positiveWallet: {
      container: "border-income/25 bg-card hover:border-income/40",
      icon: "bg-income-muted text-income",
      amount: "text-income",
    },
  };

  const s =
    variant === "expense"
      ? styles.expense
      : variant === "income"
      ? styles.income
      : isNegative
      ? styles.negativeWallet
      : styles.positiveWallet;

  return (
    <div className={cn("border rounded-2xl p-3 sm:p-4 flex flex-col gap-2 shadow-sm transition-all", s.container)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-tight">
          {label}
        </span>
        <div className={cn("w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center flex-shrink-0", s.icon)}>
          <Icon size={13} />
        </div>
      </div>
      <p className={cn("text-sm sm:text-base font-bold leading-none tabular-nums", s.amount)}>
        {variant === "wallet" && amount < 0 ? "−" : ""}
        {formatINR(amount)}
      </p>
    </div>
  );
}

export function HomePageClient() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  // Current month dynamic calculations for summary cards
  const monthRange = getCurrentMonthRange();

  // Data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [summary, setSummary] = useState<DashboardSummary>({ totalExpense: 0, totalIncome: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Undo toast state
  const [undoToast, setUndoToast] = useState<{ visible: boolean; txnId: string; label: string }>({
    visible: false,
    txnId: "",
    label: "",
  });

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
  const firstName = displayName.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Initial load: current month summary + all-months recent transactions
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Ensure categories exist
      await getCategories().catch((e) => console.warn("Category check:", e));

      // Dynamic current month boundary for summary calculations only
      const currentMonth = getCurrentMonthRange();

      // Parallel fetch: Monthly Summary (current month) + Recent Transactions (all months, newest first) + Total Count
      const [sum, txns, count] = await Promise.all([
        getDashboardSummary(currentMonth.from, currentMonth.to),
        getTransactions(PAGE_SIZE, 0),
        getActiveTransactionCount(),
      ]);

      setSummary(sum);
      setTransactions(txns);
      setTotalCount(count);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load more historical transactions
  async function handleLoadMore() {
    if (loadingMore || transactions.length >= totalCount) return;
    setLoadingMore(true);
    try {
      const nextBatch = await getTransactions(PAGE_SIZE, transactions.length);
      setTransactions((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newItems = nextBatch.filter((t) => !existingIds.has(t.id));
        return [...prev, ...newItems];
      });
    } catch (err) {
      console.error("Failed to load more transactions:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  function openAdd() {
    setEditTarget(null);
    setModalOpen(true);
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

      // Remove from Recent Transactions list
      setTransactions((prev) => prev.filter((t) => t.id !== deleted.id));
      setTotalCount((c) => Math.max(0, c - 1));

      // If deleted transaction is in the current month, recalculate current-month summary cards
      const currentMonth = getCurrentMonthRange();
      if (isDateInRange(deleted.date, currentMonth.from, currentMonth.to)) {
        const amt = Number(deleted.amount) || 0;
        setSummary((prev) => {
          if (deleted.type === "expense") {
            const newExp = prev.totalExpense - amt;
            return { ...prev, totalExpense: newExp, balance: prev.totalIncome - newExp };
          } else {
            const newInc = prev.totalIncome - amt;
            return { ...prev, totalIncome: newInc, balance: newInc - prev.totalExpense };
          }
        });
      }

      // Show undo
      setUndoToast({ visible: true, txnId: deleted.id, label: `"${deleted.description}" deleted` });
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
      await loadData(); // Refresh to show restored transaction and updated summary
    } catch (err) {
      console.error(err);
    }
  }

  const hasMore = transactions.length < totalCount;

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto lg:max-w-none lg:px-8 lg:py-8">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
              {greeting}, {firstName} 👋
            </h1>
            <span
              id="current-month-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20"
              title="Current Monthly Summary Period"
            >
              <CalendarDays size={12} />
              {monthRange.label}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-income-muted text-income text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-income animate-pulse" />
            Synced
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            aria-label="Refresh data"
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <RefreshCw size={15} className={cn(loading && "animate-spin")} />
          </button>
          <ThemeToggle />
          <div className="lg:hidden flex items-center gap-1">
            <Link
              href="/settings"
              aria-label="Settings"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <Settings size={16} />
            </Link>
            <button
              id="mobile-sign-out"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted text-muted-foreground hover:text-expense transition-all"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards — Current Month Only */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 h-20 animate-pulse" />
          ))
        ) : (
          <>
            <SummaryCard
              label="Total Expense"
              amount={summary.totalExpense}
              icon={TrendingDown}
              variant="expense"
            />
            <SummaryCard
              label="Total Income"
              amount={summary.totalIncome}
              icon={TrendingUp}
              variant="income"
            />
            <SummaryCard
              label="Total Wallet"
              amount={summary.balance}
              icon={Wallet}
              variant="wallet"
            />
          </>
        )}
      </div>

      {/* Monthly Budget Tracker — Tracks Current Month Expenses */}
      {!loading && (
        <BudgetProgressCard
          currentMonthlyExpense={summary.totalExpense}
          year={monthRange.year}
          month={monthRange.month}
        />
      )}

      {/* Recent Transactions — All Months History */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Recent Transactions</h2>
            <p className="text-[11px] text-muted-foreground">
              {loading ? (
                "Loading transactions..."
              ) : totalCount > 0 ? (
                totalCount > transactions.length ? (
                  `Showing latest ${transactions.length} of ${totalCount} transactions`
                ) : (
                  `${totalCount} transaction${totalCount !== 1 ? "s" : ""}`
                )
              ) : (
                "All history"
              )}
            </p>
          </div>
          <Link
            href="/analysis"
            className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 group"
          >
            <span>History</span>
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-muted rounded animate-pulse w-2/3" />
                  <div className="h-2.5 bg-muted rounded animate-pulse w-1/3" />
                </div>
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-4">
            <div className="text-4xl mb-3">🧾</div>
            <h3 className="text-sm font-semibold text-foreground mb-1">No transactions recorded yet</h3>
            <p className="text-xs text-muted-foreground max-w-xs mb-4">
              Tap <span className="font-semibold text-accent">+</span> to add your first expense or income.
            </p>
            <button
              onClick={openAdd}
              className="px-4 py-2 bg-accent text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-accent/90 transition-all"
            >
              + Add Transaction
            </button>
          </div>
        ) : (
          <div>
            <TransactionList
              transactions={transactions}
              onEdit={openEdit}
              onDelete={openDelete}
            />

            {/* Load More Button for Complete History */}
            {hasMore && (
              <div className="p-4 border-t border-border flex justify-center bg-card">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-accent" />
                      Loading older transactions...
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} />
                      Load More Transactions ({totalCount - transactions.length} remaining)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button
        id="fab-add-transaction"
        onClick={openAdd}
        aria-label="Add transaction"
        className={cn(
          "lg:hidden fixed bottom-20 right-4 z-50",
          "w-14 h-14 rounded-2xl bg-accent text-white shadow-lg shadow-accent/35",
          "flex items-center justify-center",
          "transition-all duration-200 hover:scale-105 active:scale-95"
        )}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* Desktop FAB */}
      <button
        id="fab-add-transaction-desktop"
        onClick={openAdd}
        aria-label="Add transaction"
        className={cn(
          "hidden lg:flex fixed bottom-8 right-8 z-50",
          "items-center gap-2.5 px-5 py-3 rounded-2xl",
          "bg-accent text-white shadow-lg shadow-accent/35 text-sm font-semibold",
          "transition-all duration-200 hover:scale-105 active:scale-95"
        )}
      >
        <Plus size={18} strokeWidth={2.5} />
        Add Transaction
      </button>

      {/* Transaction Modal */}
      <TransactionModal
        open={modalOpen}
        editTransaction={editTarget}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
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
