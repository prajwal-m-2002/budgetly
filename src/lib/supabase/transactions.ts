import { createClient } from "@/lib/supabase/client";
import type {
  Transaction,
  TransactionInsert,
  TransactionUpdate,
  DashboardSummary,
} from "@/types/database";

/** Fetch active (non-deleted) transactions, newest first, with category join */
export async function getTransactions(limit = 50): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, categories(*)")
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("getTransactions primary query error, attempting fallback:", error.message || error);
    // Fallback in case join syntax has schema caching delay
    const { data: fallback, error: fallbackError } = await supabase
      .from("transactions")
      .select("*")
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fallbackError) {
      console.error("getTransactions fallback error:", fallbackError);
      throw fallbackError;
    }
    return (fallback as Transaction[]) ?? [];
  }
  return data ?? [];
}

/** Fetch transactions within a date range */
export async function getTransactionsByRange(
  from: string,
  to: string
): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, categories(*)")
    .is("deleted_at", null)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("getTransactionsByRange primary error, attempting fallback:", error.message || error);
    const { data: fallback, error: fallbackError } = await supabase
      .from("transactions")
      .select("*")
      .is("deleted_at", null)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (fallbackError) throw fallbackError;
    return (fallback as Transaction[]) ?? [];
  }
  return data ?? [];
}

/** Insert a new transaction */
export async function createTransaction(
  values: TransactionInsert
): Promise<Transaction> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("transactions")
    .insert({ ...values, user_id: user.id })
    .select("*, categories(*)")
    .single();

  if (error) {
    console.warn("createTransaction primary error, attempting fallback:", error.message || error);
    const { data: fallback, error: fallbackError } = await supabase
      .from("transactions")
      .insert({ ...values, user_id: user.id })
      .select("*")
      .single();

    if (fallbackError) throw fallbackError;
    return fallback as Transaction;
  }
  return data;
}

/** Update an existing transaction */
export async function updateTransaction(
  id: string,
  values: TransactionUpdate
): Promise<Transaction> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .update(values)
    .eq("id", id)
    .select("*, categories(*)")
    .single();

  if (error) {
    console.warn("updateTransaction primary error, attempting fallback:", error.message || error);
    const { data: fallback, error: fallbackError } = await supabase
      .from("transactions")
      .update(values)
      .eq("id", id)
      .select("*")
      .single();

    if (fallbackError) throw fallbackError;
    return fallback as Transaction;
  }
  return data;
}

/** Soft-delete a transaction (sets deleted_at, keeps row in DB) */
export async function softDeleteTransaction(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

/** Undo a soft-delete (restore by clearing deleted_at) */
export async function restoreTransaction(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw error;
}

/** Calculate dashboard summary totals */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount")
    .is("deleted_at", null);

  if (error) {
    console.error("getDashboardSummary query error:", error);
    return { totalExpense: 0, totalIncome: 0, balance: 0 };
  }

  const totals = (data ?? []).reduce(
    (acc, t) => {
      if (t.type === "expense") acc.totalExpense += Number(t.amount);
      else acc.totalIncome += Number(t.amount);
      return acc;
    },
    { totalExpense: 0, totalIncome: 0 }
  );

  return {
    ...totals,
    balance: totals.totalIncome - totals.totalExpense,
  };
}
