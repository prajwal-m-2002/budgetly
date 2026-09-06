import { BudgetlyLogo } from "@/components/brand/BudgetlyLogo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, hsl(243 75% 59% / 0.08) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <BudgetlyLogo />
        </div>

        {/* Auth card */}
        <div className="bg-card border border-border rounded-2xl shadow-xl p-7">
          {children}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Your financial data is encrypted and secure.
        </p>
      </div>
    </div>
  );
}
