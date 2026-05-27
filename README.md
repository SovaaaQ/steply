# Steply

Steply – веб-приложение для поддержки формирования поведенческих привычек на основе анализа активности пользователя. Приложение помогает двигаться к устойчивым привычкам маленькими шагами: пользователь создает привычки, отмечает выполнение, видит прогресс, получает прогноз риска пропуска и персональные рекомендации.

Проект подготовлен как демонстрационное приложение для ВКР: в нем есть регистрация, авторизация, трекер привычек, статистика, рекомендации, игровые механики, desktop-версия и mobile-версия интерфейса.

## Быстрый локальный запуск

Полная инструкция – [docs/run-project.md](docs/run-project.md).

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

Если Docker сообщает, что порт занят, остановите конфликтующий процесс или измените `POSTGRES_PORT`, `BACKEND_PORT` и/или `FRONTEND_PORT` в `.env`, затем выполните `make restart`. При смене backend-порта обновите `VITE_API_PORT`; default CORS regex уже пропускает private LAN frontend origins с новым frontend-портом.

### Телефон через QR

`make start` пытается определить private LAN IPv4 хоста и печатает `phone frontend: http://<LAN-IP>:5173`. Desktop по-прежнему открывается на `http://localhost:5173`; QR на экране входа ведет на напечатанный LAN URL, а frontend на телефоне сам обращается к API на том же hostname и `VITE_API_PORT`.

Если auto-detect выбрал не тот interface или не нашел Wi-Fi IP, задайте в root `.env` `STEPLY_LAN_HOST=<LAN-IP>` и выполните `make restart`. Для прямого `docker compose up --build` задайте полный `VITE_PUBLIC_APP_URL=http://<LAN-IP>:5173`. Проверка с телефона: `http://<LAN-IP>:5173` и `http://<LAN-IP>:8000/api/health`.

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
    api/routes/          REST API: auth, habits, analytics, recommendations, gamification
    core/                настройки приложения и JWT
    db/                  SQLAlchemy session, Alembic startup и seed справочников
    models/              SQLAlchemy модели
    schemas/             Pydantic схемы
    services/            аналитика, расписание привычек, прогноз риска, рекомендации, геймификация
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
  database-structure.md  схема БД, связи и индексы
  project-analysis.md    проектный анализ Steply
  run-project.md         подробный запуск и migration workflow
  practice-report-materials.md
Makefile                 команды запуска, остановки, логов и cleanup
scripts/start.sh         запуск compose, ожидание healthchecks и миграции
docker-compose.yml       локальный запуск PostgreSQL, backend и frontend
```

## Настройка переменных окружения

Все `.env`-файлы исключены из репозитория (`.gitignore`). Готовые шаблоны лежат рядом — скопируйте их и при необходимости отредактируйте значения.

Корневой `.env` для Docker Compose (PostgreSQL + backend + frontend):

```bash
cp .env.example .env
```

Шаблон: [`.env.example`](.env.example) — содержит все доступные переменные с комментариями.

Обязательно задайте уникальный `SECRET_KEY` перед любым развёртыванием.

Backend без Docker (отдельный процесс):

```bash
cp backend/.env.example backend/.env
```

Шаблон: [`backend/.env.example`](backend/.env.example).

В Docker `DATABASE_URL` использует hostname `postgres` (имя сервиса Compose). Для ручного запуска backend без Docker в `backend/.env` используется `localhost`.

Frontend:

```bash
cp frontend/.env.example frontend/.env
```

Шаблон: [`frontend/.env.example`](frontend/.env.example).

Backend также принимает формат `postgresql://...`: приложение автоматически нормализует его к драйверу `postgresql+psycopg://...`, который используется SQLAlchemy с установленным пакетом `psycopg`.

## Запуск через Docker Compose

Рекомендуемый сценарий для показа поднимает frontend, backend и PostgreSQL одной командой. Подробная инструкция – [docs/run-project.md](docs/run-project.md).

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

Это опциональный ручной сценарий. Для обычного локального запуска PostgreSQL отдельно настраивать не нужно: контейнер, пользователь, пароль и база создаются через Docker Compose. Если всё же используется установленный PostgreSQL, создайте пользователя и базу вручную, подставив значения из вашего `backend/.env`:

```bash
createuser <POSTGRES_USER>
createdb <POSTGRES_DB> -O <POSTGRES_USER>
psql -d <POSTGRES_DB> -c "ALTER USER <POSTGRES_USER> WITH PASSWORD '<POSTGRES_PASSWORD>';"
```

Затем проверьте `backend/.env` — убедитесь, что `POSTGRES_HOST=localhost` и `DATABASE_URL` указывают на локальный сервер. Шаблон: [`backend/.env.example`](backend/.env.example).

## Миграции базы данных

Схема управляется Alembic. Initial migration лежит в `backend/alembic/versions/`, а при `AUTO_INIT_DB=true` backend применяет `alembic upgrade head` и сидит справочники геймификации на startup. Ручной шаг для локального backend:

