# Steply

Steply — веб-приложение для поддержки формирования поведенческих привычек на основе анализа активности пользователя. Приложение помогает двигаться к устойчивым привычкам маленькими шагами: пользователь создает привычки, отмечает выполнение, видит прогресс, получает прогноз риска пропуска и персональные рекомендации.

Проект подготовлен как демонстрационное приложение для ВКР: в нем есть регистрация, авторизация, трекер привычек, статистика, рекомендации, игровые механики, desktop-версия и mobile-версия интерфейса.

## Быстрый локальный запуск

Полная инструкция — [docs/run-project.md](docs/run-project.md).

Из корня проекта одной командой (требует Docker Desktop / Docker Engine с Compose plugin):

```bash
make start
```

`make start` сам создаст `.env` из `.env.example`, если файла еще нет, соберет и поднимет Docker Compose, дождется healthchecks и применит Alembic migrations. Прямой эквивалент без `make`:

```bash
./scripts/start.sh
```

Откройте frontend в браузере:

| Сервис      | URL                              |
|-------------|----------------------------------|
| Frontend    | http://localhost:5173            |
| Backend     | http://localhost:8000            |
| Healthcheck | http://localhost:8000/api/health |
| Swagger     | http://localhost:8000/docs       |

Остановка:

```bash
make stop
```

Если Docker сообщает, что порт занят, остановите конфликтующий процесс или измените `POSTGRES_PORT`, `BACKEND_PORT` и/или `FRONTEND_PORT` в `.env`, затем выполните `make restart`. При смене backend-порта обновите `VITE_API_URL`; при смене frontend-порта добавьте новый origin в `BACKEND_CORS_ORIGINS`.

---

## Стек технологий

- Frontend: React 18, TypeScript, Vite, CSS variables.
- Backend: Python, FastAPI, SQLAlchemy 2.x, Pydantic.
- База данных: PostgreSQL.
- Авторизация: JWT Bearer token.
- API: REST.
- Локальная инфраструктура: Docker Compose для PostgreSQL, backend и frontend.

## Структура проекта

```text
backend/
  app/
    api/routes/          REST API: auth, habits, analytics, recommendations
    core/                настройки приложения и JWT
    db/                  SQLAlchemy session и создание таблиц
    models/              SQLAlchemy модели
    schemas/             Pydantic схемы
    services/            аналитика, прогноз риска, рекомендации
  .env.example           пример backend-переменных окружения
  requirements.txt       зависимости backend

frontend/
  src/
    app/                 App, router, provider приложения
    pages/               экраны Steply
    components/
      layout/            Sidebar, Header, MobileNav, AppLayout
      ui/                Button, Card, Input, Badge, states
      habits/            карточки, список и форма привычек
      dashboard/         блоки главного экрана
      recommendations/   карточки рекомендаций и риск
      gamification/      питомец и игровой прогресс
    services/            API-клиенты по доменам
    hooks/               hooks для auth, habits, analytics, recommendations
    types/               TypeScript-типы
    utils/               форматирование, риск, helpers
    styles/              theme.css и globals.css
  .env.example           пример frontend-переменных окружения

docs/
  screenshots/           скриншоты desktop/mobile версии
  practice-report-materials.md
Makefile                 команды запуска, остановки, логов и cleanup
scripts/start.sh         запуск compose, ожидание healthchecks и миграции
docker-compose.yml       локальный запуск PostgreSQL, backend и frontend
```

## Настройка переменных окружения

Корневой `.env` для Docker Compose:

```bash
cp .env.example .env
```

Основные переменные:

```env
POSTGRES_USER=steply_user
POSTGRES_PASSWORD=steply_password
POSTGRES_DB=steply_db
POSTGRES_PORT=5432
DATABASE_URL=postgresql://steply_user:steply_password@postgres:5432/steply_db

APP_NAME=Steply
ENVIRONMENT=local
AUTO_INIT_DB=true
SECRET_KEY=change-this-secret-key-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=10080
BACKEND_PORT=8000
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

FRONTEND_PORT=5173
VITE_API_URL=http://localhost:8000/api
```

В Docker `DATABASE_URL` должен использовать hostname `postgres`, потому что backend подключается к базе по имени сервиса docker-compose. Для ручного запуска backend без Docker используется отдельный `backend/.env` с `localhost`.

