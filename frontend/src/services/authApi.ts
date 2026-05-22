import { request } from "./apiClient";
import type { AuthResponse, User } from "../types/auth";

export const authApi = {
  register: (payload: { email: string; full_name: string; password: string }) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  me: () => request<User>("/auth/me")
};
