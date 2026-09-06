import type { Metadata } from "next";
import { ExportPageClient } from "@/components/pages/ExportPageClient";

export const metadata: Metadata = {
  title: "Export",
  description: "Export your financial data as Excel or PDF reports with customizable date filters.",
};

export default function ExportPage() {
  return <ExportPageClient />;
}
