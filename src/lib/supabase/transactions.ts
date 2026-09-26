import { createClient } from "@/lib/supabase/client";
import { getAccounts, getMainAccount } from "@/lib/supabase/accounts";
import type {
  Transaction,
  TransactionInsert,
  TransactionUpdate,
  DashboardSummary,
  Account,
} from "@/types/database";

/** Helper to attach account objects to transactions if join was not performed */
async function hydrateAccounts(transactions: Transaction[], accountsList?: Account[]): Promise<Transaction[]> {
  if (transactions.length === 0) return transactions;
  const accounts = accountsList || (await getAccounts());
  const accountMap = new Map<string, Account>();
  accounts.forEach((a) => accountMap.set(a.id, a));

  const mainAccount = accounts.find((a) => a.type === "MAIN") || accounts[0];

  return transactions.map((t) => {
    if (t.accounts) return t;
    if (t.account_id && accountMap.has(t.account_id)) {
      return { ...t, accounts: accountMap.get(t.account_id) };
    }
    // Legacy or unassigned transactions belong to MAIN account
    if (mainAccount) {
      return { ...t, account_id: t.account_id || mainAccount.id, accounts: mainAccount };
    }
    return t;
  });
}

/** Fetch active (non-deleted) transactions across history, optionally filtered by account */
export async function getTransactions(
  limit = 50,
  offset = 0,
  accountId?: string | null
): Promise<Transaction[]> {
  const supabase = createClient();
  let query = supabase
    .from("transactions")
    .select("*, categories(*)")
    .is("deleted_at", null);

  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  const { data, error } = await query
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    let fallbackQuery = supabase
      .from("transactions")
      .select("*")
      .is("deleted_at", null);

    const { data: fallback, error: fallbackError } = await fallbackQuery
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (fallbackError) {
      return [];
    }
    let hydrated = await hydrateAccounts((fallback as Transaction[]) ?? []);
    if (accountId) {
      hydrated = hydrated.filter((t) => t.account_id === accountId);
    }
    return hydrated;
  }

  const hydrated = await hydrateAccounts((data as Transaction[]) ?? []);
  return hydrated;
}

/** Get total count of active non-deleted transactions, optionally filtered by account */
export async function getActiveTransactionCount(accountId?: string | null): Promise<number> {
  const supabase = createClient();
  let query = supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  const { count, error } = await query;

  if (error) {
    const { count: fallbackCount, error: fallbackErr } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null);
    if (fallbackErr) return 0;
    return fallbackCount ?? 0;
  }
  return count ?? 0;
}

/** Fetch transactions within a date range, optionally filtered by account */
export async function getTransactionsByRange(
  from: string,
  to: string,
  accountId?: string | null
): Promise<Transaction[]> {
  const supabase = createClient();
  let query = supabase
    .from("transactions")
    .select("*, categories(*)")
    .is("deleted_at", null)
    .gte("date", from)
    .lte("date", to);

  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  const { data, error } = await query
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    let fallbackQuery = supabase
      .from("transactions")
      .select("*")
      .is("deleted_at", null)
      .gte("date", from)
      .lte("date", to);

    const { data: fallback, error: fallbackError } = await fallbackQuery
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (fallbackError) return [];
    let hydrated = await hydrateAccounts((fallback as Transaction[]) ?? []);
    if (accountId) {
      hydrated = hydrated.filter((t) => t.account_id === accountId);
    }
    return hydrated;
  }
  return hydrateAccounts((data as Transaction[]) ?? []);
}

