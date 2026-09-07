"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowDownToLine,
} from "lucide-react";
import { getTransactionsByRange, getAllActiveTransactions } from "@/lib/supabase/transactions";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/export";
import { getCurrentMonthRange, getPreviousMonthRange, getCurrentYearRange, formatINR, toISODateString } from "@/lib/dateUtils";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Transaction, TransactionType } from "@/types/database";
import { cn } from "@/lib/utils";

type DateFilterOption = "this_month" | "last_month" | "30_days" | "90_days" | "this_year" | "all" | "custom";

export function ExportPageClient() {
  const { user } = useAuth();

  const [dateFilter, setDateFilter] = useState<DateFilterOption>("this_month");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingType, setExportingType] = useState<"excel" | "pdf" | "csv" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const calculateRangeDates = useCallback((): { from?: string; to?: string; label: string } => {
    if (dateFilter === "this_month") {
      const cur = getCurrentMonthRange();
      return { from: cur.from, to: cur.to, label: cur.label };
    }

    if (dateFilter === "last_month") {
      const prev = getPreviousMonthRange();
      return { from: prev.from, to: prev.to, label: prev.label };
    }

    if (dateFilter === "30_days") {
      const now = new Date();
      const past = new Date();
      past.setDate(past.getDate() - 30);
      return { from: toISODateString(past), to: toISODateString(now), label: "Last 30 Days" };
    }

    if (dateFilter === "90_days") {
      const now = new Date();
      const past = new Date();
      past.setDate(past.getDate() - 90);
      return { from: toISODateString(past), to: toISODateString(now), label: "Last 90 Days" };
    }

    if (dateFilter === "this_year") {
      const yr = getCurrentYearRange();
      return { from: yr.from, to: yr.to, label: yr.label };
    }

    if (dateFilter === "custom" && customFrom && customTo) {
      return { from: customFrom, to: customTo, label: `${customFrom} to ${customTo}` };
    }

    return { label: "All Recorded Transactions" };
  }, [dateFilter, customFrom, customTo]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = calculateRangeDates();
      let data: Transaction[] = [];

      if (from && to) {
        data = await getTransactionsByRange(from, to);
      } else {
        data = await getAllActiveTransactions();
      }

      setTransactions(data);
    } catch (err) {
      console.error("Export load error:", err);
    } finally {
      setLoading(false);
    }
  }, [calculateRangeDates]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter by Type (expense, income, all)
  const filteredTransactions = transactions.filter((t) => {
    if (typeFilter === "all") return true;
    return t.type === typeFilter;
  });

  const totalExpense = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const balance = totalIncome - totalExpense;

  const summary = { totalExpense, totalIncome, balance };
  const { label: dateLabel } = calculateRangeDates();

  function triggerFeedback(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  }

  const handleExport = async (format: "excel" | "pdf" | "csv") => {
    if (filteredTransactions.length === 0) {
      triggerFeedback("No transactions available to export for the selected filters.");
      return;
    }

    setExportingType(format);
    const dateSlug = toISODateString();

    try {
      if (format === "excel") {
        exportToExcel(filteredTransactions, summary, `Budgetly-Export-${dateSlug}.xlsx`);
        triggerFeedback("Excel (.xlsx) workbook downloaded successfully!");
      } else if (format === "csv") {
        exportToCSV(filteredTransactions, `Budgetly-Transactions-${dateSlug}.csv`);
        triggerFeedback("CSV file exported successfully!");
      } else if (format === "pdf") {
        const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Budgetly User";
        exportToPDF(filteredTransactions, summary, {
          userName,
          userEmail: user?.email || "",
          dateRangeLabel: dateLabel,
          filename: `Budgetly-Statement-${dateSlug}.pdf`,
        });
        triggerFeedback("PDF Statement downloaded successfully!");
      }
    } catch (err) {
      console.error(err);
      triggerFeedback("Failed to generate export file.");
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto lg:px-8 lg:py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Export Financial Data</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate customized reports, spreadsheets, and official PDF statements
        </p>
      </div>

      {/* Filter Toolbar Card */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter size={16} className="text-accent" />
          <span>Report Filters</span>
        </div>

        {/* Date presets */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Time Period
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "this_month", label: "This Month" },
              { id: "last_month", label: "Last Month" },
              { id: "30_days", label: "Last 30 Days" },
              { id: "90_days", label: "Last 90 Days" },
              { id: "this_year", label: "This Year" },
              { id: "all", label: "All Time" },
              { id: "custom", label: "Custom Range" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setDateFilter(opt.id as DateFilterOption)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all",
                  dateFilter === opt.id
                    ? "bg-accent text-white shadow-sm shadow-accent/25"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Inputs if selected */}
        {dateFilter === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">From Date</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">To Date</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
        )}

        {/* Type Filter */}
        <div className="pt-2 border-t border-border/60">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Transaction Type
          </label>
          <div className="flex gap-2">
            {[
              { id: "all", label: "All Transactions" },
              { id: "expense", label: "Expenses Only" },
              { id: "income", label: "Income Only" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTypeFilter(opt.id as "all" | TransactionType)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all",
                  typeFilter === opt.id
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Metrics of Filtered Selection */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-expense/20 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Expense</span>
            <TrendingDown size={16} className="text-expense" />
          </div>
          <p className="text-base sm:text-lg font-bold text-expense tabular-nums mt-1">
            {formatINR(totalExpense)}
          </p>
        </div>

        <div className="bg-card border border-income/20 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Income</span>
            <TrendingUp size={16} className="text-income" />
          </div>
          <p className="text-base sm:text-lg font-bold text-income tabular-nums mt-1">
            {formatINR(totalIncome)}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Transactions</span>
            <Wallet size={16} className="text-accent" />
          </div>
          <p className="text-base sm:text-lg font-bold text-foreground tabular-nums mt-1">
            {filteredTransactions.length} items
          </p>
        </div>
      </div>

      {/* Export Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Excel Card */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-accent/40 transition-all">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
              <FileSpreadsheet size={22} />
            </div>
            <h3 className="font-bold text-foreground text-sm">Excel Workbook (.xlsx)</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Multi-tab spreadsheet with summary KPI sheets, detailed transaction records, and category distribution.
            </p>
          </div>
          <button
            onClick={() => handleExport("excel")}
            disabled={loading || exportingType !== null || filteredTransactions.length === 0}
            className="mt-5 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {exportingType === "excel" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArrowDownToLine size={14} />
            )}
            Download Excel (.xlsx)
          </button>
        </div>

        {/* PDF Card */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-accent/40 transition-all">
          <div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3">
              <FileText size={22} />
            </div>
            <h3 className="font-bold text-foreground text-sm">PDF Statement (.pdf)</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Formal branded account statement formatted for printing, tax records, or permanent PDF storage.
            </p>
          </div>
          <button
            onClick={() => handleExport("pdf")}
            disabled={loading || exportingType !== null || filteredTransactions.length === 0}
            className="mt-5 w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {exportingType === "pdf" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArrowDownToLine size={14} />
            )}
            Download PDF (.pdf)
          </button>
        </div>

        {/* CSV Card */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-accent/40 transition-all">
          <div>
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-3">
              <Download size={22} />
            </div>
            <h3 className="font-bold text-foreground text-sm">CSV Spreadsheet (.csv)</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Raw comma-separated data file for importing into Google Sheets, Notion, or custom accounting tools.
            </p>
          </div>
          <button
            onClick={() => handleExport("csv")}
            disabled={loading || exportingType !== null || filteredTransactions.length === 0}
            className="mt-5 w-full py-2.5 px-4 rounded-xl bg-accent hover:bg-accent/90 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {exportingType === "csv" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArrowDownToLine size={14} />
            )}
            Download CSV (.csv)
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={16} className="text-income" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Transactions Data Preview */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Preview Data ({filteredTransactions.length} records)
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground text-xs gap-2">
            <Loader2 size={16} className="animate-spin" />
            Loading records...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-10 text-center text-xs text-muted-foreground">
            No transactions found for the selected date range and filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-80 divide-y divide-border">
            {filteredTransactions.slice(0, 50).map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between hover:bg-muted/40 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-base">{t.categories?.icon || (t.type === "expense" ? "💸" : "💰")}</span>
                  <div className="truncate">
                    <p className="font-semibold text-foreground truncate">{t.description}</p>
                    <p className="text-[11px] text-muted-foreground">{t.date} • {t.categories?.name || "General"}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    "font-bold tabular-nums ml-4 shrink-0",
                    t.type === "expense" ? "text-expense" : "text-income"
                  )}
                >
                  {t.type === "expense" ? "-" : "+"}
                  {formatINR(Number(t.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
