import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getParts,
  getPart,
  createPart,
  updatePart,
  deletePart,
} from "../services/partService";

const QUERY_KEY = ["parts"];


export function useParts() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: getParts,
  });
}

export function usePart(id) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => getPart(id),
    enabled: !!id,
  });
}

/* ------------------------- */
/* Mutations                 */
/* ------------------------- */

export function useCreatePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPart,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEY,
      });
    },
  });
}

export function useUpdatePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }) =>
      updatePart(id, updates),

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEY,
      });

      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEY, variables.id],
      });
    },
  });
}

export function useDeletePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePart,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEY,
      });
    },
  });
}