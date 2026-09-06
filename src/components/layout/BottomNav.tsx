"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/analysis", label: "Analysis", icon: BarChart2 },
  { href: "/export", label: "Export", icon: Download },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border pb-safe"
      aria-label="Bottom navigation"
    >
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              id={`bottom-nav-${label.toLowerCase()}`}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-xl min-w-[64px]",
                "transition-all duration-200 group",
                isActive
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="relative">
                {isActive && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-accent" />
                )}
                <Icon
                  size={20}
                  className={cn(
                    "transition-transform duration-200",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )}
                />
              </span>
              <span className={cn("text-[10px] font-medium", isActive ? "text-accent" : "")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
