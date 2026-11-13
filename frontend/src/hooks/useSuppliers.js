import { useQuery } from "@tanstack/react-query";
import { getSuppliers } from "../services/supplierService";

export default function useSuppliers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["suppliers"],
    queryFn: getSuppliers,
  });

  return {
    suppliers: data ?? [],
    loading: isLoading,
    error,
  };
}