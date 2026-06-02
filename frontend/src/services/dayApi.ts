import { request } from "./apiClient";
import type { DaySyncResponse } from "../types/dashboard";

export const dayApi = {
  sync: () =>
    request<DaySyncResponse>("/day/sync", {
      method: "POST"
    })
};
