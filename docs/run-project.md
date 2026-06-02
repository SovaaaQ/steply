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
- `BACKEND_PORT` для API, default `8000`; при смене обновите `VITE_API_PORT`;
- `FRONTEND_PORT` для UI, default `5173`; QR URL пересоберется после `make restart`.

## Адреса

| Сервис | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:8000` |
| Healthcheck | `http://localhost:8000/api/health` |
| Swagger | `http://localhost:8000/docs` |

При нестандартных `BACKEND_PORT`/`FRONTEND_PORT` адреса меняются вместе с портами.

## Открыть на телефоне через QR

Рекомендуемый dev/demo сценарий:

```bash
make start
```

Сценарий пробует определить private LAN IPv4 адрес компьютера до Docker build и печатает строку вида:

```text
phone frontend: http://192.168.1.50:5173
```

Desktop оставьте на `http://localhost:5173`. На экране входа QR кодирует `phone frontend` URL, а рядом с ним отображается та же ссылка и кнопка `Скопировать`. На телефоне должны открываться оба адреса:

| Что проверить | URL |
|---|---|
| Mobile frontend | `http://<LAN-IP>:5173` |
| Backend health с телефона | `http://<LAN-IP>:8000/api/health` |

API URL не привязан к `localhost`: если frontend открыт как `http://<LAN-IP>:5173`, browser client по умолчанию вызывает `http://<LAN-IP>:8000/api`. Старый loopback override `VITE_API_URL=http://localhost:8000/api` игнорируется на LAN странице, но продолжает работать на desktop localhost. Backend принимает localhost origins и HTTP origins из private IPv4 LAN через `BACKEND_CORS_ORIGIN_REGEX`.

### Настроить LAN адрес вручную

Если auto-detect не нашел нужный Wi-Fi interface, узнайте адрес компьютера:

```bash
# macOS, обычно Wi-Fi en0
ipconfig getifaddr en0

# Linux
ip route get 1.1.1.1
hostname -I
```

Для `make start` добавьте только host в root `.env`, затем пересоберите frontend:

```env
STEPLY_LAN_HOST=192.168.1.50
```

```bash
make restart
```

Для ручного `docker compose up --build` startup auto-detect не выполняется, поэтому задайте полный QR URL:

```env
VITE_PUBLIC_APP_URL=http://192.168.1.50:5173
```

Для локального Vite эти же `STEPLY_LAN_HOST` или `VITE_PUBLIC_APP_URL` задаются в `frontend/.env`; без них dev server пытается найти private LAN IPv4 сам. Если LAN URL все равно отсутствует, desktop QR card не кодирует `localhost` и показывает подсказку рядом с местом QR.

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
uvicorn app.main:app --reload --host 0.0.0.0
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

Vite откроет frontend на `http://localhost:5173` и слушает внешние interfaces. По умолчанию `VITE_API_PORT=8000`, поэтому телефон, открывший LAN frontend, вызывает LAN backend; задавайте `VITE_API_URL` только если API находится на другом hostname или protocol.

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

Frontend при загрузке главного состояния сначала вызывает `POST /api/day/sync`,
а затем read-only `GET /api/dashboard`. Если вы проверяете API вручную после
смены даты, сначала выполните sync, чтобы auto-missed записи и геймификация
были актуальны.

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
| `UVICORN_WORKERS` | Количество backend worker processes в Docker | `1` |
| `FORWARDED_ALLOW_IPS` | Доверенные proxy IP для forwarded headers | `*` |
| `BACKEND_CORS_ORIGINS` | Разрешенные browser origins | localhost frontend |
| `BACKEND_CORS_ORIGIN_REGEX` | Local/private LAN browser origins | localhost + private IPv4 LAN |
| `BACKEND_PORT` | Host port API | `8000` |
| `FRONTEND_PORT` | Host port nginx frontend | `5173` |
| `STEPLY_LAN_HOST` | Host/IP для QR auto URL в `make start` | auto-detect |
| `VITE_PUBLIC_APP_URL` | Полный public frontend URL для QR | value from `make start` or empty |
| `VITE_API_PORT` | API port для URL на page hostname | `8000` |
| `VITE_API_URL` | Опциональный полный API URL override | empty |

В compose hostname БД для backend равен имени сервиса `postgres`. Если изменили `VITE_PUBLIC_APP_URL`, `VITE_API_PORT` или `VITE_API_URL`, пересоберите frontend image: `docker compose up --build -d frontend`.

