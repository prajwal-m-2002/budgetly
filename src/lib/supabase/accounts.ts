import { createClient } from "@/lib/supabase/client";
import type { Account, AccountInsert, AccountUpdate } from "@/types/database";

export const DEFAULT_ACCOUNTS: Omit<Account, "id" | "user_id" | "created_at" | "updated_at">[] = [
  {
    name: "SBI",
    type: "MAIN",
    icon: "🏦",
    color: "#3b82f6",
    is_active: true,
  },
  {
    name: "Kotak",
    type: "SECONDARY",
    icon: "🏛️",
    color: "#ef4444",
    is_active: true,
  },
];

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Helper to sync accounts to Supabase Auth User Metadata
 * ensuring cloud persistence across devices even without DB migration.
 */
async function syncAccountsToUserMeta(accounts: Account[]): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.auth.updateUser({
      data: { accounts },
    });
  } catch (err) {
    console.warn("Could not sync accounts to user_metadata:", err);
  }
}

/**
 * Fetch all accounts for the authenticated user.
 * Combines Supabase Table, User Metadata, and LocalStorage cache with auto-seeding.
 */
export async function getAccounts(): Promise<Account[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 1. Try querying Supabase Table
  try {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (!error && data && data.length > 0) {
      // Sync to local cache
      try {
        localStorage.setItem(`budgetly_accounts_${user.id}`, JSON.stringify(data));
      } catch {}
      return sortAccounts(data as Account[]);
    }

    // If table exists but empty for this user, attempt auto-seed to table
    if (!error && (!data || data.length === 0)) {
      const now = new Date().toISOString();
      const initialInserts = DEFAULT_ACCOUNTS.map((acc, index) => ({
        user_id: user.id,
        name: acc.name,
        type: acc.type,
        icon: acc.icon,
        color: acc.color,
        is_active: true,
        created_at: new Date(Date.now() + index * 1000).toISOString(),
        updated_at: now,
      }));

      const { data: seeded, error: seedError } = await supabase
        .from("accounts")
        .insert(initialInserts)
        .select();

      if (!seedError && seeded && seeded.length > 0) {
        try {
          localStorage.setItem(`budgetly_accounts_${user.id}`, JSON.stringify(seeded));
        } catch {}
        return sortAccounts(seeded as Account[]);
      }
    }
  } catch (tableErr) {
    console.warn("Accounts table query fallback to user_metadata:", tableErr);
  }

  // 2. Try Supabase Auth User Metadata (Cloud storage fallback)
  const metaAccounts = user.user_metadata?.accounts as Account[] | undefined;
  if (metaAccounts && Array.isArray(metaAccounts) && metaAccounts.length > 0) {
    try {
      localStorage.setItem(`budgetly_accounts_${user.id}`, JSON.stringify(metaAccounts));
    } catch {}
    return sortAccounts(metaAccounts);
  }

  // 3. Fallback to user-isolated localStorage
  try {
    const cached = localStorage.getItem(`budgetly_accounts_${user.id}`);
    if (cached) {
      const parsed = JSON.parse(cached) as Account[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortAccounts(parsed);
      }
    }
  } catch {}

  // 4. Initial Seed in User Metadata & LocalStorage
  const now = new Date().toISOString();
  const seededAccounts: Account[] = DEFAULT_ACCOUNTS.map((acc, idx) => ({
    id: generateUUID(),
    user_id: user.id,
    name: acc.name,
    type: acc.type,
    icon: acc.icon,
    color: acc.color,
    is_active: true,
    created_at: new Date(Date.now() + idx * 1000).toISOString(),
    updated_at: now,
  }));

  try {
    localStorage.setItem(`budgetly_accounts_${user.id}`, JSON.stringify(seededAccounts));
  } catch {}

  syncAccountsToUserMeta(seededAccounts).catch(() => {});

  return sortAccounts(seededAccounts);
}

/**
 * Return the current MAIN account for the user.
 */
