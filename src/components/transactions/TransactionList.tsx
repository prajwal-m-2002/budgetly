"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { Transaction } from "@/types/database";
import { cn } from "@/lib/utils";

interface TransactionListProps {
  transactions: Transaction[];
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Group transactions by date
function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const groups: Record<string, Transaction[]> = {};
  for (const t of transactions) {
    const key = t.date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

export function TransactionList({ transactions, onEdit, onDelete }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center px-4">
        <div className="text-4xl mb-3">🧾</div>
        <h3 className="text-sm font-semibold text-foreground mb-1">No transactions yet</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          Tap <span className="font-semibold text-accent">+</span> to add your first expense or income.
        </p>
      </div>
    );
  }

  const grouped = groupByDate(transactions);

  return (
    <div>
      {grouped.map(([date, txns]) => (
        <div key={date}>
          {/* Date header */}
          <div className="px-5 py-2 bg-muted/50 border-y border-border/50">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {formatDate(date)}
            </span>
          </div>

          {/* Transactions for this date */}
          {txns.map((t, i) => {
            const cat = t.categories;
            const isExpense = t.type === "expense";

            return (
              <div
                key={t.id}
                className={cn(
                  "flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30 group",
                  i < txns.length - 1 && "border-b border-border/40"
                )}
              >
                {/* Category icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: cat?.color ? `${cat.color}22` : isExpense ? "#ef444422" : "#10b98122" }}
                >
                  <span>{cat?.icon ?? (isExpense ? "💸" : "💰")}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {cat && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                        style={{ backgroundColor: `${cat.color}22`, color: cat.color }}
                      >
                        {cat.name}
                      </span>
                    )}
                    {t.received_from && (
                      <span className="text-[10px] text-muted-foreground">from {t.received_from}</span>
                    )}
                    {t.time && (
                      <span className="text-[10px] text-muted-foreground">{formatTime(t.time)}</span>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <p className={cn(
                    "text-sm font-semibold",
                    isExpense ? "text-expense" : "text-income"
                  )}>
                    {isExpense ? "−" : "+"}{formatAmount(t.amount)}
                  </p>
                </div>

                {/* Actions — appear on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    id={`btn-edit-${t.id}`}
                    onClick={() => onEdit(t)}
                    aria-label="Edit transaction"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    id={`btn-delete-${t.id}`}
                    onClick={() => onDelete(t)}
                    aria-label="Delete transaction"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-expense hover:bg-expense-muted transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
