# Локальный запуск Steply

Frontend, backend и PostgreSQL запускаются **одной командой** через Docker Compose.

```bash
cp .env.example .env
docker compose up --build
```

---

## Содержание

1. [Проверка Docker](#1-проверка-docker)
2. [Первый запуск](#2-первый-запуск)
3. [Обычный запуск и остановка](#3-обычный-запуск-и-остановка)
4. [Переменные окружения](#4-переменные-окружения)
5. [Порты](#5-порты)
6. [Логи](#6-логи)
7. [База данных и таблицы](#7-база-данных-и-таблицы)
8. [Запуск без Docker (вручную)](#8-запуск-без-docker-вручную)
9. [Устранение ошибок](#9-устранение-ошибок)

---

## 1. Проверка Docker

### Убедитесь, что Docker установлен

```bash
docker --version
docker compose version
```

Ожидаемый вывод:
```
Docker version 27.x.x, build ...
Docker Compose version v2.x.x
```

### Убедитесь, что Docker запущен

```bash
docker info
```

Если видите `ERROR: Cannot connect to the Docker daemon` – **запустите Docker Desktop** (значок Docker в трее/строке меню).

Дождитесь, пока статус в Docker Desktop станет **Running**, затем повторите `docker info`.

### Установка Docker Desktop (если не установлен)

1. Перейдите на https://www.docker.com/products/docker-desktop/
2. Скачайте для вашей ОС (Mac / Windows / Linux)
3. Установите и откройте приложение
4. Дождитесь зелёного индикатора "Docker Desktop is running"

---

## 2. Первый запуск

### Шаг 1. Создайте `.env`

```bash
cp .env.example .env
```

Значения по умолчанию подходят для локального запуска – ничего менять не нужно.

> Если хотите свой `SECRET_KEY`, откройте `.env` и замените строку.

### Шаг 2. Запустите проект

```bash
docker compose up --build
```

**Что происходит при первом запуске:**

| Этап | Время |
|------|-------|
| Скачивание образов (postgres, python, node) | 1–3 мин |
| Сборка backend и frontend контейнеров | 1–3 мин |
| Старт PostgreSQL + healthcheck | ~10 с |
| Старт backend + Alembic migration/seed | ~10 с |
| Старт frontend | ~5 с |
| **Итого первый запуск** | **3–7 мин** |

Последующие запуски (без `--build`): **10–20 секунд**.

Когда `docker compose ps` покажет healthy для контейнеров:
```
steply_backend    ... (healthy)
steply_frontend   ... (healthy)
```
– проект готов.

### Шаг 3. Откройте приложение

| Сервис     | URL                              |
|------------|----------------------------------|
| Frontend   | http://localhost:5173             |
| Backend    | http://localhost:8000             |
| Swagger UI | http://localhost:8000/docs        |
| Health     | http://localhost:8000/api/health  |

### Проверка backend

```bash
curl http://localhost:8000/api/health
```

Ожидаемый ответ:
```json
{"status":"ok","service":"Steply","database":"ok"}
```

---

## 3. Обычный запуск и остановка

### Обычный запуск (без пересборки)

```bash
docker compose up
```

### Запуск в фоне

```bash
docker compose up -d
```

### Остановить сервисы (данные сохранятся)

```bash
docker compose down
```

### Полный сброс – остановить и удалить данные PostgreSQL

```bash
docker compose down -v
docker compose up --build
```

> После `down -v` все данные в PostgreSQL удаляются. Таблицы создадутся заново Alembic migration при следующем запуске.

### Пересобрать контейнеры после изменений кода

```bash
docker compose up --build
```

### Пересобрать один сервис

```bash
docker compose up --build backend
docker compose up --build frontend
```

### Пересобрать после изменения зависимостей

```bash
# После изменения requirements.txt (backend)
docker compose up --build backend

# После изменения package.json (frontend)
docker compose up --build frontend
```

### Статус контейнеров

```bash
docker compose ps
```

---

## 4. Переменные окружения

### Корневой `.env` (для docker-compose)

Создаётся из `.env.example`. Используется docker-compose для подстановки переменных `${VAR}`.

```env
# PostgreSQL
POSTGRES_USER=steply_user
POSTGRES_PASSWORD=steply_password
POSTGRES_DB=steply_db
POSTGRES_PORT=5432
DATABASE_URL=postgresql://steply_user:steply_password@postgres:5432/steply_db

# Backend
APP_NAME=Steply
ENVIRONMENT=local
AUTO_INIT_DB=true
SECRET_KEY=change-this-secret-key-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=10080
BACKEND_PORT=8000
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
BACKEND_CORS_ORIGIN_REGEX=^https?://(?:localhost|127\.0\.0\.1|10(?:\.[0-9]+)+|192\.168(?:\.[0-9]+)+|172\.(?:1[6-9]|2[0-9]|3[01])(?:\.[0-9]+)+)(?::[0-9]+)?$

# Frontend
FRONTEND_PORT=5173
STEPLY_LAN_HOST=
VITE_PUBLIC_APP_URL=
VITE_API_PORT=8000
VITE_API_URL=
```

> **Важно про DATABASE_URL:** внутри Docker backend подключается к PostgreSQL по имени сервиса `postgres`, не `localhost`. Если меняете `POSTGRES_USER`, `POSTGRES_PASSWORD` или `POSTGRES_DB`, обновите `DATABASE_URL` в том же `.env`.

### `backend/.env` (только для запуска backend вручную без Docker)

```bash
cp backend/.env.example backend/.env
```

Это отдельный файл. Используется только при ручном запуске `uvicorn`.

### `frontend/.env` (только для запуска frontend вручную без Docker)

```bash
cp frontend/.env.example frontend/.env
```

---

## 5. Порты

| Сервис    | Порт внутри Docker | Порт на хосте |
|-----------|--------------------|---------------|
| postgres  | 5432               | 5432          |
| backend   | 8000               | 8000          |
| frontend  | 80                 | 5173          |

### Если порт занят

Проверьте, кто занимает порт:

```bash
# macOS / Linux
lsof -i :5432
lsof -i :8000
lsof -i :5173
```

Остановите конфликтующий процесс или измените порт в `.env`:

```env
POSTGRES_PORT=5433
BACKEND_PORT=8001
FRONTEND_PORT=5174
```

Если меняете `BACKEND_PORT`, обновите `VITE_API_PORT`. Default `BACKEND_CORS_ORIGIN_REGEX` уже пропускает private LAN frontend origins с другим frontend-портом.

---

## 6. Логи

```bash
# Все сервисы сразу
docker compose logs -f

# Только backend
docker compose logs -f backend

# Только frontend
docker compose logs -f frontend

# Только PostgreSQL
docker compose logs -f postgres
```

Остановить логи: `Ctrl+C`

---

## 7. База данных и таблицы

### Как создаются таблицы

Steply использует **Alembic**. Initial revision хранится в `backend/alembic/versions/`; при `AUTO_INIT_DB=true` backend выполняет `alembic upgrade head` на startup и затем сидит справочники геймификации.

Ручной запуск миграций из каталога `backend`:

```bash
alembic upgrade head
alembic check
```

### Проверить, что таблицы созданы

```bash
docker compose exec postgres psql -U steply_user -d steply_db -c "\dt"
```

Ожидаемый вывод:
```
 Schema |      Name       | Type  |    Owner
--------+-----------------+-------+-------------
 public | achievements               | table | steply_user
 public | alembic_version            | table | steply_user
 public | habit_entries              | table | steply_user
 public | habits                     | table | steply_user
 public | predictions                | table | steply_user
 public | quests                     | table | steply_user
 public | recommendations            | table | steply_user
 public | reward_events              | table | steply_user
 public | users                      | table | steply_user
```

### Подключиться к PostgreSQL через psql

```bash
docker compose exec postgres psql -U steply_user -d steply_db
```

### Подключиться через GUI-клиент (DBeaver, TablePlus, pgAdmin)

```
Host:     localhost
Port:     5432
Database: steply_db
User:     steply_user
Password: steply_password
```

### Сбросить данные

```bash
docker compose down -v
```

Данные удаляются. После следующего `docker compose up` Alembic создаст пустую схему заново.

---

## 8. Запуск без Docker (вручную)

Для разработки с горячим перезапуском. PostgreSQL всё равно удобно держать в Docker.

### Шаг 1. PostgreSQL через Docker

```bash
docker compose up -d postgres
```

### Шаг 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # если .env ещё нет
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0
```

Backend будет доступен на http://localhost:8000

### Шаг 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env            # если .env ещё нет
npm run dev
```

Frontend будет доступен на http://localhost:5173

---

## 9. Устранение ошибок

### Docker Desktop не запущен

**Симптом:** `Cannot connect to the Docker daemon`

**Решение:** Откройте Docker Desktop и дождитесь статуса "Running".

```bash
# Проверка после запуска Docker Desktop
docker info
```

### Ошибка `docker: command not found`

Docker не установлен. Установите Docker Desktop: https://www.docker.com/products/docker-desktop/

### Backend не стартует: `could not connect to server` / `connection refused`

Backend ждёт, пока PostgreSQL пройдёт healthcheck. Подождите 15–20 секунд. Смотрите логи:

```bash
docker compose logs postgres
docker compose logs backend
```

### Frontend долго не появляется в браузере

Frontend запускается после backend. Подождите 30–60 секунд при первом запуске. Смотрите:

```bash
docker compose logs frontend
```

Когда frontend healthcheck станет healthy и `curl -I http://localhost:5173` вернет `200`, можно открывать.

### Порт уже занят

```bash
# Найти процесс на порту 5432
lsof -i :5432

# Завершить процесс (macOS/Linux)
kill -9 <PID>
```

### QR или запросы с телефона уходят не туда

`make start` печатает LAN URL для QR. Если auto-detect выбрал не тот адрес, задайте `STEPLY_LAN_HOST=<LAN-IP>` и выполните `make restart`. По умолчанию frontend использует hostname открытой страницы и `VITE_API_PORT`, поэтому на телефоне API health должен открываться как `http://<LAN-IP>:8000/api/health`; полный `VITE_API_URL` нужен только для отдельного API host.

### Пересобрать всё с нуля

```bash
docker compose down -v
docker compose up --build
```

### Проверить статус healthcheck контейнеров

```bash
docker inspect steply_backend --format '{{json .State.Health.Status}}'
docker inspect steply_postgres --format '{{json .State.Health.Status}}'
```

Ожидаемый статус: `"healthy"`
