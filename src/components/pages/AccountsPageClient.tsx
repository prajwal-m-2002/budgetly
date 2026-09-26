"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Landmark,
  Plus,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  CalendarDays,
  Search,
  Check,
  AlertCircle,
  Loader2,
  Layers,
} from "lucide-react";
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from "@/lib/supabase/accounts";
import {
  getAllActiveTransactions,
  softDeleteTransaction,
  restoreTransaction,
} from "@/lib/supabase/transactions";
import { getCategories } from "@/lib/supabase/categories";
import { TransactionList } from "@/components/transactions/TransactionList";
import { TransactionModal } from "@/components/transactions/TransactionModal";
import { DeleteConfirmDialog } from "@/components/transactions/DeleteConfirmDialog";
import { UndoToast } from "@/components/transactions/UndoToast";
import {
  formatINR,
  getCurrentMonthRange,
  getPreviousMonthRange,
  getCurrentYearRange,
  isDateInRange,
} from "@/lib/dateUtils";
import type { Account, AccountType, Transaction, Category, TransactionType } from "@/types/database";
import { cn } from "@/lib/utils";

const ACCOUNT_ICONS = ["🏦", "🏛️", "💳", "💵", "📱", "💼", "🪙", "🏷️", "🔒", "🌐", "🛒", "📦"];
const ACCOUNT_COLORS = [
  "#3b82f6", // Blue (Default Main)
  "#ef4444", // Red (Kotak/Secondary)
  "#10b981", // Emerald (Cash)
  "#8b5cf6", // Purple (HDFC)
  "#f59e0b", // Amber (Credit Card)
  "#06b6d4", // Cyan (UPI)
  "#ec4899", // Pink
  "#6b7280", // Gray
];

type DateFilterType = "this_month" | "prev_month" | "this_year" | "all" | "custom";