```bash
cd backend
alembic upgrade head
```

Структура таблиц описана в [docs/database-structure.md](docs/database-structure.md), запуск и migration workflow – в [docs/run-project.md](docs/run-project.md).

## Запуск backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0
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

- Главная: прогресс дня, ближайшие привычки, уровень, серия и рекомендация дня.
- Привычки: список, создание, редактирование, удаление и отметка выполнения/пропуска.
- Питомец: первичный выбор спутника и его состояние.
- Советы: персонализированные подсказки по риску и регулярности.
- Профиль: сводка аккаунта, прогресса и режима восстановления.

Регистрация, вход и onboarding открывают эти пять разделов, но не считаются отдельными
разделами приложения в демонстрационном сценарии.

## Дизайн-концепция Steply

Редизайн Steply уходит от стерильного минимализма к более глубокому wellness/productivity-образу: интерфейс остается спокойным и читаемым, но получает эмоциональную палитру, контрастный Plum Noir, технологичный Transformative Teal и точечные дофаминовые акценты. Такой подход делает главный экран выразительным рабочим центром, а не набором одинаковых светлых карточек.

Цветовая система построена вокруг правила 60/30/10:

- 60%: `Cloud Dancer` (`#f4f0e8`) и теплые светлые фоны для страниц и больших спокойных зон.
- 30%: поверхности карточек, muted teal-блоки, Icy Blue-инсайты и Plum Noir в сайдбаре.
- 10%: `Wasabi` (`#b7ef16`) для главных CTA, прогресса и достижений; `Persimmon` (`#ff6b3d`) для риска, пропусков и восстановления.

Основные цвета и UX-роли:

- `Cloud Dancer` – общий фон приложения и спокойная база.
- `Plum Noir` – основной текст, заголовки, desktop sidebar и контрастные секции.
- `Transformative Teal` – бренд, активная навигация, прогресс и аналитические акценты.
- `Wasabi` – главные CTA, позитивный прогресс, серия и достижения.
- `Persimmon` – высокий риск, предупреждения, пропуски и режим восстановления.
- `Icy Blue` – рекомендации, подсказки и информационные аналитические блоки.

Цвета централизованы в `frontend/src/styles/theme.css`, а визуальные правила компонентов – в `frontend/src/styles/globals.css`. Компоненты `Button`, `Card`, `Badge`, `ProgressBar`, `EmptyState`, состояния загрузки, ошибки и успеха используют семантические варианты, а не разрозненные hex-коды.

Desktop-адаптация использует Plum Noir sidebar, sticky header, крупный hero-блок Cloud Dancer -> Transformative Teal, сетку метрик и отдельную колонку инсайтов. Mobile-адаптация не является сжатой desktop-версией: используется компактный header, нижняя навигация, одноколоночная структура, крупные CTA и карточки с уменьшенной высотой на ширинах 390-430px.

## Desktop и mobile версия

Desktop-интерфейс использует боковую навигацию, верхнюю панель, сетку метрик, отдельные зоны для привычек, рекомендаций и игровых механик. Основной экран сразу показывает бренд Steply, действие на день, прогресс, уровень, серию, жизни, риск и рекомендацию.

Mobile-интерфейс использует компактный header, карточки в одну колонку, нижнюю навигацию, крупные кнопки и адаптивные отступы. Проверяемые ширины: `390px`, `430px`, `768px`, `1024px`, `1440px`.

## Скриншоты

Скриншоты не хранятся в репозитории: они являются генерируемыми материалами для
конкретной презентации/защиты. Для обновления визуальных материалов запустите
приложение и сохраните актуальные экраны из браузера после `make start`.

## Демо-сценарий для защиты

1. На мобильной ширине зарегистрировать нового пользователя и пройти короткий onboarding.
2. В разделе “Питомец” выбрать спутника.
3. В разделе “Привычки” создать первую привычку, например “Читать 20 минут”.
4. На “Главной” показать прогресс дня, ближайший шаг, уровень и серию.
5. Отметить выполнение и показать, что XP и прогресс обновились.
6. Открыть “Советы” и показать follow-up после отметки или риск для следующего выполнения.
7. На mobile пройти навигацию `Главная` -> `Привычки` -> `Советы` -> `Питомец` -> `Профиль` и проверить, что каждый раздел начинается сверху.
8. На desktop показать QR на экране входа: ссылка рядом с ним должна совпадать с LAN URL и копироваться кнопкой.

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
uvicorn app.main:app --reload --host 0.0.0.0
```

PostgreSQL:

```bash
docker compose up -d postgres backend
docker compose exec -T postgres psql -U steply_user -d steply_db -c "\dt"
curl http://localhost:8000/api/health
```

## Ограничения текущей версии

- Модель риска эвристическая и объяснимая, без обучения на большом датасете.
- Автоматических e2e-тестов пока нет, ключевые сценарии проверяются сборкой и ручным smoke-тестом.
