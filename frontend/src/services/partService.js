import { supabase } from "../lib/supabase";

export async function getParts() {
  const { data, error } = await supabase
    .from("parts")
    .select(`
      *,
      categories(name),
      manufacturers(name),
      suppliers(company_name)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export async function getPart(id) {
  const { data, error } = await supabase
    .from("parts")
    .select(`
      *,
      categories(name),
      manufacturers(name),
      suppliers(company_name)
    `)
    .eq("id", id)
    .single();

  if (error) throw error;

  return data;
}

export async function createPart(part) {
  const { data, error } = await supabase
    .from("parts")
    .insert(part)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updatePart(id, updates) {
  const { data, error } = await supabase
    .from("parts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deletePart(id) {
  const { error } = await supabase
    .from("parts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}