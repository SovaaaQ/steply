import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAppData } from "../app/providers";
import { useAuth } from "../hooks/useAuth";
import { useHabits } from "../hooks/useHabits";
import { useRecommendations } from "../hooks/useRecommendations";
import { useStatistics } from "../hooks/useStatistics";
import { percent } from "../utils/formatDate";
import { petStateShortLabels, petTypeLabels } from "../utils/gamification";

export function ProfilePage() {
  const { user, logout } = useAuth();
  const { activeHabits } = useHabits();
  const { recommendations } = useRecommendations();
  const { gamification, setActiveSection } = useAppData();
  const { summary } = useStatistics();
  const petType = gamification.pet.pet_type;
  const petCaption = petType
    ? `${petTypeLabels[petType]} · ${petStateShortLabels[gamification.pet.pet_state]}`
    : "Питомец еще не выбран";

  return (
    <section className="profile-page page-stack">
      <div className="page-intro">
        <div>
          <span className="page-kicker sketch-circle profile-kicker-sketch">Профиль</span>
          <h2>{user?.full_name ?? "Пользователь Steply"}</h2>
          <p>
            Данные профиля, основные настройки и краткая статистика
          </p>
        </div>
        <Button variant="ghost" type="button" onClick={logout}>
          Выйти
        </Button>
      </div>

      <div className="profile-grid">
        <Card className="profile-panel">
          <span className="page-kicker">Аккаунт</span>
          <h3>Данные пользователя</h3>
          <dl className="profile-list">
            <div>
              <dt>Имя</dt>
              <dd>{user?.full_name ?? "Нет данных"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email ?? "Нет данных"}</dd>
            </div>
            <div>
              <dt>Дата регистрации</dt>
              <dd>{user?.created_at ? new Date(user.created_at).toLocaleDateString("ru-RU") : "Нет данных"}</dd>
            </div>
          </dl>
        </Card>

        <Card className="profile-panel" tone="accent">
          <span className="page-kicker">Краткая статистика</span>
          <h3>Аккаунт и привычки</h3>
          <dl className="profile-list">
            <div>
              <dt>Активные привычки</dt>
              <dd>{activeHabits.length}</dd>
            </div>
            <div>
              <dt>Процент выполнения</dt>
              <dd>{percent(summary.completion_rate)}</dd>
            </div>
            <div>
              <dt>Советы</dt>
              <dd>{recommendations.length}</dd>
            </div>
          </dl>
        </Card>

        <Card className="profile-panel profile-pet-link" tone="soft">
          <span className="page-kicker">Питомец</span>
          <h3>Мой питомец: {gamification.pet.pet_name || "не выбран"}</h3>
          <p>{petCaption}</p>
          <Button type="button" variant="secondary" onClick={() => setActiveSection("pet")}>
            Мой питомец →
          </Button>
        </Card>

        <Card className="profile-panel">
          <span className="page-kicker">Настройки</span>
          <h3>Сессия и приложение</h3>
          <div className="settings-list">
            <span>Аккаунт активен</span>
            <span>Рекомендации обновляются по истории привычек</span>
            <span>Режим восстановления включается автоматически</span>
          </div>
          <Button type="button" variant="ghost" onClick={logout}>
            Выйти из аккаунта
          </Button>
        </Card>
      </div>
    </section>
  );
}
