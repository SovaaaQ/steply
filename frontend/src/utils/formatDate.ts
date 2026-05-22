export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatPreferredTime(value: string | null | undefined): string {
  if (!value) {
    return "В любое время";
  }
  return value.slice(0, 5);
}
