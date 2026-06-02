import { request } from "./apiClient";
import type { DashboardResponse } from "../types/dashboard";

export const dashboardApi = {
  get: () => request<DashboardResponse>("/dashboard")
};
