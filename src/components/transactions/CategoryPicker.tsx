"use client";

import { cn } from "@/lib/utils";
import type { Category } from "@/types/database";

interface CategoryPickerProps {
  categories: Category[];
  selected: string | null;
  onSelect: (id: string) => void;
  onAddNew: () => void;
}

export function CategoryPicker({
  categories,
  selected,
  onSelect,
  onAddNew,
}: CategoryPickerProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium",
              "border transition-all duration-150",
              selected === cat.id
                ? "text-white border-transparent shadow-sm"
                : "bg-muted border-border text-muted-foreground hover:text-foreground hover:bg-muted/80"
            )}
            style={
              selected === cat.id
                ? { backgroundColor: cat.color, borderColor: cat.color }
                : {}
            }
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}

        {/* Add new category */}
        <button
          type="button"
          onClick={onAddNew}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium",
            "border border-dashed border-border text-muted-foreground",
            "hover:border-accent hover:text-accent transition-all duration-150"
          )}
        >
          <span>+</span>
          <span>Add</span>
        </button>
      </div>
    </div>
  );
}
