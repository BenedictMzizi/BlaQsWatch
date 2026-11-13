import { useQuery } from "@tanstack/react-query";
import { getManufacturers } from "../services/manufacturerService";

export default function useManufacturers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["manufacturers"],
    queryFn: getManufacturers,
  });

  return {
    manufacturers: data ?? [],
    loading: isLoading,
    error,
  };
}