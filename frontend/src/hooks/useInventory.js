import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getInventory,
  getInventoryItem,
  updateInventory,
} from "../services/inventoryService";

const QUERY_KEY = ["inventory"];

export function useInventory() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: getInventory,
  });
}

export function useInventoryItem(id) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => getInventoryItem(id),
    enabled: !!id,
  });
}

export function useUpdateInventory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }) =>
      updateInventory(id, updates),

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: QUERY_KEY,
      });
    },
  });
}