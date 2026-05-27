export function LoadingState({ message = "Загружаем Steply" }: { message?: string }) {
  return <p className="loading-state">{message}</p>;
}
