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
  if (isLoopbackHostname(apiUrl.hostname)) {
    apiUrl.port = getApiPort();
  }
  apiUrl.pathname = "/api";
  apiUrl.search = "";
  apiUrl.hash = "";

  return trimTrailingSlash(apiUrl.toString());
}

const API_URL = getConfiguredApiUrl() ?? getBrowserApiUrl();

const validationFieldLabels: Record<string, string> = {
  description: "Описание",
  email: "Email",
  full_name: "Имя в Steply",
  password: "Пароль",
  pet_name: "Имя питомца",
  recovery_minutes: "Время восстановления",
  recovery_task: "Короткий шаг",
  schedule_days: "Дни недели",
  target_per_week: "Дней в неделю",
  title: "Название"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatCharacterCount(value: number) {
  if (value % 10 === 1 && value % 100 !== 11) {
    return `${value} символ`;
  }
  if ([2, 3, 4].includes(value % 10) && ![12, 13, 14].includes(value % 100)) {
    return `${value} символа`;
  }
  return `${value} символов`;
}

function getValidationField(issue: Record<string, unknown>) {
  const loc = issue.loc;
  if (!Array.isArray(loc)) {
    return "Поле";
  }

  const field = [...loc].reverse().find((item) => item !== "body");
  return typeof field === "string" ? validationFieldLabels[field] ?? field : "Поле";
}

function getValidationNumber(issue: Record<string, unknown>, key: string) {
  const ctx = issue.ctx;
  if (!isRecord(ctx)) {
    return null;
  }

  return typeof ctx[key] === "number" ? ctx[key] : null;
}

function normalizeValidationIssue(issue: unknown): string | null {
  if (!isRecord(issue)) {
    return null;
  }

  const field = getValidationField(issue);
  if (field === "Email") {
    return "Введите корректный email";
  }

  if (issue.type === "string_too_short") {
    const minLength = getValidationNumber(issue, "min_length");
    return minLength ? `${field}: минимум ${formatCharacterCount(minLength)}` : `${field}: слишком коротко`;
  }

  if (issue.type === "string_too_long") {
    const maxLength = getValidationNumber(issue, "max_length");
    return maxLength ? `${field}: максимум ${formatCharacterCount(maxLength)}` : `${field}: слишком длинно`;
  }

  if (issue.type === "greater_than_equal") {
    const minValue = getValidationNumber(issue, "ge");
    return minValue !== null ? `${field}: минимум ${minValue}` : `${field}: значение слишком маленькое`;
  }

  if (issue.type === "less_than_equal") {
    const maxValue = getValidationNumber(issue, "le");
    return maxValue !== null ? `${field}: максимум ${maxValue}` : `${field}: значение слишком большое`;
  }

  return typeof issue.msg === "string" && issue.msg.length > 0 ? `${field}: ${issue.msg}` : null;
}

function normalizeApiError(detail: unknown): string {
  if (detail === "User with this email already exists") {
    return "Пользователь с таким email уже зарегистрирован";
  }
  if (detail === "Incorrect email or password") {
    return "Неверный email или пароль";
  }
  if (detail === "Too many authentication attempts. Try again later") {
    return "Слишком много попыток входа. Попробуйте позже";
  }
  if (detail === "Habit not found") {
    return "Привычка не найдена";
  }
  if (detail === "Invalid authentication token" || detail === "User not found") {
    return "Сессия истекла. Войдите в Steply снова";
  }
  if (Array.isArray(detail)) {
    return normalizeValidationIssue(detail[0]) ?? "Проверьте заполнение полей";
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

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });
  } catch {
    throw new Error("Не удалось подключиться к серверу. Проверьте, что backend запущен");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(normalizeApiError(body?.detail));
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}
