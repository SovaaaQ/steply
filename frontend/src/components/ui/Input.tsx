import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const inputClassName = className ? `field-control ${className}` : "field-control";

  return <input {...props} className={inputClassName} />;
}

export function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const label = isPasswordVisible ? "Скрыть пароль" : "Показать пароль";
  const inputClassName = className
    ? `field-control password-field-input ${className}`
    : "field-control password-field-input";

  return (
    <span className="password-field">
      <input
        {...props}
        className={inputClassName}
        disabled={disabled}
        type={isPasswordVisible ? "text" : "password"}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={label}
        aria-pressed={isPasswordVisible}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsPasswordVisible((value) => !value)}
      >
        {isPasswordVisible ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 3l18 18" />
            <path d="M10.7 5.1A9.4 9.4 0 0 1 12 5c5.2 0 8.5 4.7 9.4 6.1a1.7 1.7 0 0 1 0 1.8 15.9 15.9 0 0 1-2.5 3" />
            <path d="M6.1 6.5a15.7 15.7 0 0 0-3.5 4.6 1.7 1.7 0 0 0 0 1.8C3.5 14.3 6.8 19 12 19a9 9 0 0 0 4.3-1.1" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
            <path d="M14.1 9.9a3 3 0 0 0-4.2 4.2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.6 11.1C3.5 9.7 6.8 5 12 5s8.5 4.7 9.4 6.1a1.7 1.7 0 0 1 0 1.8C20.5 14.3 17.2 19 12 19s-8.5-4.7-9.4-6.1a1.7 1.7 0 0 1 0-1.8Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="field-control" {...props} />;
}
