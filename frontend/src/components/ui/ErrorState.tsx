export function ErrorState({ message }: { message: string }) {
  return <p className="system-message system-error">{message}</p>;
}
