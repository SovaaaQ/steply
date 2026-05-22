# Запуск Steply

## Что нужно

- Python 3.11+ для локального backend. Docker image использует Python 3.12.
- Node.js 20+ и `npm` для локального frontend.
- PostgreSQL 16 для локального запуска без Docker.
- Docker Desktop / Docker Engine с Compose plugin для контейнерного сценария.

## Быстрый запуск

Из корня проекта:

```bash
make start
```

Это одна команда для предзащиты. Она создает корневой `.env` из `.env.example`, если его нет, запускает Docker Compose, дожидается healthy-состояния PostgreSQL/backend/frontend и повторно применяет idempotent `alembic upgrade head`.

Если `make` недоступен, вызовите тот же сценарий напрямую:

```bash
./scripts/start.sh
```

После строки `Steply is ready.` откройте frontend:

```text
http://localhost:5173
```

Health endpoint для быстрой проверки:

```text
http://localhost:8000/api/health
```

Команды управления:

| Команда | Действие |
|---|---|
| `make stop` | Остановить compose без удаления данных PostgreSQL |
| `make restart` | Остановить и снова выполнить сценарий запуска |
| `make logs` | Смотреть логи compose |
| `make clean` | Удалить compose-контейнеры без volume |
| `make clean-volumes` | После подтверждения удалить контейнеры и PostgreSQL volume |

### Если порт занят

Если Docker пишет `port is already allocated`, остановите процесс на конфликтующем порту или исправьте root `.env` и выполните `make restart`:

- `POSTGRES_PORT` для PostgreSQL, default `5432`;
- `BACKEND_PORT` для API, default `8000`; при смене обновите `VITE_API_URL`;
- `FRONTEND_PORT` для UI, default `5173`; при смене добавьте новый origin в `BACKEND_CORS_ORIGINS`.

## Адреса

| Сервис | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:8000` |
| Healthcheck | `http://localhost:8000/api/health` |
| Swagger | `http://localhost:8000/docs` |

При нестандартных `BACKEND_PORT`/`FRONTEND_PORT` адреса меняются вместе с портами.

## Локальный запуск без Docker

### 1. Подготовить PostgreSQL

Создайте пользователя и базу в установленном PostgreSQL:

```bash
createuser steply_user
createdb steply_db -O steply_user
psql -d steply_db -c "ALTER USER steply_user WITH PASSWORD 'steply_password';"
```

Если пользователь или база уже существуют, используйте их и задайте корректный `DATABASE_URL`.

### 2. Запустить backend

```bash
cp backend/.env.example backend/.env
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

`AUTO_INIT_DB=true` оставлен по умолчанию: backend также проверит `alembic upgrade head` на startup и засеет справочники достижений и заданий. Manual `alembic upgrade head` выше полезен как явный шаг перед стартом приложения.

Проверка backend:

```bash
curl http://localhost:8000/api/health
```

Ожидаемый ответ содержит `status=ok` и `database=ok`.

### 3. Запустить frontend

Во втором терминале:

```bash
cp frontend/.env.example frontend/.env
cd frontend
npm install
npm run dev
```

Vite откроет frontend на `http://localhost:5173`. Значение `VITE_API_URL` должно указывать на API backend, обычно `http://localhost:8000/api`.

## Запуск через Docker

Рекомендуемый показной сценарий:

```bash
make start
```

Ручной эквивалент:

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

Compose поднимает:

- `postgres` на PostgreSQL 16 с named volume `steply_postgres_data`;
- `backend`, который ждет healthy PostgreSQL и запускает Alembic на startup;
- `frontend`, который собирается Vite и раздается nginx на host port `5173`.

Проверка:

```bash
curl http://localhost:8000/api/health
curl -I http://localhost:5173
```

Остановка без удаления данных:

```bash
make stop
```

Удаление dev-данных PostgreSQL:

```bash
make clean-volumes
```

Команда `make clean-volumes` требует подтверждение и удаляет volume со всеми локальными данными Steply.

## Миграции

Alembic config находится в `backend/alembic.ini`, ревизии в `backend/alembic/versions/`.

Из каталога `backend`:

```bash
alembic current
alembic upgrade head
alembic check
```

Новая ревизия после изменения ORM-моделей:

