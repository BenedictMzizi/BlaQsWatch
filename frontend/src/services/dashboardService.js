import { supabase } from "../lib/supabase";

export async function getDashboardSummary() {
  const { data, error } = await supabase
    .from("dashboard_summary")
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function getLowStockParts() {
  const { data, error } = await supabase
    .from("parts")
    .select(`
      *,
      categories(name)
    `)
    .lte("quantity", 5)
    .order("quantity", { ascending: true });

  if (error) throw error;

  return data;
}

export async function getRecentStockMovements(limit = 10) {
  const { data, error } = await supabase
    .from("stock_movements")
    .select(`
      *,
      parts(part_number)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data;
}