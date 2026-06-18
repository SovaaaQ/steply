export function ErrorState({
  message,
  onDismiss
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="system-message system-error" role="alert">
      <span>{message}</span>
      {onDismiss && (
        <button className="system-message-close" type="button" onClick={onDismiss}>
          Закрыть
        </button>
      )}
    </div>
  );
}
