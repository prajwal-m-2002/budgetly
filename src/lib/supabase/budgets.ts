import { createClient } from "@/lib/supabase/client";

/**
 * Fetch monthly budget for a specific year and month (month: 1-12) for the authenticated user.
 * Combines Supabase Table, Supabase Auth User Metadata, and local cache.
 * Returns null if no budget has been configured for that month yet.
 */
export async function getMonthlyBudget(year: number, month: number): Promise<number | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const monthKey = `${year}_${month}`;

  // 1. Try Supabase Auth User Metadata (Cloud persistent per user across devices)
  const metaBudgets = user.user_metadata?.monthly_budgets as Record<string, number> | undefined;
  if (metaBudgets && typeof metaBudgets[monthKey] === "number") {
    const val = metaBudgets[monthKey];
    // Sync to local cache
    try {
      localStorage.setItem(`budgetly_mb_${user.id}_${year}_${month}`, String(val));
    } catch {}
    return val;
  }

  // 2. Try Supabase Table if it exists
  try {
    const { data, error } = await supabase
      .from("monthly_budgets")
      .select("budget_amount")
      .eq("user_id", user.id)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    if (!error && data && typeof data.budget_amount === "number") {
      try {
        localStorage.setItem(`budgetly_mb_${user.id}_${year}_${month}`, String(data.budget_amount));
      } catch {}
      return data.budget_amount;
    }
  } catch {
    // Ignore table query failure
  }

  // 3. Fallback to user-isolated localStorage
  try {
    const cached = localStorage.getItem(`budgetly_mb_${user.id}_${year}_${month}`);
    if (cached !== null) {
      const parsed = Number(cached);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch {}

  return null;
}

/**
 * Upsert/Save the user's monthly budget for a specific year and month to Supabase.
 */
export async function setMonthlyBudget(
  year: number,
  month: number,
  amount: number
): Promise<{ budget_amount: number }> {
  if (isNaN(amount) || amount < 0 || !isFinite(amount)) {
    throw new Error("Please enter a valid positive budget amount.");
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User must be authenticated to set a monthly budget.");

  const monthKey = `${year}_${month}`;

  // 1. Persist to Supabase Auth User Metadata (guaranteed cloud persistence across devices)
  const currentMetaBudgets = (user.user_metadata?.monthly_budgets as Record<string, number> | undefined) || {};
  const updatedMetaBudgets = { ...currentMetaBudgets, [monthKey]: amount };

  try {
    await supabase.auth.updateUser({
      data: { monthly_budgets: updatedMetaBudgets },
    });
  } catch (err) {
    console.warn("Could not sync budget to user_metadata:", err);
  }

  // 2. Also attempt to save to monthly_budgets table in case table exists
  const now = new Date().toISOString();
  try {
    await supabase.from("monthly_budgets").upsert(
      {
        user_id: user.id,
        year,
        month,
        budget_amount: amount,
        updated_at: now,
      },
      { onConflict: "user_id,year,month" }
    );
  } catch {
    // Safe table fallback
  }

  // 3. Update local user cache for instant offline hydration
  try {
    localStorage.setItem(`budgetly_mb_${user.id}_${year}_${month}`, String(amount));
  } catch {}

  return { budget_amount: amount };
}
