"use client";

import { useState, useEffect } from "react";
import { Target, Edit3, AlertTriangle, CheckCircle2, AlertOctagon, TrendingUp, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface BudgetProgressCardProps {
  currentMonthlyExpense: number;
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

const STORAGE_KEY = "budgetly_monthly_budget_target";
const DEFAULT_BUDGET = 25000;

export function BudgetProgressCard({ currentMonthlyExpense }: BudgetProgressCardProps) {
  const [budgetLimit, setBudgetLimit] = useState<number>(DEFAULT_BUDGET);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(DEFAULT_BUDGET));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed > 0) {
          setBudgetLimit(parsed);
          setInputValue(String(parsed));
        }
      }
    } catch {
      // LocalStorage access fallback
    }
  }, []);

  function handleSave() {
    const parsed = Number(inputValue);
    if (!isNaN(parsed) && parsed > 0) {
      setBudgetLimit(parsed);
      try {
        localStorage.setItem(STORAGE_KEY, String(parsed));
      } catch {
        // Fallback
      }
    }
    setIsEditing(false);
  }

  // Days in current month & days remaining
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = Math.max(1, daysInMonth - currentDay + 1);

  const percentUsed = budgetLimit > 0 ? (currentMonthlyExpense / budgetLimit) * 100 : 0;
  const isOverBudget = currentMonthlyExpense > budgetLimit;
  const isWarning = percentUsed >= 75 && !isOverBudget;
  const remainingAmount = Math.max(0, budgetLimit - currentMonthlyExpense);
  const overAmount = Math.max(0, currentMonthlyExpense - budgetLimit);
  const dailyAllowance = remainingAmount > 0 ? remainingAmount / daysRemaining : 0;

  // Status visual variants
  const statusTheme = isOverBudget
    ? {
        badge: "bg-expense-muted text-expense border-expense/30",
        badgeText: "Over Budget",
        bar: "bg-expense",
        icon: AlertOctagon,
        iconColor: "text-expense",
      }
    : isWarning
    ? {
        badge: "bg-amber-500/10 text-amber-500 border-amber-500/30",
        badgeText: "Near Limit (75%+)",
        bar: "bg-amber-500",
        icon: AlertTriangle,
        iconColor: "text-amber-500",
      }
    : {
        badge: "bg-income-muted text-income border-income/30",
        badgeText: "On Track",
        bar: "bg-accent",
        icon: CheckCircle2,
        iconColor: "text-accent",
      };

  const StatusIcon = statusTheme.icon;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm mb-8 transition-all hover:border-border/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <Target size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Monthly Budget Goal</h3>
            <p className="text-xs text-muted-foreground">
              {now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </p>
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
              setInputValue(String(budgetLimit));
              setIsEditing(true);
            }}
            aria-label="Edit budget limit"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Edit3 size={14} />
          </button>
        </div>
      </div>

      {/* Progress & Numbers */}
      <div className="space-y-2 mt-4">
        <div className="flex items-baseline justify-between text-sm">
          <div>
            <span className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
              {formatINR(currentMonthlyExpense)}
            </span>
            <span className="text-xs text-muted-foreground ml-1 font-medium">
              spent of {formatINR(budgetLimit)}
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
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/60 text-xs">
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
                <p className="text-xs text-muted-foreground">Adjust your monthly spending limit</p>
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
                    min="100"
                    step="500"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground font-semibold text-base focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="25000"
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2">
                {[15000, 25000, 50000, 75000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setInputValue(String(preset))}
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-semibold shadow-md shadow-accent/25 hover:bg-accent/90 transition-colors"
                >
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
