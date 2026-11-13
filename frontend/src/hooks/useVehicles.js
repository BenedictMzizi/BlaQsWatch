import { useQuery } from "@tanstack/react-query";
import { getVehicles } from "../services/vehicleService";

export default function useVehicles() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vehicles"],
    queryFn: getVehicles,
  });

  return {
    vehicles: data ?? [],
    loading: isLoading,
    error,
  };
}