Backend без Docker:

```bash
cp backend/.env.example backend/.env
```

Основные переменные:

```env
APP_NAME=Steply
ENVIRONMENT=local
AUTO_INIT_DB=true
SECRET_KEY=change-this-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=10080

POSTGRES_USER=steply_user
POSTGRES_PASSWORD=steply_password
POSTGRES_DB=steply_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
DATABASE_URL=postgresql+psycopg://steply_user:steply_password@localhost:5432/steply_db

BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Frontend:

```bash
cp frontend/.env.example frontend/.env
```

```env
VITE_API_URL=http://localhost:8000/api
```

Backend также принимает формат `postgresql://...`: приложение автоматически нормализует его к драйверу `postgresql+psycopg://...`, который используется SQLAlchemy с установленным пакетом `psycopg`.

## Запуск через Docker Compose

Рекомендуемый сценарий для показа поднимает frontend, backend и PostgreSQL одной командой. Подробная инструкция — [docs/run-project.md](docs/run-project.md).

```bash
make start
```

Остановка без удаления данных:

```bash
make stop
```

Логи:

```bash
make logs
```

`make clean` остановит compose и удалит контейнеры без volume. Для сброса dev-данных PostgreSQL используйте отдельную подтверждаемую команду `make clean-volumes`.

## Подключение к локальному PostgreSQL без Docker

Это опциональный ручной сценарий. Для обычного локального запуска PostgreSQL отдельно настраивать не нужно: контейнер, пользователь, пароль и база создаются через Docker Compose. Если всё же используется установленный PostgreSQL, создайте пользователя и базу вручную:

```bash
createuser steply_user
createdb steply_db -O steply_user
psql -d steply_db -c "ALTER USER steply_user WITH PASSWORD 'steply_password';"
```

Затем проверьте `backend/.env`:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
DATABASE_URL=postgresql+psycopg://steply_user:steply_password@localhost:5432/steply_db
```

## Миграции базы данных

Схема управляется Alembic. Initial migration лежит в `backend/alembic/versions/`, а при `AUTO_INIT_DB=true` backend применяет `alembic upgrade head` и сидит справочники геймификации на startup. Ручной шаг для локального backend:

```bash
cd backend
alembic upgrade head
```

Структура таблиц описана в [docs/database-structure.md](docs/database-structure.md), запуск и migration workflow — в [docs/run-project.md](docs/run-project.md).

## Запуск backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend:

```text
http://localhost:8000
```

Swagger UI:

```text
http://localhost:8000/docs
```

Проверка:

```bash
curl http://localhost:8000/api/health
```

## Запуск frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Сборка:

```bash
cd frontend
npm run build
```

## Экраны приложения

- Вход и регистрация.
- Главная: прогресс дня, ближайшие привычки, уровень, серия и рекомендация дня.
- Привычки: список, создание, редактирование, удаление и отметка выполнения/пропуска.
- Питомец: первичный выбор спутника и его состояние.
- Советы: персонализированные подсказки по риску и регулярности.
- Профиль: сводка аккаунта, прогресса и режима восстановления.

## Дизайн-концепция Steply

Редизайн Steply уходит от стерильного минимализма к более глубокому wellness/productivity-образу: интерфейс остается спокойным и читаемым, но получает эмоциональную палитру, контрастный Plum Noir, технологичный Transformative Teal и точечные дофаминовые акценты. Такой подход делает главный экран выразительным рабочим центром, а не набором одинаковых светлых карточек.

Цветовая система построена вокруг правила 60/30/10:

- 60%: `Cloud Dancer` (`#f4f0e8`) и теплые светлые фоны для страниц и больших спокойных зон.
- 30%: поверхности карточек, muted teal-блоки, Icy Blue-инсайты и Plum Noir в сайдбаре.
- 10%: `Wasabi` (`#b7ef16`) для главных CTA, прогресса и достижений; `Persimmon` (`#ff6b3d`) для риска, пропусков и восстановления.

Основные цвета и UX-роли:

- `Cloud Dancer` — общий фон приложения и спокойная база.
- `Plum Noir` — основной текст, заголовки, desktop sidebar и контрастные секции.
- `Transformative Teal` — бренд, активная навигация, прогресс и аналитические акценты.
- `Wasabi` — главные CTA, позитивный прогресс, серия и достижения.
- `Persimmon` — высокий риск, предупреждения, пропуски и режим восстановления.
- `Icy Blue` — рекомендации, подсказки и информационные аналитические блоки.

