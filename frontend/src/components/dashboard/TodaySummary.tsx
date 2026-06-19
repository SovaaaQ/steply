import { percent } from "../../utils/formatDate";

interface TodaySummaryProps {
  userName?: string;
  completedToday: number;
  totalToday: number;
  progress: number;
}

export function TodaySummary({
  userName,
  completedToday,
  totalToday,
  progress
}: TodaySummaryProps) {
  const firstName = userName?.split(" ")[0] || "Пользователь";

  return (
    <section className="today-summary">
      <span className="stamp-label">Маршрут дня</span>
      <h2>
        {firstName}, сегодня фокус на <span className="hand-underline">привычках</span>
      </h2>
      <p>
        Отметьте ближайший шаг или сделайте минимальную версию, если день идёт тяжело
      </p>
      <div className="summary-metrics">
        <div>
          <span>Сегодня</span>
          <strong>{completedToday}/{totalToday}</strong>
        </div>
        <div>
          <span>Прогресс дня</span>
          <strong>{percent(progress)}</strong>
        </div>
      </div>
    </section>
  );
}
