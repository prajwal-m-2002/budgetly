"use client";

import { useState, useEffect } from "react";
import {
  Target,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Calendar,
  Plus,
  Loader2,
} from "lucide-react";
import { getMonthlyBudget, setMonthlyBudget } from "@/lib/supabase/budgets";
import { formatINR } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

interface BudgetProgressCardProps {
  currentMonthlyExpense: number;
  year?: number;
  month?: number; // 1-12
}

export function BudgetProgressCard({
  currentMonthlyExpense,
  year: propYear,
  month: propMonth,
}: BudgetProgressCardProps) {
  const now = new Date();
  const year = propYear ?? now.getFullYear();
  const month = propMonth ?? now.getMonth() + 1;

  const [budgetLimit, setBudgetLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Month metadata
  const monthDate = new Date(year, month - 1, 1);
  const monthName = monthDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const currentDay = isCurrentMonth ? now.getDate() : 1;
  const daysRemaining = isCurrentMonth ? Math.max(1, daysInMonth - currentDay + 1) : daysInMonth;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getMonthlyBudget(year, month)
      .then((savedAmount) => {
        if (!isMounted) return;
        setBudgetLimit(savedAmount);
        if (savedAmount !== null) {
          setInputValue(String(savedAmount));
        } else {
          setInputValue("");
        }
      })
      .catch((err) => {
        console.error("Failed to load budget:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [year, month]);

  function triggerToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  async function handleSave() {
    const parsed = Number(inputValue);
    if (isNaN(parsed) || parsed < 0 || !isFinite(parsed)) {
      setErrorMsg("Please enter a valid positive budget amount.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await setMonthlyBudget(year, month, parsed);
      setBudgetLimit(parsed);
      setIsEditing(false);
      triggerToast("Monthly budget updated");
    } catch (err) {
      console.error("Failed to save budget:", err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to save budget to cloud.");
    } finally {
      setSaving(false);
    }
  }

  // If still loading from database, show skeleton loader
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm mb-8 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-muted" />
            <div className="space-y-1.5">
              <div className="h-4 w-36 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
          </div>
          <div className="h-6 w-20 bg-muted rounded-full" />
        </div>
        <div className="h-4 w-48 bg-muted rounded mb-3" />
        <div className="h-3 w-full bg-muted rounded-full mb-4" />
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/50">
          <div className="h-8 bg-muted rounded" />
          <div className="h-8 bg-muted rounded" />
          <div className="h-8 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // Calculations when budget exists
  const hasBudget = budgetLimit !== null && budgetLimit > 0;
  const effectiveLimit = budgetLimit ?? 0;
  const percentUsed = hasBudget ? (currentMonthlyExpense / effectiveLimit) * 100 : 0;
  const isOverBudget = hasBudget && currentMonthlyExpense > effectiveLimit;
  const isWarning = hasBudget && percentUsed >= 75 && !isOverBudget;
  const remainingAmount = hasBudget ? Math.max(0, effectiveLimit - currentMonthlyExpense) : 0;
  const overAmount = hasBudget ? Math.max(0, currentMonthlyExpense - effectiveLimit) : 0;
  const dailyAllowance = hasBudget && remainingAmount > 0 ? remainingAmount / daysRemaining : 0;

  // Status badge theme
  const statusTheme = !hasBudget
    ? {
        badge: "bg-muted text-muted-foreground border-border",
        badgeText: "Not Configured",
        bar: "bg-muted-foreground/30",
        icon: Target,
      }
    : isOverBudget
    ? {
        badge: "bg-expense-muted text-expense border-expense/30",
        badgeText: "Over Budget",
        bar: "bg-expense",
        icon: AlertOctagon,
      }
    : isWarning
    ? {
        badge: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        badgeText: "Near Limit (75%+)",
        bar: "bg-amber-500",
        icon: AlertTriangle,
      }
    : {
        badge: "bg-income-muted text-income border-income/30",
        badgeText: "On Track",
        bar: "bg-accent",
        icon: CheckCircle2,
      };

  const StatusIcon = statusTheme.icon;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm mb-8 transition-all hover:border-border/80">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={15} className="text-income" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <Target size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Monthly Budget Goal</h3>
            <p className="text-xs text-muted-foreground">{monthName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
              statusTheme.badge
            )}
          >
            <StatusIcon size={12} />
            {statusTheme.badgeText}
          </span>
          <button
            onClick={() => {
              setInputValue(budgetLimit !== null ? String(budgetLimit) : "");
              setErrorMsg(null);
              setIsEditing(true);
            }}
            aria-label="Edit budget goal"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Edit3 size={14} />
          </button>
        </div>
      </div>

      {/* Content: If No Budget is Set */}
      {!hasBudget ? (
        <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/50 mt-3 pt-3">
          <div>
            <p className="text-sm font-semibold text-foreground">No monthly budget set for {monthName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set a spending target to track your progress and daily allowance.
            </p>
          </div>
          <button
            onClick={() => {
              setInputValue("");
              setErrorMsg(null);
              setIsEditing(true);
            }}
            className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:bg-accent/90 transition-all self-start sm:self-auto"
          >
            <Plus size={14} />
            Set Budget
          </button>
        </div>
      ) : (
        /* Content: When Budget is Configured */
        <div className="space-y-4 mt-4">
          <div className="flex items-baseline justify-between text-sm">
            <div>
              <span className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                {formatINR(currentMonthlyExpense)}
              </span>
              <span className="text-xs text-muted-foreground ml-1.5 font-medium">
                spent of {formatINR(effectiveLimit)}
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold tabular-nums text-foreground">
              {percentUsed.toFixed(0)}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden p-0.5">
            <div
              className={cn("h-full rounded-full transition-all duration-500 ease-out", statusTheme.bar)}
              style={{ width: `${Math.min(100, Math.max(0, percentUsed))}%` }}
            />
          </div>

          {/* Footer Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-border/60 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">
                {isOverBudget ? "Exceeded By" : "Remaining"}
              </span>
              <span
                className={cn(
                  "font-bold text-sm tabular-nums mt-0.5 inline-block",
                  isOverBudget ? "text-expense" : "text-foreground"
                )}
              >
                {isOverBudget ? `+${formatINR(overAmount)}` : formatINR(remainingAmount)}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">Daily Allowance</span>
              <span className="font-bold text-sm tabular-nums text-foreground mt-0.5 inline-block">
                {isOverBudget ? "₹0 / day" : `${formatINR(dailyAllowance)} / day`}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <span className="text-muted-foreground block text-[11px]">Days Remaining</span>
              <span className="font-bold text-sm tabular-nums text-foreground mt-0.5 flex items-center gap-1">
                <Calendar size={12} className="text-muted-foreground" />
                {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Edit Budget Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <Target size={18} />
              </div>
              <div>
                <h4 className="font-bold text-foreground text-base">Set Monthly Budget</h4>
                <p className="text-xs text-muted-foreground">Budget target for {monthName}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Monthly Target (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="w-full pl-8 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground font-semibold text-base focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="10000"
                    autoFocus
                  />
                </div>
                {errorMsg && <p className="text-xs text-expense font-medium mt-1.5">{errorMsg}</p>}
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2">
                {[10000, 15000, 25000, 50000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setInputValue(String(preset));
                      setErrorMsg(null);
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  >
                    ₹{(preset / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-semibold shadow-md shadow-accent/25 hover:bg-accent/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Save Goal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
