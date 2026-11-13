import { supabase } from "../lib/supabase";

export async function getManufacturers() {
  const { data, error } = await supabase
    .from("manufacturers")
    .select("*")
    .order("name");

  if (error) throw error;

  return data;
}