"use client";

import { useEffect } from "react";
import { Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UndoToastProps {
  visible: boolean;
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ visible, message, onUndo, onDismiss }: UndoToastProps) {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[70]",
        "flex items-center gap-3 px-4 py-3 rounded-2xl",
        "bg-foreground text-background shadow-xl",
        "text-sm font-medium whitespace-nowrap",
        "transition-all duration-300",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-2 pointer-events-none"
      )}
    >
      <span className="truncate max-w-[180px]">{message}</span>
      <button
        onClick={onUndo}
        className="flex items-center gap-1.5 text-accent font-semibold hover:opacity-80 transition-opacity"
      >
        <Undo2 size={14} />
        Undo
      </button>
      <button
        onClick={onDismiss}
        className="text-background/60 hover:text-background transition-colors ml-1"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
