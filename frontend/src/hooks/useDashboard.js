import { useQuery } from "@tanstack/react-query";

import {
  getDashboardSummary,
  getLowStockParts,
  getRecentStockMovements,
} from "../services/dashboardService";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });
}

export function useLowStockParts() {
  return useQuery({
    queryKey: ["low-stock"],
    queryFn: getLowStockParts,
  });
}

export function useRecentMovements() {
  return useQuery({
    queryKey: ["recent-stock"],
    queryFn: getRecentStockMovements,
  });
}