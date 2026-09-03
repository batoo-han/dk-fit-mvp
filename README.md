# D&K Fit

Пакет подготовки двухэкранного лендинга персонального фитнес-тренера.

Текущий статус: MVP в направлении **Editorial Strength** реализован и проходит
локальные автоматизированные проверки. Production-релиз остаётся **NO-GO** до
закрытия owner inputs, ручной accessibility-проверки, сборки образа на хосте с
Docker daemon и отдельно разрешённых SMTP/Telegram/deploy smoke.

## Начать работу

1. Прочитать `AGENTS.md`.
2. Прочитать `docs/superpowers/specs/2026-09-02-dk-fit-landing-design.md`.
3. Выполнять `docs/superpowers/plans/2026-09-02-dk-fit-implementation.md` по порядку.
4. Не начинать production-проверки, пока владелец не передал обязательные входные данные из `docs/handoff/agent-task-map.md`.

## Артефакты

- `docs/design/assets/editorial-strength-selected.png` — выбранная визуальная цель.
- `docs/superpowers/specs/2026-09-02-dk-fit-landing-design.md` — продуктовый и технический контракт.
- `docs/superpowers/plans/2026-09-02-dk-fit-implementation.md` — пошаговый план разработки.
- `docs/handoff/agent-task-map.md` — очередность агентов, границы задач и входные данные.
- `.agents/` — узкие профили исполнителей и ревьюеров.

## Границы MVP

В MVP входят лендинг из двух смысловых экранов, адаптивный дизайн, форма заявки, SMTP-уведомление на server-only адрес из `LEAD_RECIPIENT_EMAIL`, переход в Telegram и бот, отвечающий благодарностью только на `/start`.

В MVP не входят CRM, личный кабинет, база лидов, платежи, аналитика поведения, рассылки, календарь, автоматический ответ на произвольные сообщения и автоматический fallback между SMTP-провайдерами.

## Docker Compose

Production Compose reads `.env` by default; create it locally from `.env.example` and keep it outside Git. For an explicit deployment-specific file, set `DK_FIT_ENV_FILE` to its path before running Compose. The `app` service always runs with `NODE_ENV=production`, even if the selected env file contains another value.

`NODE_ENV` is resolved once into the server-side route dependencies. In production,
`POST /api/leads` accepts only the configured HTTPS `PUBLIC_SITE_URL`; it never
trusts an arbitrary `Host`. A local preview may use `NODE_ENV=development`, which
also permits only an exact same-origin `localhost` or `127.0.0.1` request. The
example username `DandK_FitBody_bot` is public configuration only; keep its token
and all other secrets out of the repository.

По умолчанию порт приложения публикуется только на loopback хоста:
`127.0.0.1:${DK_FIT_APP_PORT:-3000}`. Этот вариант рассчитан на доверенный
reverse proxy на том же хосте. Proxy обязан **перезаписывать**, а не дополнять
и не передавать как есть, `X-Forwarded-For` одним проверенным IP клиента.
Приложение не доверяет цепочкам или невалидным значениям заголовка и относит их
к общей fail-closed identity `unknown` для rate limit. Не публикуйте app-порт на
`0.0.0.0` без нового доверительного контракта ingress.

`docker compose --env-file .env.example config --no-interpolate --quiet`
проверяет Compose-модель без Docker daemon и без вывода значений. Это не
заменяет `docker compose build`, запуск контейнера, проверку entrypoint/preflight
или production environment.

## SMTP TLS contract

`SMTP_SECURE=true` uses implicit TLS when connecting to the SMTP server (usually
port 465). `SMTP_SECURE=false` selects STARTTLS instead: both lead delivery and
the explicit smoke tool set Nodemailer's `requireTLS=true`, so a server that
does not upgrade to TLS is rejected rather than used over plaintext. Certificate
validation remains enabled (`rejectUnauthorized=true`) in both modes. The
public lead recipient is the required server-only `LEAD_RECIPIENT_EMAIL` value;
it is never a `NEXT_PUBLIC_` variable or client-side value.

## Локальные проверки

Используйте Node 24. Vitest настроен с `envDir: false`, поэтому unit/component/
integration run не загружает root dotenv-файлы. Production build запускайте
только через контролируемый E2E/release harness либо в изолированном окружении;
raw `next build` может применять собственные правила загрузки окружения Next.js.
