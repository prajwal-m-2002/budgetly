import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Transaction } from "@/types/database";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Export transactions to CSV */
export function exportToCSV(transactions: Transaction[], filename = "budgetly-transactions.csv") {
  const headers = ["ID", "Date", "Type", "Category", "Description", "Amount (INR)", "Note", "Received From"];
  const rows = transactions.map((t) => [
    t.id,
    t.date,
    t.type.toUpperCase(),
    t.categories?.name || "Uncategorized",
    `"${(t.description || "").replace(/"/g, '""')}"`,
    t.type === "expense" ? -Math.abs(Number(t.amount)) : Number(t.amount),
    `"${(t.note || "").replace(/"/g, '""')}"`,
    `"${(t.received_from || "").replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Export transactions to Excel (.xlsx) */
export function exportToExcel(
  transactions: Transaction[],
  summary: { totalExpense: number; totalIncome: number; balance: number },
  filename = "budgetly-financial-report.xlsx"
) {
  // Sheet 1: Transactions
  const txnData = transactions.map((t, idx) => ({
    "S.No": idx + 1,
    Date: t.date,
    Type: t.type === "expense" ? "Expense" : "Income",
    Category: t.categories?.name || "General",
    Description: t.description,
    "Expense (INR)": t.type === "expense" ? Number(t.amount) : 0,
    "Income (INR)": t.type === "income" ? Number(t.amount) : 0,
    "Received From / Payee": t.received_from || "-",
    Note: t.note || "-",
  }));

  const txnWorksheet = XLSX.utils.json_to_sheet(txnData);

  // Sheet 2: Summary Breakdown
  const catSummaryMap: Record<string, { total: number; count: number; type: string }> = {};
  for (const t of transactions) {
    const catName = t.categories?.name || (t.type === "expense" ? "Other Expense" : "Other Income");
    if (!catSummaryMap[catName]) {
      catSummaryMap[catName] = { total: 0, count: 0, type: t.type };
    }
    catSummaryMap[catName].total += Number(t.amount);
    catSummaryMap[catName].count += 1;
  }

  const categoryData = Object.entries(catSummaryMap).map(([cat, data]) => ({
    Category: cat,
    Type: data.type.toUpperCase(),
    "Total Amount (INR)": data.total,
    "Transaction Count": data.count,
  }));

  const summaryData = [
    { Metric: "Total Inflow (Income)", "Value (INR)": summary.totalIncome },
    { Metric: "Total Outflow (Expense)", "Value (INR)": summary.totalExpense },
    { Metric: "Net Cashflow (Balance)", "Value (INR)": summary.balance },
    { Metric: "Total Transactions", "Value (INR)": transactions.length },
    { Metric: "Report Generated On", "Value (INR)": new Date().toLocaleString("en-IN") },
  ];

  const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
  const categoryWorksheet = XLSX.utils.json_to_sheet(categoryData);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Executive Summary");
  XLSX.utils.book_append_sheet(workbook, txnWorksheet, "All Transactions");
  XLSX.utils.book_append_sheet(workbook, categoryWorksheet, "Category Breakdown");

  XLSX.writeFile(workbook, filename);
}

/** Export transactions to Professional PDF Statement */
export function exportToPDF(
  transactions: Transaction[],
  summary: { totalExpense: number; totalIncome: number; balance: number },
  options: {
    userName: string;
    userEmail: string;
    dateRangeLabel: string;
    filename?: string;
  }
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Top Header Banner
  doc.setFillColor(99, 102, 241); // #6366f1 Indigo
  doc.rect(0, 0, pageWidth, 24, "F");

  // App Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("BUDGETLY — Financial Statement", 14, 15);

  // Statement Meta Header
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}`, pageWidth - 14, 15, { align: "right" });

  // Account Information Section
  doc.setTextColor(33, 37, 41);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Account Overview", 14, 34);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Account Holder: ${options.userName || "Budgetly User"} (${options.userEmail || "Personal Account"})`, 14, 40);
  doc.text(`Statement Period: ${options.dateRangeLabel}`, 14, 45);

  // Financial Summary Cards Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 50, pageWidth - 28, 26, 3, 3, "FD");

  const colWidth = (pageWidth - 28) / 3;

  // Income Card
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL INCOME", 14 + 6, 58);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129); // Green
  doc.text(formatCurrency(summary.totalIncome), 14 + 6, 68);

  // Expense Card
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL EXPENSES", 14 + colWidth + 6, 58);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(239, 68, 68); // Red
  doc.text(formatCurrency(summary.totalExpense), 14 + colWidth + 6, 68);

  // Net Balance Card
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("NET CASHFLOW", 14 + colWidth * 2 + 6, 58);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(summary.balance >= 0 ? 99 : 239, summary.balance >= 0 ? 102 : 68, summary.balance >= 0 ? 241 : 68);
  doc.text(formatCurrency(summary.balance), 14 + colWidth * 2 + 6, 68);

  // Transactions Table
  const tableData = transactions.map((t, idx) => [
    idx + 1,
    t.date,
    t.description,
    t.categories?.name || "General",
    t.type.toUpperCase(),
    `${t.type === "expense" ? "-" : "+"}${formatCurrency(Number(t.amount))}`,
  ]);

  autoTable(doc, {
    startY: 82,
    head: [["#", "Date", "Description", "Category", "Type", "Amount (INR)"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 24 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 32 },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 35, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const text = String(data.cell.raw);
        if (text.startsWith("+")) {
          data.cell.styles.textColor = [16, 185, 129];
        } else if (text.startsWith("-")) {
          data.cell.styles.textColor = [239, 68, 68];
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Budgetly Financial Manager — Page ${i} of ${totalPages} — Confidential`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  doc.save(options.filename || "budgetly-statement.pdf");
}
