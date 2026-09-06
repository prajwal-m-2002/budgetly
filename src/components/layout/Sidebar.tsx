"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, BarChart2, Download, Settings, LogOut } from "lucide-react";
import { BudgetlyLogo } from "@/components/brand/BudgetlyLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/analysis", label: "Analysis", icon: BarChart2 },
  { href: "/export", label: "Export", icon: Download },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  // Get user display name/initials
  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 flex flex-col bg-card border-r border-border z-40">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-border">
        <BudgetlyLogo />
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              id={`sidebar-nav-${label.toLowerCase()}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                isActive
                  ? "bg-accent text-white shadow-sm shadow-accent/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon
                size={18}
                className={cn(
                  "transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-white" : ""
                )}
              />
              <span>{label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: User + Settings + Theme */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        {/* Settings */}
        <Link
          href="/settings"
          id="sidebar-nav-settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
            pathname === "/settings"
              ? "bg-accent text-white shadow-sm shadow-accent/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Settings size={18} className="transition-transform duration-200 group-hover:rotate-45" />
          <span>Settings</span>
        </Link>

        {/* Theme toggle */}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>

        {/* User info + sign out */}
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted mt-2">
            {/* Avatar */}
            <div className="w-7 h-7 rounded-lg bg-accent text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
              {user.user_metadata?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.user_metadata.avatar_url}
                  alt={displayName}
                  className="w-full h-full rounded-lg object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
            <button
              id="btn-sign-out"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="text-muted-foreground hover:text-expense transition-colors p-1 rounded-lg hover:bg-expense-muted"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
