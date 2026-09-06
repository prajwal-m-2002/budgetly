"use client";

import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeleteConfirmDialogProps {
  open: boolean;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function DeleteConfirmDialog({
  open,
  description,
  onConfirm,
  onCancel,
  loading = false,
}: DeleteConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-expense-muted text-expense flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Delete transaction?</h2>
            <p className="text-xs text-muted-foreground mt-0.5">This can be undone immediately after.</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6 bg-muted rounded-xl px-3 py-2.5 font-medium text-foreground truncate">
          {description}
        </p>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-medium",
              "bg-muted text-foreground hover:bg-muted/70 transition-all",
              "disabled:opacity-50"
            )}
          >
            Cancel
          </button>
          <button
            id="btn-confirm-delete"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-semibold",
              "bg-expense text-white hover:opacity-90 transition-all",
              "disabled:opacity-50"
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Deleting…
              </span>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