Non-local окружения валидируются backend на старте. Если `ENVIRONMENT` не равен
`local`, задайте длинный случайный `SECRET_KEY`, `AUTO_INIT_DB=false`, точные
origins в `BACKEND_CORS_ORIGINS` и пустой `BACKEND_CORS_ORIGIN_REGEX`.
Production checklist с TLS, reverse proxy, миграциями и backup находится в
[`docs/hosting.md`](hosting.md).

### Backend `.env`

`backend/.env` используется локальным FastAPI запуском. Для локального PostgreSQL hostname обычно `localhost`:

```env
DATABASE_URL=postgresql+psycopg://steply_user:steply_password@localhost:5432/steply_db
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
BACKEND_CORS_ORIGIN_REGEX=^https?://(?:localhost|127\.0\.0\.1|10(?:\.[0-9]+)+|192\.168(?:\.[0-9]+)+|172\.(?:1[6-9]|2[0-9]|3[01])(?:\.[0-9]+)+)(?::[0-9]+)?$
```

Backend также принимает `postgresql://...` и нормализует DSN к драйверу `postgresql+psycopg://...`.

### Frontend `.env`

```env
VITE_API_PORT=8000
STEPLY_LAN_HOST=
VITE_PUBLIC_APP_URL=
VITE_API_URL=
```

## Разделы для показа

В предзащите показываются только реальные разделы приложения:

1. `Главная`.
2. `Привычки`.
3. `Питомец`.
4. `Советы`.
5. `Профиль`.

Регистрация, вход и onboarding нужны для входа в сценарий, но не подменяют эти разделы.

## Демо-сценарий предзащиты

После старта проверьте в UI или через API:

1. На mobile зарегистрировать нового пользователя и пройти onboarding.
2. Выбрать питомца в разделе `Питомец`.
3. Создать первую привычку с mobile-кнопки `Новая привычка`.
4. Отметить `completed`, `missed` и `recovery_completed`.
5. Проверить XP/level в gamification summary.
6. Открыть `Советы` и убедиться, что после выполнения сегодня показывается follow-up, а не urgent recovery.
7. Пройти навигацию `Главная` -> `Привычки` -> `Советы` -> `Питомец` -> `Профиль`: каждый раздел должен открываться сверху.
8. На desktop сравнить LAN URL из строки `phone frontend` с текстовой ссылкой у QR и открыть его со скана на телефоне.
9. Проверить dashboard на новой пустой базе без server error.

Создание привычки до выбора питомца возвращает `400` намеренно.

## Типичные ошибки

| Ошибка | Причина | Решение |
|---|---|---|
| `connection refused` или healthcheck backend unhealthy | PostgreSQL не запущен или DSN использует неверный host | Локально проверьте `DATABASE_URL`; в compose используйте host `postgres` и дождитесь `postgres` healthy. |
| `port is already allocated` | `8000`, `5173` или `5432` заняты | Остановите конфликтующий процесс или задайте `BACKEND_PORT`, `FRONTEND_PORT`, `POSTGRES_PORT` в `.env`. |
| Alembic сообщает о partial legacy schema | В БД осталась неполная схема до миграций | В dev восстановите backup или создайте чистую БД/volume; не смешивайте manual tables с Alembic. |
| Телефон не открывает LAN frontend | Телефон не в той же Wi-Fi сети или firewall блокирует `5173` | Сравните подсеть LAN IP телефона/компьютера, разрешите входящие соединения и откройте `http://<LAN-IP>:5173` вручную. |
| На телефоне frontend есть, API health не открывается | Firewall или неверный API port блокирует `8000` | Откройте `http://<LAN-IP>:8000/api/health`; при другом `BACKEND_PORT` задайте такой же `VITE_API_PORT` и пересоберите frontend. |
| QR показывает подсказку вместо URL | LAN URL не настроен или auto-detect не нашел private IPv4 | Задайте `STEPLY_LAN_HOST` для `make start` или полный `VITE_PUBLIC_APP_URL`, затем пересоберите frontend. |
| QR ведет на `localhost` после старого build | Frontend image собран до настройки public URL | Проверьте `VITE_PUBLIC_APP_URL`, выполните `make restart` и используйте URL из строки `phone frontend`. |
| Frontend обращается к старому API URL | Не-loopback `VITE_API_URL` встраивается на этапе build | Обновите env или очистите override и пересоберите Vite/Docker frontend. |
| Browser CORS error | Origin не попал в explicit origins или private LAN regex | Для localhost добавьте точный origin в `BACKEND_CORS_ORIGINS`; для другого LAN/domain уточните `BACKEND_CORS_ORIGIN_REGEX` и перезапустите backend. |
| `Сначала выберите питомца` при POST habit | Бизнес-правило onboarding | Сохраните питомца и повторите создание привычки. |