export async function getMainAccount(): Promise<Account> {
  const accounts = await getAccounts();
  const main = accounts.find((a) => a.type === "MAIN" && a.is_active !== false);
  if (main) return main;
  if (accounts.length > 0) return accounts[0];

  return {
    id: generateUUID(),
    user_id: "",
    name: "SBI",
    type: "MAIN",
    icon: "🏦",
    color: "#3b82f6",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Create a new account.
 * If type is MAIN, demotes any other MAIN account to SECONDARY.
 */
export async function createAccount(values: AccountInsert): Promise<Account> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const name = values.name.trim();
  if (!name) throw new Error("Account name is required");

  const type = values.type || "SECONDARY";
  const icon = values.icon || "🏦";
  const color = values.color || (type === "MAIN" ? "#3b82f6" : "#ef4444");
  const now = new Date().toISOString();

  // If new account is MAIN, demote existing MAIN accounts
  if (type === "MAIN") {
    try {
      await supabase
        .from("accounts")
        .update({ type: "SECONDARY", updated_at: now })
        .eq("user_id", user.id)
        .eq("type", "MAIN");
    } catch {}
  }

  // 1. Attempt Supabase Table Insert
  try {
    const { data, error } = await supabase
      .from("accounts")
      .insert({
        user_id: user.id,
        name,
        type,
        icon,
        color,
        is_active: values.is_active ?? true,
        updated_at: now,
      })
      .select()
      .single();

    if (!error && data) {
      const allAccs = await getAccounts();
      syncAccountsToUserMeta(allAccs).catch(() => {});
      return data as Account;
    }
  } catch (err) {
    console.warn("createAccount table insert fallback:", err);
  }

  // 2. Fallback to User Metadata & LocalStorage
  const existing = await getAccounts();
  const updatedExisting = type === "MAIN"
    ? existing.map((a) => (a.type === "MAIN" ? { ...a, type: "SECONDARY" as const, updated_at: now } : a))
    : existing;

  const newAccount: Account = {
    id: generateUUID(),
    user_id: user.id,
    name,
    type,
    icon,
    color,
    is_active: values.is_active ?? true,
    created_at: now,
    updated_at: now,
  };

  const finalAccounts = [...updatedExisting, newAccount];
  try {
    localStorage.setItem(`budgetly_accounts_${user.id}`, JSON.stringify(finalAccounts));
  } catch {}
  await syncAccountsToUserMeta(finalAccounts);

  return newAccount;
}

/**
 * Update an existing account.
 * If type is updated to MAIN, demotes any other MAIN accounts to SECONDARY.
 */
export async function updateAccount(
  id: string,
  values: AccountUpdate
): Promise<Account> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const now = new Date().toISOString();

  // If changing type to MAIN, demote others
  if (values.type === "MAIN") {
    try {
      await supabase
        .from("accounts")
        .update({ type: "SECONDARY", updated_at: now })
        .eq("user_id", user.id)
        .eq("type", "MAIN")
        .neq("id", id);
    } catch {}
  }

  // 1. Attempt Supabase Table Update
  try {
    const { data, error } = await supabase
      .from("accounts")
      .update({
        ...values,
        updated_at: now,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (!error && data) {
      const allAccs = await getAccounts();
      syncAccountsToUserMeta(allAccs).catch(() => {});
      return data as Account;
    }
  } catch (err) {
    console.warn("updateAccount table update fallback:", err);
  }

  // 2. Fallback to User Metadata & LocalStorage
  const existing = await getAccounts();
  const updatedList = existing.map((acc) => {
    if (acc.id === id) {
      return {
        ...acc,
        ...values,
        name: values.name ? values.name.trim() : acc.name,
        updated_at: now,
      };
    }
    if (values.type === "MAIN" && acc.type === "MAIN") {
      return {
        ...acc,
        type: "SECONDARY" as const,
        updated_at: now,
      };
    }
    return acc;
  });

  const updatedTarget = updatedList.find((a) => a.id === id);
  if (!updatedTarget) throw new Error("Account not found");

  try {
    localStorage.setItem(`budgetly_accounts_${user.id}`, JSON.stringify(updatedList));
  } catch {}
  await syncAccountsToUserMeta(updatedList);

  return updatedTarget;
}

/**
 * Delete an account.
 * Prevents deleting the only account or last remaining MAIN account without another MAIN.
 */
export async function deleteAccount(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const accounts = await getAccounts();
  const target = accounts.find((a) => a.id === id);
  if (!target) return;

  if (accounts.length <= 1) {
    throw new Error("You must have at least one account.");
  }

  if (target.type === "MAIN") {
    // If deleting MAIN, promote another account to MAIN first
    const other = accounts.find((a) => a.id !== id);
    if (other) {
      await updateAccount(other.id, { type: "MAIN" });
    }
  }

  // 1. Attempt Supabase Table Delete
  try {
    await supabase.from("accounts").delete().eq("id", id).eq("user_id", user.id);
  } catch (err) {
    console.warn("deleteAccount table delete error:", err);
  }

  // 2. User Metadata & LocalStorage sync
  const remaining = accounts.filter((a) => a.id !== id);
  try {
    localStorage.setItem(`budgetly_accounts_${user.id}`, JSON.stringify(remaining));
  } catch {}
  await syncAccountsToUserMeta(remaining);
}

/**
 * Helper to sort accounts with MAIN accounts first.
 */
function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    if (a.type === "MAIN" && b.type !== "MAIN") return -1;
    if (a.type !== "MAIN" && b.type === "MAIN") return 1;
    return a.name.localeCompare(b.name);
  });
}
