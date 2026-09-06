"use client";

import { useState, useEffect, useCallback } from "react";
import {
  User,
  Tags,
  Palette,
  LogOut,
  Plus,
  Trash2,
  Check,
  Moon,
  Sun,
  Laptop,
  Shield,
  Loader2,
  DollarSign,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "next-themes";
import { getCategories, createCategory, deleteCategory } from "@/lib/supabase/categories";
import type { Category } from "@/types/database";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const EMOJI_OPTIONS = [
  "🍔", "🍕", "☕", "🛒", "🚗", "✈️", "⛽", "🏠", "💡",
  "🎬", "🎮", "📚", "💊", "🩺", "🏋️", "👗", "📱", "💻",
  "🎁", "🐾", "👶", "💰", "📈", "🏖️", "🎓", "✂️", "📦",
];

const COLOR_OPTIONS = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#a855f7", // Purple
  "#ec4899", // Pink
  "#6b7280", // Gray
];

const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee (INR)" },
  { code: "USD", symbol: "$", name: "US Dollar (USD)" },
  { code: "EUR", symbol: "€", name: "Euro (EUR)" },
  { code: "GBP", symbol: "£", name: "British Pound (GBP)" },
  { code: "AED", symbol: "AED", name: "UAE Dirham (AED)" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar (CAD)" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar (AUD)" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen (JPY)" },
];

export function SettingsPageClient() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  // New Category modal/form state
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📦");
  const [newCatColor, setNewCatColor] = useState("#6366f1");
  const [savingCat, setSavingCat] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  // Currency preference state
  const [selectedCurrency, setSelectedCurrency] = useState("INR");
  const [currencySaved, setCurrencySaved] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoadingCats(true);
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCats(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    try {
      const savedCurr = localStorage.getItem("budgetly_preferred_currency");
      if (savedCurr) setSelectedCurrency(savedCurr);
    } catch {
      // Fallback
    }
  }, [loadCategories]);

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setSavingCat(true);
    try {
      const created = await createCategory({
        name: newCatName.trim(),
        icon: newCatIcon,
        color: newCatColor,
      });
      setCategories((prev) => [...prev, created]);
      setNewCatName("");
      setShowAddCat(false);
    } catch (err) {
      console.error("Failed to create category:", err);
    } finally {
      setSavingCat(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    setDeletingCatId(id);
    try {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Failed to delete category:", err);
    } finally {
      setDeletingCatId(null);
    }
  }

  function handleCurrencyChange(code: string) {
    setSelectedCurrency(code);
    try {
      localStorage.setItem("budgetly_preferred_currency", code);
    } catch {
      // Fallback
    }
    setCurrencySaved(true);
    setTimeout(() => setCurrencySaved(false), 2500);
  }

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Budgetly User";

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto lg:px-8 lg:py-8 space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings & Preferences</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Customize your profile, currencies, custom categories, and app experience
        </p>
      </div>

      {/* Account Section */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <User size={16} className="text-accent" />
          <span>Account Profile</span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center font-bold text-base">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{userName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="px-4 py-2 rounded-xl bg-expense-muted text-expense text-xs font-semibold hover:bg-expense/15 transition-colors flex items-center gap-1.5"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Currency Preference */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <DollarSign size={16} className="text-accent" />
            <span>Default Currency</span>
          </div>
          {currencySaved && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-income">
              <Check size={14} /> Saved
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {CURRENCIES.map((curr) => (
            <button
              key={curr.code}
              onClick={() => handleCurrencyChange(curr.code)}
              className={cn(
                "p-3 rounded-xl border text-left flex items-center justify-between transition-all",
                selectedCurrency === curr.code
                  ? "border-accent bg-accent/5 ring-1 ring-accent text-foreground"
                  : "border-border hover:bg-muted text-muted-foreground"
              )}
            >
              <div>
                <span className="text-base font-bold block text-foreground">{curr.symbol}</span>
                <span className="text-xs font-medium block mt-0.5">{curr.code}</span>
              </div>
              {selectedCurrency === curr.code && <Check size={16} className="text-accent" />}
            </button>
          ))}
        </div>
      </div>

      {/* Appearance / Theme */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Palette size={16} className="text-accent" />
          <span>Appearance & Theme</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "light", label: "Light Mode", icon: Sun },
            { id: "dark", label: "Dark Mode", icon: Moon },
            { id: "system", label: "System Sync", icon: Laptop },
          ].map((mode) => {
            const Icon = mode.icon;
            const active = theme === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setTheme(mode.id)}
                className={cn(
                  "p-4 rounded-xl border text-center flex flex-col items-center gap-2 transition-all",
                  active
                    ? "border-accent bg-accent/5 ring-1 ring-accent text-foreground"
                    : "border-border hover:bg-muted text-muted-foreground"
                )}
              >
                <Icon size={20} className={active ? "text-accent" : "text-muted-foreground"} />
                <span className="text-xs font-semibold">{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Management */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Tags size={16} className="text-accent" />
            <span>Category Management</span>
          </div>
          <button
            onClick={() => setShowAddCat(true)}
            className="px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold flex items-center gap-1 shadow-sm hover:bg-accent/90 transition-all"
          >
            <Plus size={14} />
            New Category
          </button>
        </div>

        {/* Categories List */}
        {loadingCats ? (
          <div className="p-8 flex items-center justify-center text-xs text-muted-foreground gap-2">
            <Loader2 size={16} className="animate-spin" /> Loading categories...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: `${cat.color}20` }}
                  >
                    <span>{cat.icon}</span>
                  </div>
                  <div className="truncate">
                    <span className="text-xs font-semibold text-foreground block truncate">{cat.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {cat.is_default ? "Default" : "Custom"}
                    </span>
                  </div>
                </div>

                {!cat.is_default && (
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    disabled={deletingCatId === cat.id}
                    aria-label="Delete category"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-expense hover:bg-expense-muted transition-colors shrink-0"
                  >
                    {deletingCatId === cat.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security & Data Notice */}
      <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
          <Shield size={16} />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-foreground">Encrypted & Private</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            All your transaction logs, categories, and analytics are isolated with Row Level Security (RLS) on your Supabase cloud backend.
          </p>
        </div>
      </div>

      {/* New Category Modal */}
      {showAddCat && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-foreground mb-1">Create Custom Category</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Add a personalized category for sorting expenses and income.
            </p>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Subscriptions, Crypto, Gym"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-accent"
                  autoFocus
                />
              </div>

              {/* Icon Picker */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Select Icon
                </label>
                <div className="grid grid-cols-9 gap-1.5 max-h-32 overflow-y-auto p-1 bg-muted/40 rounded-xl border border-border">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewCatIcon(emoji)}
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-base hover:bg-background transition-all",
                        newCatIcon === emoji && "bg-background shadow-sm ring-2 ring-accent"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Swatch Picker */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Category Color
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCatColor(color)}
                      className={cn(
                        "w-7 h-7 rounded-full transition-transform",
                        newCatColor === color && "scale-125 ring-2 ring-foreground ring-offset-2 ring-offset-card"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCat(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCat || !newCatName.trim()}
                  className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-semibold shadow-md shadow-accent/25 hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingCat ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
