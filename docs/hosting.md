# Hosting and production checklist

Этот файл описывает безопасный порядок развёртывания Steply. Локальный
`docker-compose.yml` оставлен для разработки; для хостинга используйте
`docker-compose.prod.yml` или эквивалентную конфигурацию платформы.

## Обязательные production-переменные

```env
ENVIRONMENT=production
AUTO_INIT_DB=false
SECRET_KEY=<long-random-secret>
DATABASE_URL=postgresql://<user>:<password>@postgres:5432/<db>
BACKEND_CORS_ORIGINS=https://steply.example.com
BACKEND_CORS_ORIGIN_REGEX=
VITE_API_URL=
VITE_PUBLIC_APP_URL=https://steply.example.com
SERVER_NAME=steply.example.com
TLS_CERT_PATH=/absolute/path/fullchain.pem
TLS_KEY_PATH=/absolute/path/privkey.pem
UVICORN_WORKERS=2
FORWARDED_ALLOW_IPS=*
```

Backend валидирует эти значения при старте. В non-local окружении он не
запустится с dev `SECRET_KEY`, regex CORS, `AUTO_INIT_DB=true` или пустыми
explicit CORS origins.

## Рекомендуемый порядок деплоя

1. Создайте `.env.production` или секреты платформы с переменными выше.
2. Убедитесь, что PostgreSQL не публикует порт наружу. В
   `docker-compose.prod.yml` база находится только во внутренней сети.
3. Соберите образы:

   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml build
   ```

4. Примените миграции отдельным шагом:

   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backend alembic upgrade head
   ```

   Локальный shorthand:

   ```bash
   COMPOSE_FILE=docker-compose.prod.yml COMPOSE_ENV_FILE=.env.production ./scripts/migrate.sh
   ```

5. Запустите сервисы:

   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d
   ```

6. Проверьте healthcheck:

   ```bash
   curl -fsS https://steply.example.com/api/health
   ```

## Reverse proxy и TLS

`deploy/nginx/steply.conf.template` содержит:

- HTTP -> HTTPS redirect;
- HSTS и базовые security headers;
- rate limiting для `/api/auth/` и общего API;
- проксирование frontend и API через same-origin домен.

TLS-сертификаты должны быть выпущены заранее через Certbot, платформу хостинга
или другой ACME-клиент. Если TLS завершает внешний load balancer, используйте
этот nginx template как reference и не публикуйте backend напрямую в интернет.

## Миграции и startup

В production `AUTO_INIT_DB=false`. Миграции выполняются отдельным release-step,
а не в lifecycle приложения. Это снижает риск гонок при нескольких replicas и
делает rollback понятнее.

CI дополнительно запускает `alembic upgrade head` на PostgreSQL и собирает
backend/frontend Docker images. Перед реальным деплоем всё равно проверьте
миграции на staging-копии базы.

## База данных и backups

Для production предпочтительна managed PostgreSQL с автоматическими backup,
point-in-time recovery и мониторингом диска. Если используется compose-база:

- не публикуйте `5432` наружу;
- храните volume/snapshot вне ephemeral диска;
- настройте ежедневный `pg_dump` или snapshot у провайдера;
- периодически проверяйте восстановление backup на отдельной базе.

## Rate limiting

Backend имеет in-memory rate limit для login/register. Он полезен для одного
процесса, но не является глобальным лимитером для нескольких replicas. В
production используйте proxy/load-balancer лимиты из nginx template или внешний
Redis/API gateway limiter.

## Логи и мониторинг

Минимальный production-набор:

- собирайте stdout/stderr контейнеров backend, frontend и reverse proxy;
- добавьте alert на падение `/api/health`;
- следите за PostgreSQL connections, disk usage и latency;
- включайте AI-рекомендации только после настройки `BOTHUB_API_KEY`;
- ошибки AI-провайдера логируются, но приложение продолжает использовать
  эвристический fallback.

## Rollback

Перед миграцией сделайте backup. Если release неуспешен:

1. остановите новый frontend/backend image;
2. верните предыдущий image tag;
3. восстановите backup, если миграция изменила схему или данные несовместимо;
4. повторно проверьте `/api/health` и вход пользователя.