/** Fetch all active transactions for analysis / reporting, optionally filtered by account */
export async function getAllActiveTransactions(
  limit = 2000,
  accountId?: string | null
): Promise<Transaction[]> {
  const supabase = createClient();
  let query = supabase
    .from("transactions")
    .select("*, categories(*)")
    .is("deleted_at", null);

  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  const { data, error } = await query
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    let fallbackQuery = supabase
      .from("transactions")
      .select("*")
      .is("deleted_at", null);

    const { data: fallback, error: fallbackError } = await fallbackQuery
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fallbackError) {
      return [];
    }
    let hydrated = await hydrateAccounts((fallback as Transaction[]) ?? []);
    if (accountId) {
      hydrated = hydrated.filter((t) => t.account_id === accountId);
    }
    return hydrated;
  }
  return hydrateAccounts((data as Transaction[]) ?? []);
}

/** Insert a new transaction */
export async function createTransaction(
  values: TransactionInsert
): Promise<Transaction> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Ensure account_id is populated, defaulting to MAIN account
  let resolvedAccountId = values.account_id;
  if (!resolvedAccountId) {
    const mainAcc = await getMainAccount();
    resolvedAccountId = mainAcc.id;
  }

  const insertPayload = {
    ...values,
    account_id: resolvedAccountId,
    user_id: user.id,
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert(insertPayload)
    .select("*, categories(*)")
    .single();

  if (error) {
    console.warn("createTransaction primary error, attempting fallback:", error.message || error);
    // If account_id column is not yet in schema cache, try inserting without account_id
    const { data: fallback, error: fallbackError } = await supabase
      .from("transactions")
      .insert({ ...values, user_id: user.id })
      .select("*")
      .single();

    if (fallbackError) throw fallbackError;
    const [hydrated] = await hydrateAccounts([fallback as Transaction]);
    return hydrated;
  }

  const [hydrated] = await hydrateAccounts([data as Transaction]);
  return hydrated;
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
    const [hydrated] = await hydrateAccounts([fallback as Transaction]);
    return hydrated;
  }

  const [hydrated] = await hydrateAccounts([data as Transaction]);
  return hydrated;
}

/** Soft-delete a transaction */
export async function softDeleteTransaction(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

/** Undo a soft-delete */
export async function restoreTransaction(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Calculate dashboard summary totals.
 * CRITICAL RULE: By default (or when accountScope === "MAIN"), only calculates
 * transactions belonging to the Main Account (and legacy transactions where account_id is null).
 * Secondary account transactions (e.g. Kotak) are strictly excluded from the Main Dashboard calculations!
 */
export async function getDashboardSummary(
  from?: string,
  to?: string,
  accountScope: "MAIN" | "ALL" | string = "MAIN"
): Promise<DashboardSummary> {
  const supabase = createClient();
  let query = supabase
    .from("transactions")
    .select("type, amount, date, account_id")
    .is("deleted_at", null);

  if (from) {
    query = query.gte("date", from);
  }
  if (to) {
    query = query.lte("date", to);
  }

  let { data, error } = await query;

  if (error) {
    // If account_id column is not in DB schema yet, fallback to type, amount, date query
    let fallbackQuery = supabase
      .from("transactions")
      .select("type, amount, date")
      .is("deleted_at", null);

    if (from) fallbackQuery = fallbackQuery.gte("date", from);
    if (to) fallbackQuery = fallbackQuery.lte("date", to);

    const fallbackRes = await fallbackQuery;
    if (fallbackRes.error) {
      return { totalExpense: 0, totalIncome: 0, balance: 0 };
    }
    data = fallbackRes.data as any;
  }

  const accounts = await getAccounts();
  const secondaryAccountIds = new Set(
    accounts.filter((a) => a.type === "SECONDARY").map((a) => a.id)
  );

  const filteredData = (data ?? []).filter((t: any) => {
    if (accountScope === "ALL") return true;

    if (accountScope === "MAIN") {
      // Must not belong to any known secondary account
      if (t.account_id && secondaryAccountIds.has(t.account_id)) {
        return false;
      }
      // If t.account_id is null or unmapped legacy or main, include in MAIN
      return true;
    }

    // Specific account ID
    return t.account_id === accountScope;
  });

  const totals = filteredData.reduce(
    (acc, t: any) => {
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

