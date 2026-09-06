import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types/database";

const DEFAULT_CATEGORIES = [
  { name: "Food", icon: "🍔", color: "#ef4444" },
  { name: "Transport", icon: "🚗", color: "#3b82f6" },
  { name: "Shopping", icon: "🛍️", color: "#a855f7" },
  { name: "Bills", icon: "🏠", color: "#f97316" },
  { name: "Health", icon: "💊", color: "#10b981" },
  { name: "Entertainment", icon: "🎬", color: "#ec4899" },
  { name: "Education", icon: "📚", color: "#06b6d4" },
  { name: "Other", icon: "📦", color: "#6b7280" },
];

export async function getCategories(): Promise<Category[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name");

  if (error) {
    console.error("getCategories error:", error);
    throw error;
  }

  // Auto-seed default categories if empty for this user
  if (!data || data.length === 0) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const inserts = DEFAULT_CATEGORIES.map((c) => ({
          ...c,
          user_id: user.id,
          is_default: true,
        }));
        const { data: seeded, error: seedErr } = await supabase
          .from("categories")
          .insert(inserts)
          .select();
        if (!seedErr && seeded && seeded.length > 0) {
          return seeded;
        }
      }
    } catch (e) {
      console.warn("Auto-seed categories caught:", e);
    }
  }

  return data ?? [];
}

export async function createCategory(
  values: Pick<Category, "name" | "icon" | "color">
): Promise<Category> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("categories")
    .insert({ ...values, user_id: user.id, is_default: false })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCategory(
  id: string,
  values: Partial<Pick<Category, "name" | "icon" | "color">>
): Promise<Category> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .update(values)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}
