import { FormEvent, useRef, useState } from "react";

import type { AuthResponse } from "../types/auth";
import { authApi } from "../services/authApi";
import { AuthHintCard } from "../components/auth/AuthHintCard";
import { AuthQrCard } from "../components/auth/AuthQrCard";
import { Button } from "../components/ui/Button";
import { Input, PasswordInput } from "../components/ui/Input";
import { ErrorState } from "../components/ui/ErrorState";
import { authLimits } from "../utils/formLimits";

export function RegisterPage({
  onAuth,
  onSwitchMode
}: {
  onAuth: (response: AuthResponse, options?: { isNewRegistration?: boolean }) => void;
  onSwitchMode: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isLoadingRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setError("");
    setIsLoading(true);
    try {
      onAuth(await authApi.register({ email, full_name: fullName, password }), {
        isNewRegistration: true
      });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Ошибка регистрации");
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <div className="auth-orbit">S</div>
        <h1>Steply</h1>
        <p>
          Создайте аккаунт, чтобы сохранить привычки, видеть свой темп
          и получать подсказки по риску
        </p>
        <div className="auth-points">
          <span>Прогресс дня</span>
          <span>Риск пропуска</span>
          <span>Режим восстановления</span>
        </div>
        <AuthHintCard />
      </section>

      <div className="auth-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="mode-switch">
            <button type="button" disabled={isLoading} onClick={onSwitchMode}>
              Вход
            </button>
            <button type="button" className="active">
              Регистрация
            </button>
          </div>

          <label>
            Имя в Steply
            <Input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              minLength={authLimits.fullNameMinLength}
              maxLength={authLimits.fullNameMaxLength}
              placeholder="Мария"
              required
            />
          </label>

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
            <PasswordInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={authLimits.passwordMinLength}
              maxLength={authLimits.passwordMaxLength}
              placeholder={`Минимум ${authLimits.passwordMinLength} символов`}
              required
            />
          </label>

          {error && <ErrorState message={error} />}

          <Button variant="cta" disabled={isLoading} aria-busy={isLoading || undefined}>
            {isLoading ? "Создаём" : "Создать аккаунт"}
          </Button>
        </form>
        <AuthQrCard />
      </div>
    </main>
  );
}
