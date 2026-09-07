"use client";

import { useState, useEffect, useCallback } from "react";
import { X, AlertCircle, Plus } from "lucide-react";
import { CategoryPicker } from "@/components/transactions/CategoryPicker";
import { createTransaction, updateTransaction } from "@/lib/supabase/transactions";
import { getCategories, createCategory } from "@/lib/supabase/categories";
import type { Transaction, TransactionType, Category } from "@/types/database";
import { cn } from "@/lib/utils";

interface TransactionModalProps {
  open: boolean;
  editTransaction?: Transaction | null;
  defaultType?: TransactionType;
  onClose: () => void;
  onSaved: () => void;
}

const ICON_OPTIONS = ["🍔","🚗","🛍️","🏠","💊","🎬","📚","💼","☕","🎮","✈️","🎁","💰","📦"];
const COLOR_OPTIONS = [
  "#ef4444","#f97316","#eab308","#22c55e","#10b981",
  "#06b6d4","#3b82f6","#6366f1","#a855f7","#ec4899","#6b7280",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionModal({
  open,
  editTransaction,
  defaultType = "expense",
  onClose,
  onSaved,
}: TransactionModalProps) {
  const isEditing = !!editTransaction;
  const [activeTab, setActiveTab] = useState<TransactionType>(defaultType);

  // Form state
  const [amount, setAmount]           = useState("");
  const [date, setDate]               = useState(today());
  const [time, setTime]               = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId]   = useState<string | null>(null);
  const [receivedFrom, setReceivedFrom] = useState("");
  const [note, setNote]               = useState("");

  // Categories
  const [categories, setCategories]   = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);

  // Add-category sub-form
  const [showAddCat, setShowAddCat]   = useState(false);
  const [newCatName, setNewCatName]   = useState("");
  const [newCatIcon, setNewCatIcon]   = useState("📦");
  const [newCatColor, setNewCatColor] = useState("#6366f1");
  const [savingCat, setSavingCat]     = useState(false);

  // Submit state
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (editTransaction) {
      setActiveTab(editTransaction.type);
      setAmount(String(editTransaction.amount));
      setDate(editTransaction.date);
      setTime(editTransaction.time ?? "");
      setDescription(editTransaction.description);
      setCategoryId(editTransaction.category_id ?? null);
      setReceivedFrom(editTransaction.received_from ?? "");
      setNote(editTransaction.note ?? "");
    } else {
      setActiveTab(defaultType);
      setAmount("");
      setDate(today());
      setTime("");
      setDescription("");
      setCategoryId(null);
      setReceivedFrom("");
      setNote("");
    }
    setError(null);
  }, [editTransaction, defaultType, open]);

  // Load categories
  useEffect(() => {
    if (!open) return;
    setLoadingCats(true);
    getCategories()
      .then(setCategories)
      .catch(console.error)
      .finally(() => setLoadingCats(false));
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleAddCategory = useCallback(async () => {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    try {
      const cat = await createCategory({ name: newCatName.trim(), icon: newCatIcon, color: newCatColor });
      setCategories((prev) => [...prev, cat]);
      setCategoryId(cat.id);
      setShowAddCat(false);
      setNewCatName("");
      setNewCatIcon("📦");
      setNewCatColor("#6366f1");
    } catch (err) {
      console.error(err);
    } finally {
      setSavingCat(false);
    }
  }, [newCatName, newCatIcon, newCatColor]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }
    if (!date) {
      setError("Please select a date.");
      return;
    }
    if (!description.trim()) {
      setError(activeTab === "expense" ? "Please enter what you spent on." : "Please enter a description.");
      return;
    }
    if (activeTab === "expense" && !categoryId) {
      setError("Please select a category.");
      return;
    }

    const payload = {
      type: activeTab,
      amount: parsedAmount,
      date,
      time: time || null,
      description: description.trim(),
      category_id: activeTab === "expense" ? categoryId : null,
      received_from: activeTab === "income" ? (receivedFrom.trim() || null) : null,
      note: note.trim() || null,
    };

    setLoading(true);
    try {
      if (isEditing && editTransaction) {
        await updateTransaction(editTransaction.id, payload);
      } else {
        await createTransaction(payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [amount, date, time, description, categoryId, receivedFrom, note, activeTab, isEditing, editTransaction, onSaved, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet / Modal */}
      <div className={cn(
        "relative bg-card border border-border shadow-2xl w-full",
        "sm:max-w-md sm:rounded-2xl",
        "rounded-t-2xl max-h-[92dvh] overflow-y-auto",
        "animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
      )}>
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-base font-semibold text-foreground">
            {isEditing ? "Edit Transaction" : "Add Transaction"}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Type tabs */}
        {!isEditing && (
          <div className="px-5 pt-4 pb-2">
            <div className="flex bg-muted rounded-xl p-1">
              {(["expense", "income"] as TransactionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setActiveTab(t); setError(null); setCategoryId(null); }}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all duration-200",
                    activeTab === t
                      ? t === "expense"
                        ? "bg-expense text-white shadow-sm"
                        : "bg-income text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "expense" ? "💸 Expense" : "💰 Income"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pb-5 pt-3 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-expense-muted text-expense text-sm">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Amount <span className="text-expense">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">₹</span>
              <input
                id="txn-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={cn(
                  "w-full pl-7 pr-3 py-2.5 rounded-xl text-sm",
                  "bg-muted border border-border text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                )}
              />
            </div>
          </div>

          {/* Date + Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Date <span className="text-expense">*</span>
              </label>
              <input
                id="txn-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cn(
                  "w-full px-3 py-2.5 rounded-xl text-sm",
                  "bg-muted border border-border text-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time <span className="text-muted-foreground/60">(opt)</span></label>
              <input
                id="txn-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={cn(
                  "w-full px-3 py-2.5 rounded-xl text-sm",
                  "bg-muted border border-border text-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                )}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {activeTab === "expense" ? "Spend on" : "Description"} <span className="text-expense">*</span>
            </label>
            <input
              id="txn-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={activeTab === "expense" ? "e.g. Lunch at Café" : "e.g. Monthly salary"}
              className={cn(
                "w-full px-3 py-2.5 rounded-xl text-sm",
                "bg-muted border border-border text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              )}
            />
          </div>

          {/* Expense: Category */}
          {activeTab === "expense" && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Category <span className="text-expense">*</span>
              </label>
              {loadingCats ? (
                <div className="h-8 bg-muted rounded-xl animate-pulse" />
              ) : (
                <CategoryPicker
                  categories={categories}
                  selected={categoryId}
                  onSelect={setCategoryId}
                  onAddNew={() => setShowAddCat(true)}
                />
              )}

              {/* Add new category inline */}
              {showAddCat && (
                <div className="bg-muted rounded-xl p-3 space-y-3 border border-border">
                  <p className="text-xs font-semibold text-foreground">New Category</p>
                  <div className="flex gap-2">
                    {/* Icon picker */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">Icon</p>
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {ICON_OPTIONS.map((ic) => (
                          <button
                            key={ic}
                            type="button"
                            onClick={() => setNewCatIcon(ic)}
                            className={cn(
                              "w-7 h-7 rounded-lg text-base flex items-center justify-center transition-all",
                              newCatIcon === ic ? "bg-accent/20 ring-1 ring-accent" : "hover:bg-card"
                            )}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Color picker */}
                    <div className="space-y-1 flex-1">
                      <p className="text-[10px] text-muted-foreground">Color</p>
                      <div className="flex flex-wrap gap-1.5">
                        {COLOR_OPTIONS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewCatColor(c)}
                            style={{ backgroundColor: c }}
                            className={cn(
                              "w-6 h-6 rounded-lg transition-all",
                              newCatColor === c ? "ring-2 ring-offset-1 ring-foreground scale-110" : "hover:scale-105"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Category name"
                    className={cn(
                      "w-full px-3 py-2 rounded-lg text-sm",
                      "bg-card border border-border text-foreground placeholder:text-muted-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-accent"
                    )}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddCat(false)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium bg-card text-muted-foreground hover:text-foreground transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      disabled={savingCat || !newCatName.trim()}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold bg-accent text-white disabled:opacity-50 transition-all flex items-center justify-center gap-1"
                    >
                      {savingCat ? (
                        <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : (
                        <><Plus size={12} /> Save</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Income: Received From */}
          {activeTab === "income" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Received from <span className="text-muted-foreground/60">(opt)</span></label>
              <input
                id="txn-received-from"
                type="text"
                value={receivedFrom}
                onChange={(e) => setReceivedFrom(e.target.value)}
                placeholder="e.g. Employer, Freelance client, Rahul"
                className={cn(
                  "w-full px-3 py-2.5 rounded-xl text-sm",
                  "bg-muted border border-border text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                )}
              />
            </div>
          )}

          {/* Note (income only) */}
          {activeTab === "income" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Note <span className="text-muted-foreground/60">(opt)</span></label>
              <textarea
                id="txn-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any additional notes…"
                rows={2}
                className={cn(
                  "w-full px-3 py-2.5 rounded-xl text-sm resize-none",
                  "bg-muted border border-border text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                )}
              />
            </div>
          )}

          {/* Submit */}
          <button
            id="btn-save-transaction"
            type="submit"
            disabled={loading}
            className={cn(
              "w-full py-3 rounded-xl text-sm font-semibold mt-2",
              "shadow-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              activeTab === "expense"
                ? "bg-expense text-white shadow-expense/25"
                : "bg-income text-white shadow-income/25"
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                {isEditing ? "Saving…" : "Adding…"}
              </span>
            ) : (
              isEditing
                ? "Save Changes"
                : activeTab === "expense" ? "Save Expense" : "Save Income"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
