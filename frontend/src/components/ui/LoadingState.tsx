export function LoadingState({ message = "Загружаем данные Steply" }: { message?: string }) {
  return <p className="loading-state">{message}</p>;
}