export function AccountsPageClient() {
  const searchParams = useSearchParams();
  const initialAccountId = searchParams.get("id");

  // Accounts state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(initialAccountId);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state for selected account view
  const [dateFilter, setDateFilter] = useState<DateFilterType>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Account Modals (Create / Edit / Delete)
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState<AccountType>("SECONDARY");
  const [accIcon, setAccIcon] = useState("🏦");
  const [accColor, setAccColor] = useState("#ef4444");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountModalError, setAccountModalError] = useState<string | null>(null);

  const [deleteAccTarget, setDeleteAccTarget] = useState<Account | null>(null);
  const [deletingAcc, setDeletingAcc] = useState(false);

  // Transaction Modals (Add / Edit / Delete)
  const [txnModalOpen, setTxnModalOpen] = useState(false);
  const [editTxnTarget, setEditTxnTarget] = useState<Transaction | null>(null);
  const [deleteTxnTarget, setDeleteTxnTarget] = useState<Transaction | null>(null);
  const [deletingTxn, setDeletingTxn] = useState(false);
  const [undoToast, setUndoToast] = useState<{ visible: boolean; txnId: string; label: string }>({
    visible: false,
    txnId: "",
    label: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accs, txns, cats] = await Promise.all([
        getAccounts(),
        getAllActiveTransactions(),
        getCategories().catch(() => []),
      ]);

      setAccounts(accs);
      setAllTransactions(txns);
      setCategories(cats);

      if (!selectedAccountId && accs.length > 0) {
        // Default to first account or main
        const main = accs.find((a) => a.type === "MAIN") || accs[0];
        setSelectedAccountId(main.id);
      }
    } catch (err) {
      console.error("Failed to load accounts data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync selectedAccountId if param changes
  useEffect(() => {
    if (initialAccountId) {
      setSelectedAccountId(initialAccountId);
    }
  }, [initialAccountId]);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) || accounts[0] || null;
  }, [accounts, selectedAccountId]);

  // Calculations for all accounts overview
  const accountStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { totalExpense: number; totalIncome: number; balance: number; txnCount: number; monthExpense: number }
    >();

    const curMonth = getCurrentMonthRange();
    const mainAcc = accounts.find((a) => a.type === "MAIN") || accounts[0];

    accounts.forEach((acc) => {
      const isMain = acc.type === "MAIN" || (mainAcc && acc.id === mainAcc.id);
      const accTxns = allTransactions.filter((t) => {
        if (isMain) {
          return !t.account_id || t.account_id === acc.id || t.accounts?.type === "MAIN";
        }
        return t.account_id === acc.id;
      });

      let totalExp = 0;
      let totalInc = 0;
      let monthExp = 0;

      accTxns.forEach((t) => {
        const amt = Number(t.amount) || 0;
        if (t.type === "expense") {
          totalExp += amt;
          if (isDateInRange(t.date, curMonth.from, curMonth.to)) {
            monthExp += amt;
          }
        } else {
          totalInc += amt;
        }
      });

      map.set(acc.id, {
        totalExpense: totalExp,
        totalIncome: totalInc,
        balance: totalInc - totalExp,
        txnCount: accTxns.length,
        monthExpense: monthExp,
      });
    });

    return map;
  }, [accounts, allTransactions]);

  // Transactions strictly for currently selected account
  const currentAccountAllTxns = useMemo(() => {
    if (!selectedAccount) return [];
    const isMain = selectedAccount.type === "MAIN";
    return allTransactions.filter((t) => {
      if (isMain) {
        return !t.account_id || t.account_id === selectedAccount.id || t.accounts?.type === "MAIN";
      }
      return t.account_id === selectedAccount.id;
    });
  }, [selectedAccount, allTransactions]);

  // Filtered transactions for selected account according to active search/date filter
  const filteredAccountTxns = useMemo(() => {
    let dateBoundary: { from?: string; to?: string } = {};
    if (dateFilter === "this_month") {
      dateBoundary = getCurrentMonthRange();
    } else if (dateFilter === "prev_month") {
      dateBoundary = getPreviousMonthRange();
    } else if (dateFilter === "this_year") {
      dateBoundary = getCurrentYearRange();
    } else if (dateFilter === "custom" && customFrom && customTo) {
      dateBoundary = { from: customFrom, to: customTo };
    }

    return currentAccountAllTxns.filter((t) => {
      // Date boundary check
      if (dateBoundary.from && dateBoundary.to) {
        if (!isDateInRange(t.date, dateBoundary.from, dateBoundary.to)) return false;
      }
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
  }, [currentAccountAllTxns, dateFilter, customFrom, customTo, typeFilter, categoryFilter, searchQuery]);

  // Category breakdown for currently selected account
  const accountCategoryBreakdown = useMemo(() => {
    const expenses = filteredAccountTxns.filter((t) => t.type === "expense");
    const totalExp = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const map: Record<string, { name: string; icon: string; color: string; total: number; count: number }> = {};
    for (const t of expenses) {
      const key = t.category_id ?? "uncategorized";
      if (!map[key]) {
        map[key] = {
          name: t.categories?.name ?? "Other",
          icon: t.categories?.icon ?? "📦",
          color: t.categories?.color ?? "#6b7280",
          total: 0,
          count: 0,
        };
      }
      map[key].total += Number(t.amount) || 0;
      map[key].count += 1;
    }

    return Object.values(map)
      .map((c) => ({
        ...c,
        percentage: totalExp > 0 ? Math.round((c.total / totalExp) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredAccountTxns]);

  // Open Create Account Modal
  function openCreateAccount() {
    setEditingAccount(null);
    setAccName("");
    setAccType("SECONDARY");
    setAccIcon("🏛️");
    setAccColor("#ef4444");
    setAccountModalError(null);
    setShowAccountModal(true);
  }

  // Open Edit Account Modal
  function openEditAccount(acc: Account) {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccType(acc.type);
    setAccIcon(acc.icon || "🏦");
    setAccColor(acc.color || "#3b82f6");
    setAccountModalError(null);
    setShowAccountModal(true);
  }

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!accName.trim()) {
      setAccountModalError("Please enter an account name.");
      return;
    }

    setSavingAccount(true);
    setAccountModalError(null);
    try {
      if (editingAccount) {
        const updated = await updateAccount(editingAccount.id, {
          name: accName.trim(),
          type: accType,
          icon: accIcon,
          color: accColor,
        });
        setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        const created = await createAccount({
          name: accName.trim(),
          type: accType,
          icon: accIcon,
          color: accColor,
        });
        setAccounts((prev) => [...prev, created]);
        setSelectedAccountId(created.id);
      }
      setShowAccountModal(false);
      await loadData();
    } catch (err) {
      setAccountModalError(err instanceof Error ? err.message : "Failed to save account");
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deleteAccTarget) return;
    setDeletingAcc(true);
    try {
      await deleteAccount(deleteAccTarget.id);
      const remaining = accounts.filter((a) => a.id !== deleteAccTarget.id);
      setAccounts(remaining);
      setDeleteAccTarget(null);
      if (selectedAccountId === deleteAccTarget.id && remaining.length > 0) {
        setSelectedAccountId(remaining[0].id);
      }
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingAcc(false);
    }
  }

  // Transaction Actions
  function openAddTxn() {
    setEditTxnTarget(null);
    setTxnModalOpen(true);
  }

  function openEditTxn(t: Transaction) {
    setEditTxnTarget(t);
    setTxnModalOpen(true);
  }

  function openDeleteTxn(t: Transaction) {
    setDeleteTxnTarget(t);
  }

  async function handleDeleteTxn() {
    if (!deleteTxnTarget) return;
    setDeletingTxn(true);
    try {
      await softDeleteTransaction(deleteTxnTarget.id);
      const deleted = deleteTxnTarget;
      setDeleteTxnTarget(null);
      setUndoToast({ visible: true, txnId: deleted.id, label: `"${deleted.description}" deleted` });
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingTxn(false);
    }
  }

  async function handleUndoTxn() {
    if (!undoToast.txnId) return;
    setUndoToast((p) => ({ ...p, visible: false }));
    try {
      await restoreTransaction(undoToast.txnId);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  }

  const selectedStats = selectedAccount ? accountStatsMap.get(selectedAccount.id) : null;
  const curMonthRange = getCurrentMonthRange();

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto lg:px-8 lg:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
              <Landmark size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Expense Accounts</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage Main and Secondary expense accounts (SBI, Kotak, Cash, UPI) with separate calculations
          </p>
        </div>

        <button
          onClick={openCreateAccount}
          className="px-4 py-2 bg-accent text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-accent/90 transition-all flex items-center gap-1.5"
        >
          <Plus size={15} />
          Add Account
        </button>
      </div>

      {/* Accounts List Overview (Requirement 4 & 5) */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-accent" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              All Accounts ({accounts.length})
            </h2>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Tap an account to view its separate expenses
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((acc) => {
              const isSelected = selectedAccount?.id === acc.id;
              const isMain = acc.type === "MAIN";
              const stats = accountStatsMap.get(acc.id);

              return (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group",
                    isSelected
                      ? "border-accent bg-accent/5 ring-2 ring-accent/30 shadow-md"
                      : "border-border bg-card hover:bg-muted/40 hover:border-border/80"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ backgroundColor: `${acc.color || "#3b82f6"}20` }}
                      >
                        {acc.icon || "🏦"}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-foreground text-sm truncate">{acc.name}</h3>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5",
                            isMain
                              ? "bg-accent/15 text-accent border border-accent/30"
                              : "bg-muted text-muted-foreground border border-border"
                          )}
                        >
                          {isMain ? "Main Account" : "Secondary Account"}
                        </span>
                      </div>
                    </div>

                    {/* Account Edit/Delete Controls */}
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditAccount(acc);
                        }}
                        aria-label="Edit account"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      {accounts.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteAccTarget(acc);
                          }}
                          aria-label="Delete account"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-expense hover:bg-expense-muted transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Total & Monthly Expenses */}
                  <div className="mt-3.5 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        {isMain ? "Main Expenses" : "Total Expenses"}
                      </span>
                      <span className="font-bold text-expense tabular-nums text-sm">
                        {formatINR(stats?.totalExpense ?? 0)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block">This Month</span>
                      <span className="font-semibold text-foreground tabular-nums text-xs">
                        {formatINR(stats?.monthExpense ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dedicated View for Selected Account (Requirement 4) */}
      {selectedAccount && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Selected Account Header Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: `${selectedAccount.color || "#3b82f6"}22` }}
                >
                  {selectedAccount.icon || "🏦"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">{selectedAccount.name} Expenses</h2>
                    <span
                      className={cn(
                        "text-xs font-semibold px-2.5 py-0.5 rounded-full",
                        selectedAccount.type === "MAIN"
                          ? "bg-accent/15 text-accent border border-accent/30"
                          : "bg-muted text-muted-foreground border border-border"
                      )}
                    >
                      {selectedAccount.type === "MAIN" ? "Main Account" : "Secondary Account"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedAccount.type === "MAIN"
                      ? "Expenses in this main account drive the primary dashboard and budget tracking."
                      : "Expenses in this secondary account remain completely isolated from the Main Dashboard calculations."}
                  </p>
                </div>
              </div>

              <button
                onClick={openAddTxn}
                className="px-4 py-2.5 bg-accent text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-accent/90 transition-all flex items-center justify-center gap-1.5 shrink-0"
              >
                <Plus size={15} />
                Add {selectedAccount.name} Expense
              </button>
            </div>

            {/* Account Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-muted/40 border border-border rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                  <TrendingDown size={13} className="text-expense" />
                  <span>Total Expenses</span>
                </div>
                <p className="text-base font-bold text-expense tabular-nums">
                  {formatINR(selectedStats?.totalExpense ?? 0)}
                </p>
              </div>

              <div className="bg-muted/40 border border-border rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                  <CalendarDays size={13} className="text-accent" />
                  <span>{curMonthRange.label}</span>
                </div>
                <p className="text-base font-bold text-foreground tabular-nums">
                  {formatINR(selectedStats?.monthExpense ?? 0)}
                </p>
              </div>

              <div className="bg-muted/40 border border-border rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                  <TrendingUp size={13} className="text-income" />
                  <span>Total Income</span>
                </div>
                <p className="text-base font-bold text-income tabular-nums">
                  {formatINR(selectedStats?.totalIncome ?? 0)}
                </p>
              </div>

              <div className="bg-muted/40 border border-border rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                  <Wallet size={13} className="text-accent" />
                  <span>Net Balance</span>
                </div>
                <p
                  className={cn(
                    "text-base font-bold tabular-nums",
                    (selectedStats?.balance ?? 0) >= 0 ? "text-income" : "text-expense"
                  )}
                >
                  {(selectedStats?.balance ?? 0) < 0 ? "−" : ""}
                  {formatINR(selectedStats?.balance ?? 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Category-Wise Breakdown for this Account */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Category-Wise {selectedAccount.name} Expenses
              </h3>
              <span className="text-xs text-muted-foreground">
                {accountCategoryBreakdown.length} active categories
              </span>
            </div>

            {accountCategoryBreakdown.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No categorized expenses recorded in {selectedAccount.name} for the current filter.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {accountCategoryBreakdown.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-3 px-5 py-3 text-xs">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                      style={{ backgroundColor: `${cat.color}20` }}
                    >
                      {cat.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-foreground">{cat.name}</span>
                        <span className="text-muted-foreground">{cat.count} txns</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 ml-3">
                      <span className="font-bold text-expense tabular-nums block">
                        {formatINR(cat.total)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{cat.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expense History, Search, Filters & List for this Account */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {selectedAccount.name} Transaction History
                </h3>
                <span className="text-xs text-muted-foreground">
                  {filteredAccountTxns.length} records
                </span>
              </div>

              {/* Filter Presets Toolbar */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[
                  { id: "this_month", label: "This Month" },
                  { id: "prev_month", label: "Previous Month" },
                  { id: "this_year", label: "This Year" },
                  { id: "all", label: "All History" },
                  { id: "custom", label: "Custom Range" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setDateFilter(f.id as DateFilterType)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                      dateFilter === f.id
                        ? "bg-accent text-white shadow-sm shadow-accent/25"
                        : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Inputs */}
              {dateFilter === "custom" && (
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground font-medium">From</span>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl text-xs bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground font-medium">To</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl text-xs bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
              )}

              {/* Search & Sub-filters */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <div className="relative w-full sm:flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${selectedAccount.name} transactions...`}
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
                      {t === "all" ? "All" : t}
                    </button>
                  ))}
                </div>

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

            {/* List */}
            {filteredAccountTxns.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                No transactions recorded under {selectedAccount.name} for the chosen filter.
              </div>
            ) : (
              <TransactionList
                transactions={filteredAccountTxns}
                onEdit={openEditTxn}
                onDelete={openDeleteTxn}
              />
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-foreground mb-1">
              {editingAccount ? "Edit Account" : "Add Expense Account"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Configure account name and whether it acts as your Main or Secondary account.
            </p>

            {accountModalError && (
              <div className="mb-4 flex items-start gap-2 p-3 bg-expense-muted text-expense text-xs rounded-xl">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{accountModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAccount} className="space-y-4">
              {/* Account Name */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Account Name <span className="text-expense">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="e.g. Kotak, SBI, Cash, HDFC, Credit Card, UPI"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-accent"
                  autoFocus
                />
              </div>

              {/* Account Type (MAIN vs SECONDARY) */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccType("MAIN")}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      accType === "MAIN"
                        ? "border-accent bg-accent/10 ring-1 ring-accent text-foreground"
                        : "border-border hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <span className="font-bold text-xs block text-foreground">Main Account</span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5 leading-tight">
                      Participates in primary dashboard & budget tracking
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccType("SECONDARY")}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      accType === "SECONDARY"
                        ? "border-accent bg-accent/10 ring-1 ring-accent text-foreground"
                        : "border-border hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <span className="font-bold text-xs block text-foreground">Secondary Account</span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5 leading-tight">
                      Isolated expenses, separate views, zero effect on main totals
                    </span>
                  </button>
                </div>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Select Icon
                </label>
                <div className="flex flex-wrap gap-1.5 p-1.5 bg-muted/40 rounded-xl border border-border">
                  {ACCOUNT_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAccIcon(emoji)}
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-base hover:bg-background transition-all",
                        accIcon === emoji && "bg-background shadow-sm ring-2 ring-accent"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Swatch */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Account Color Tag
                </label>
                <div className="flex items-center gap-2">
                  {ACCOUNT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAccColor(c)}
                      className={cn(
                        "w-7 h-7 rounded-full transition-transform",
                        accColor === c && "scale-125 ring-2 ring-foreground ring-offset-2 ring-offset-card"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAccount || !accName.trim()}
                  className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-semibold shadow-md shadow-accent/25 hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingAccount ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {editingAccount ? "Update Account" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Dialog */}
      {deleteAccTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-foreground">Delete Account?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-foreground">{deleteAccTarget.name}</span>?
              {deleteAccTarget.type === "MAIN" && " Since this is your Main Account, another active account will be promoted to Main."}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteAccTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAcc}
                className="px-4 py-2 rounded-xl bg-expense text-white text-xs font-semibold hover:bg-expense/90 disabled:opacity-50 flex items-center gap-1"
              >
                {deletingAcc ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Transaction Modal */}
      <TransactionModal
        open={txnModalOpen}
        editTransaction={editTxnTarget}
        defaultAccountId={selectedAccount?.id}
        onClose={() => setTxnModalOpen(false)}
        onSaved={loadData}
      />

      {/* Delete Transaction Confirm */}
      <DeleteConfirmDialog
        open={!!deleteTxnTarget}
        description={deleteTxnTarget?.description ?? ""}
        onConfirm={handleDeleteTxn}
        onCancel={() => setDeleteTxnTarget(null)}
        loading={deletingTxn}
      />

      {/* Undo Toast */}
      <UndoToast
        visible={undoToast.visible}
        message={undoToast.label}
        onUndo={handleUndoTxn}
        onDismiss={() => setUndoToast((p) => ({ ...p, visible: false }))}
      />
    </div>
  );
}