Цвета централизованы в `frontend/src/styles/theme.css`, а визуальные правила компонентов — в `frontend/src/styles/globals.css`. Компоненты `Button`, `Card`, `Badge`, `ProgressBar`, `EmptyState`, состояния загрузки, ошибки и успеха используют семантические варианты, а не разрозненные hex-коды.

Desktop-адаптация использует Plum Noir sidebar, sticky header, крупный hero-блок Cloud Dancer -> Transformative Teal, сетку метрик и отдельную колонку инсайтов. Mobile-адаптация не является сжатой desktop-версией: используется компактный header, нижняя навигация, одноколоночная структура, крупные CTA и карточки с уменьшенной высотой на ширинах 390-430px.

## Desktop и mobile версия

Desktop-интерфейс использует боковую навигацию, верхнюю панель, сетку метрик, отдельные зоны для привычек, рекомендаций и игровых механик. Основной экран сразу показывает бренд Steply, действие на день, прогресс, уровень, серию, жизни, риск и рекомендацию.

Mobile-интерфейс использует компактный header, карточки в одну колонку, нижнюю навигацию, крупные кнопки и адаптивные отступы. Проверяемые ширины: `390px`, `430px`, `768px`, `1024px`, `1440px`.

## Скриншоты

Скриншоты сохранены в `docs/screenshots/`.

| Файл | Описание | Подпись для отчета |
| --- | --- | --- |
| `desktop-dashboard.png` | Главный экран desktop | Рисунок 1 — Главный экран Steply в desktop-версии после редизайна. |
| `desktop-habits-list.png` | Страница привычек | Рисунок 2 — Страница управления привычками. |
| `desktop-recommendations.png` | Советы | Рисунок 3 — Персонализированные советы пользователя. |
| `desktop-auth-login.png` | Экран входа | Рисунок 4 — Экран входа в Steply после редизайна. |
| `desktop-auth-register.png` | Экран регистрации | Рисунок 5 — Экран регистрации пользователя в Steply. |
| `mobile-dashboard-390.png` | Mobile-главная | Рисунок 6 — Мобильная версия главного экрана Steply. |
| `mobile-habits-390.png` | Mobile-привычки | Рисунок 7 — Мобильная версия списка привычек. |
| `mobile-recommendations-430.png` | Mobile-советы | Рисунок 8 — Мобильная версия персонализированных советов. |
| `desktop-habit-form.png` | Форма привычки | Рисунок 9 — Форма создания и редактирования привычки. |
| `desktop-profile.png` | Профиль | Рисунок 10 — Профиль пользователя и сводка прогресса. |
| `tablet-dashboard-768.png` | Tablet-главная | Рисунок 11 — Адаптация главного экрана Steply под планшетную ширину. |
| `desktop-dashboard-1024.png` | Desktop 1024px | Рисунок 12 — Главный экран Steply на промежуточной desktop-ширине. |

## Демо-сценарий для защиты

1. На мобильной ширине зарегистрировать нового пользователя и пройти короткий onboarding.
2. В разделе “Питомец” выбрать спутника.
3. В разделе “Привычки” создать первую привычку, например “Читать 20 минут”.
4. На “Главной” показать прогресс дня, ближайший шаг, уровень и серию.
5. Отметить выполнение и показать, что XP и прогресс обновились.
6. Открыть “Советы” и показать follow-up после отметки или риск для следующего выполнения.
7. Открыть “Профиль” и завершить показ нижней навигацией: Главная, Привычки, Питомец, Советы, Профиль.

## Команды проверки

Frontend:

```bash
cd frontend
npm install
npm run build
```

Backend:

```bash
cd backend
source .venv/bin/activate
PYTHONPYCACHEPREFIX=/private/tmp/steply-pycache python3 -m compileall app
uvicorn app.main:app --reload
```

PostgreSQL:

```bash
docker compose up -d postgres
curl http://localhost:8000/api/health
```

## Ограничения текущей версии

- Модель риска эвристическая и объяснимая, без обучения на большом датасете.
- Автоматических e2e-тестов пока нет, ключевые сценарии проверяются сборкой и ручным smoke-тестом.
