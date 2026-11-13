import { supabase } from "../lib/supabase";

export async function getSuppliers() {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("company_name");

  if (error) throw error;

  return data;
}