```bash
alembic revision --autogenerate -m "describe schema change"
alembic upgrade head
```

Проверьте autogenerate migration вручную перед применением. Initial revision проекта: `202605210001`.

Старые dev-базы, созданные `Base.metadata.create_all()` до Alembic, не имеют таблицы `alembic_version`. Если backend видит полный старый набор таблиц, он добавляет известные legacy-колонки и ставит stamp на initial revision без сброса данных. Для production предпочтителен controlled migration path или чистая база, созданная Alembic; неполная legacy-схема останавливает запуск с понятной ошибкой.

## Переменные окружения

### Docker `.env`

Корневой `.env` читается Docker Compose:

| Переменная | Назначение | Default |
|---|---|---|
| `POSTGRES_USER` | Пользователь PostgreSQL | `steply_user` |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL | `steply_password` |
| `POSTGRES_DB` | База PostgreSQL | `steply_db` |
| `POSTGRES_PORT` | Host port PostgreSQL | `5432` |
| `DATABASE_URL` | DSN backend в compose | `postgresql://steply_user:steply_password@postgres:5432/steply_db` |
| `APP_NAME` | Название FastAPI app | `Steply` |
| `ENVIRONMENT` | Имя окружения | `local` |
| `AUTO_INIT_DB` | Startup migration + seed | `true` |
| `SECRET_KEY` | JWT signing key | dev placeholder |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | TTL access token | `10080` |
| `BACKEND_CORS_ORIGINS` | Разрешенные browser origins | localhost frontend |
| `BACKEND_PORT` | Host port API | `8000` |
| `FRONTEND_PORT` | Host port nginx frontend | `5173` |
| `VITE_API_URL` | API URL, встроенный во frontend build | `http://localhost:8000/api` |

В compose hostname БД для backend равен имени сервиса `postgres`. Если изменили `VITE_API_URL`, пересоберите frontend image: `docker compose up --build -d frontend`.

### Backend `.env`

`backend/.env` используется локальным FastAPI запуском. Для локального PostgreSQL hostname обычно `localhost`:

```env
DATABASE_URL=postgresql+psycopg://steply_user:steply_password@localhost:5432/steply_db
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Backend также принимает `postgresql://...` и нормализует DSN к драйверу `postgresql+psycopg://...`.

### Frontend `.env`

```env
VITE_API_URL=http://localhost:8000/api
```

## Smoke-сценарий

После старта проверьте в UI или через API:

1. На mobile зарегистрировать нового пользователя и пройти onboarding.
2. Выбрать питомца в разделе `Питомец`.
3. Создать первую привычку с mobile-кнопки `Новая привычка`.
4. Отметить `completed`, `missed` и `recovery_completed`.
5. Проверить XP/level в gamification summary.
6. Открыть `Советы` и убедиться, что после выполнения сегодня показывается follow-up, а не urgent recovery.
7. Пройти навигацию `Главная` -> `Привычки` -> `Питомец` -> `Советы` -> `Профиль`.
8. Проверить dashboard на новой пустой базе без server error.

Создание привычки до выбора питомца возвращает `400` намеренно.

## Типичные ошибки

| Ошибка | Причина | Решение |
|---|---|---|
| `connection refused` или healthcheck backend unhealthy | PostgreSQL не запущен или DSN использует неверный host | Локально проверьте `DATABASE_URL`; в compose используйте host `postgres` и дождитесь `postgres` healthy. |
| `port is already allocated` | `8000`, `5173` или `5432` заняты | Остановите конфликтующий процесс или задайте `BACKEND_PORT`, `FRONTEND_PORT`, `POSTGRES_PORT` в `.env`. |
| Alembic сообщает о partial legacy schema | В БД осталась неполная схема до миграций | В dev восстановите backup или создайте чистую БД/volume; не смешивайте manual tables с Alembic. |
| Frontend обращается к старому API URL | `VITE_API_URL` встраивается на этапе build | Обновите env и пересоберите Vite/Docker frontend. |
| Browser CORS error | Frontend origin не входит в `BACKEND_CORS_ORIGINS` | Добавьте точный origin, например `http://localhost:5174`, и перезапустите backend. |
| `Сначала выберите питомца` при POST habit | Бизнес-правило onboarding | Сохраните питомца и повторите создание привычки. |
