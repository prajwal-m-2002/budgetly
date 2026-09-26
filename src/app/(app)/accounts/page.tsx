import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountsPageClient } from "@/components/pages/AccountsPageClient";

export const metadata: Metadata = {
  title: "Expense Accounts",
  description: "Manage Main and Secondary expense accounts (SBI, Kotak, Cash, etc.) with dedicated balances and tracking.",
};

export default function AccountsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Loading accounts...</div>}>
      <AccountsPageClient />
    </Suspense>
  );
}
