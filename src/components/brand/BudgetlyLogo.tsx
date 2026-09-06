"use client";

import { cn } from "@/lib/utils";

interface BudgetlyLogoProps {
  collapsed?: boolean;
  className?: string;
}

export function BudgetlyLogo({ collapsed = false, className }: BudgetlyLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Animated $ logo mark */}
      <div className="relative flex-shrink-0">
        <div className="logo-mark w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/25">
          <span className="logo-symbol text-white font-bold text-lg leading-none select-none">
            ₹
          </span>
        </div>
      </div>

      {/* Wordmark */}
      {!collapsed && (
        <span className="text-foreground font-bold text-xl tracking-tight select-none">
          Budgetly
        </span>
      )}
    </div>
  );
}
