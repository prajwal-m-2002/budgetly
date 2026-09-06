import type { Metadata } from "next";
import { AnalysisPageClient } from "@/components/pages/AnalysisPageClient";

export const metadata: Metadata = {
  title: "Analysis",
  description: "Visualize your spending patterns with charts, category breakdowns, and spending insights.",
};

export default function AnalysisPage() {
  return <AnalysisPageClient />;
}
