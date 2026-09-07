export type TransactionType = "expense" | "income";
export type RecurringInterval = "daily" | "weekly" | "monthly" | "yearly";

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  date: string;          // ISO date string "YYYY-MM-DD"
  time: string | null;
  description: string;
  category_id: string | null;
  received_from: string | null;
  note: string | null;
  is_recurring: boolean;
  recurring_interval: RecurringInterval | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined
  categories?: Category | null;
}

export interface TransactionInsert {
  type: TransactionType;
  amount: number;
  date: string;
  time?: string | null;
  description: string;
  category_id?: string | null;
  received_from?: string | null;
  note?: string | null;
  is_recurring?: boolean;
  recurring_interval?: RecurringInterval | null;
}

export type TransactionUpdate = Partial<TransactionInsert>;

export interface DashboardSummary {
  totalExpense: number;
  totalIncome: number;
  balance: number;
}

export interface MonthlyBudget {
  id: string;
  user_id: string;
  year: number;
  month: number;
  budget_amount: number;
  created_at: string;
  updated_at: string;
}
