import { useQuery } from "@tanstack/react-query";
import { getCategories } from "../services/categoryService";

export default function useCategories() {
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  return {
    categories: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
  };
}