import type { Metadata } from "next";
import { SettingsPageClient } from "@/components/pages/SettingsPageClient";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your Budgetly preferences, currency, categories, and account settings.",
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}
