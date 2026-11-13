import { supabase } from "../lib/supabase";

export async function getInventory() {
  const { data, error } = await supabase
    .from("inventory")
    .select(`
      *,
      parts(
        id,
        part_number,
        description
      ),
      locations(
        id,
        aisle,
        rack,
        shelf,
        bin
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export async function getInventoryItem(id) {
  const { data, error } = await supabase
    .from("inventory")
    .select(`
      *,
      parts(*),
      locations(*)
    `)
    .eq("id", id)
    .single();

  if (error) throw error;

  return data;
}

export async function updateInventory(id, updates) {
  const { data, error } = await supabase
    .from("inventory")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}