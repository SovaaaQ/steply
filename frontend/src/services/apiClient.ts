import { formatLocalDate, formatLocalTime } from "../utils/formatDate";

const DEFAULT_API_PORT = "8000";
const TOKEN_STORAGE_KEY = "steply_token";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isLoopbackHostname(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();

  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "0.0.0.0" ||
    normalizedHostname === "[::1]" ||
    normalizedHostname === "::1"
  );
}

function getConfiguredApiUrl() {
  const apiUrl = import.meta.env.VITE_API_URL?.trim();

  if (!apiUrl) {
    return null;
  }

  if (typeof window !== "undefined" && !isLoopbackHostname(window.location.hostname)) {
    try {
      if (isLoopbackHostname(new URL(apiUrl).hostname)) {
        return null;
      }
    } catch {
      return trimTrailingSlash(apiUrl);
    }
  }

  return trimTrailingSlash(apiUrl);
}

function getApiPort() {
  return import.meta.env.VITE_API_PORT?.trim() || DEFAULT_API_PORT;
}

function getBrowserApiUrl() {
  if (typeof window === "undefined") {
    return `http://localhost:${getApiPort()}/api`;
  }

  const apiUrl = new URL(window.location.origin);
  apiUrl.port = getApiPort();
  apiUrl.pathname = "/api";
  apiUrl.search = "";
  apiUrl.hash = "";

  return trimTrailingSlash(apiUrl.toString());
}

const API_URL = getConfiguredApiUrl() ?? getBrowserApiUrl();

function normalizeApiError(detail: unknown): string {
  if (detail === "User with this email already exists") {
    return "Пользователь с таким email уже зарегистрирован";
  }
  if (detail === "Incorrect email or password") {
    return "Неверный email или пароль";
  }
  if (detail === "Habit not found") {
    return "Привычка не найдена";
  }
  if (detail === "Invalid authentication token" || detail === "User not found") {
    return "Сессия истекла. Войдите в Steply снова";
  }
  if (typeof detail === "string" && detail.length > 0) {
    return detail;
  }
  return "Не получилось связаться с сервером";
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  const requestTime = new Date();
  headers.set("Content-Type", "application/json");
  headers.set("X-Client-Date", formatLocalDate(requestTime));
  headers.set("X-Client-Time", formatLocalTime(requestTime));
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(normalizeApiError(body?.detail));
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}
