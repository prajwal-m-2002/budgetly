"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingDown, TrendingUp, Wallet, Plus, LogOut, Settings, RefreshCw } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { TransactionModal } from "@/components/transactions/TransactionModal";
import { TransactionList } from "@/components/transactions/TransactionList";
import { DeleteConfirmDialog } from "@/components/transactions/DeleteConfirmDialog";
import { UndoToast } from "@/components/transactions/UndoToast";
import { BudgetProgressCard } from "@/components/dashboard/BudgetProgressCard";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  getTransactions,
  getDashboardSummary,
  softDeleteTransaction,
  restoreTransaction,
} from "@/lib/supabase/transactions";
import { getCategories } from "@/lib/supabase/categories";
import type { Transaction, DashboardSummary } from "@/types/database";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

function SummaryCard({
  label,
  amount,
  icon: Icon,
  variant,
}: {
  label: string;
  amount: number;
  icon: React.ElementType;
  variant: "expense" | "income" | "balance";
}) {
  const isNegativeBalance = variant === "balance" && amount < 0;
  const effectiveVariant = isNegativeBalance ? "expense" : variant === "balance" ? "income" : variant;

  const styles = {
    expense: { container: "border-expense/20", icon: "bg-expense-muted text-expense", amount: "text-expense" },
    income:  { container: "border-income/20",  icon: "bg-income-muted text-income",   amount: "text-income"  },
  };
  const s = styles[effectiveVariant];

  return (
    <div className={cn("bg-card border rounded-2xl p-3 sm:p-4 flex flex-col gap-2 shadow-sm", s.container)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">
          {label}
        </span>
        <div className={cn("w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center flex-shrink-0", s.icon)}>
          <Icon size={12} />
        </div>
      </div>
      <p className={cn("text-sm sm:text-base font-bold leading-none tabular-nums", s.amount)}>
        {variant === "expense" ? "" : variant === "income" ? "" : amount < 0 ? "−" : ""}
        {formatINR(amount)}
      </p>
    </div>
  );
}

export function HomePageClient() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  // Data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({ totalExpense: 0, totalIncome: 0, balance: 0 });
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Undo toast state
  const [undoToast, setUndoToast] = useState<{ visible: boolean; txnId: string; label: string }>({
    visible: false, txnId: "", label: "",
  });

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
  const firstName = displayName.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Ensure categories exist and fetch transactions + summary
      await getCategories().catch((e) => console.warn("Category check:", e));
      const [txns, sum] = await Promise.all([getTransactions(50), getDashboardSummary()]);
      setTransactions(txns);
      setSummary(sum);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  function openAdd() { setEditTarget(null); setModalOpen(true); }
  function openEdit(t: Transaction) { setEditTarget(t); setModalOpen(true); }
  function openDelete(t: Transaction) { setDeleteTarget(t); }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await softDeleteTransaction(deleteTarget.id);
      const deleted = deleteTarget;
      setDeleteTarget(null);
      setTransactions((prev) => prev.filter((t) => t.id !== deleted.id));
      // Recalculate summary
      setSummary((prev) => {
        const amt = deleted.amount;
        return deleted.type === "expense"
          ? { ...prev, totalExpense: prev.totalExpense - amt, balance: prev.balance + amt }
          : { ...prev, totalIncome: prev.totalIncome - amt, balance: prev.balance - amt };
      });
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
      await loadData(); // Refresh to show restored transaction
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto lg:max-w-none lg:px-8 lg:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            <Link href="/settings" aria-label="Settings" className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground transition-all">
              <Settings size={16} />
            </Link>
            <button id="mobile-sign-out" onClick={handleSignOut} aria-label="Sign out" className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted text-muted-foreground hover:text-expense transition-all">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 h-20 animate-pulse" />
          ))
        ) : (
          <>
            <SummaryCard label="Expense" amount={summary.totalExpense} icon={TrendingDown} variant="expense" />
            <SummaryCard label="Income"  amount={summary.totalIncome}  icon={TrendingUp}  variant="income"  />
            <SummaryCard label="Balance" amount={summary.balance}      icon={Wallet}      variant="balance" />
          </>
        )}
      </div>

      {/* Monthly Budget Tracker */}
      {!loading && (
        <BudgetProgressCard
          currentMonthlyExpense={transactions
            .filter(
              (t) =>
                t.type === "expense" &&
                t.date.startsWith(new Date().toISOString().slice(0, 7))
            )
            .reduce((s, t) => s + Number(t.amount), 0)}
        />
      )}

      {/* Recent Transactions */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Transactions</h2>
          <span className="text-xs text-muted-foreground">
            {transactions.length > 0 ? `${transactions.length} total` : ""}
          </span>
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
        ) : (
          <TransactionList
            transactions={transactions}
            onEdit={openEdit}
            onDelete={openDelete}
          />
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
