const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";
const TOKEN_STORAGE_KEY = "steply_token";

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
  return "Ошибка запроса к серверу";
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
  headers.set("Content-Type", "application/json");
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
