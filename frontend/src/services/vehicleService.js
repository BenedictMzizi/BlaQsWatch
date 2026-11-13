import { supabase } from "../lib/supabase";

export async function getVehicles() {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("make");

  if (error) throw error;

  return data;
}