import { FormEvent, useState } from "react";

import type { AuthResponse } from "../types/auth";
import { authApi } from "../services/authApi";
import { AuthHintCard } from "../components/auth/AuthHintCard";
import { AuthQrCard } from "../components/auth/AuthQrCard";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { ErrorState } from "../components/ui/ErrorState";

export function LoginPage({
  onAuth,
  onSwitchMode
}: {
  onAuth: (response: AuthResponse) => void;
  onSwitchMode: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      onAuth(await authApi.login({ email, password }));
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Ошибка авторизации");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <div className="auth-orbit">S</div>
        <h1>Steply</h1>
        <p>
          Технологичный помощник для привычек: аналитика активности, риск пропуска,
          персональные советы и питомец для мягкой мотивации.
        </p>
        <div className="auth-points">
          <span>Привычки</span>
          <span>Аналитика</span>
          <span>Советы</span>
          <span>Питомец</span>
        </div>
        <AuthHintCard />
      </section>

      <div className="auth-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="mode-switch">
            <button type="button" className="active">
              Вход
            </button>
            <button type="button" onClick={onSwitchMode}>
              Регистрация
            </button>
          </div>

          <label>
            Email
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@example.com"
              required
            />
          </label>

          <label>
            Пароль
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              placeholder="Минимум 6 символов"
              required
            />
          </label>

          {error && <ErrorState message={error} />}

          <Button variant="cta" disabled={isLoading}>{isLoading ? "Проверяем данные" : "Войти"}</Button>
        </form>
        <AuthQrCard />
      </div>
    </main>
  );
}
