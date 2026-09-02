# D&K Fit Landing Design Specification

**Status:** визуальное направление утверждено; реализация не начата.

**Selected visual target:** `docs/design/assets/editorial-strength-selected.png`, второй вариант из набора от 2026-09-02.

## 1. Цель

Создать быстрый адаптивный лендинг персонального фитнес-тренера D&K Fit, который за два смысловых экрана объясняет подход тренера, показывает формат занятий и принимает заявку. После подтверждённой отправки письма пользователь перенаправляется в Telegram-бота; после нажатия `Start / Запустить` бот один раз отвечает `Спасибо за регистрацию!` и больше ничего не делает.

## 2. Подтверждённый объём

### В MVP

- одна русскоязычная публичная страница;
- ровно две верхнеуровневые секции внутри `<main>`;
- desktop, tablet и mobile layout;
- favicon/brand mark D&K Fit;
- форма: имя, телефон, необязательная цель тренировок, согласие на обработку данных;
- серверная валидация и защита от простого спама;
- SMTP-уведомление на `superhumansmm@yandex.ru`;
- безопасный Telegram deep link;
- Telegram webhook и ответ только на `/start`;
- техническая страница политики обработки данных;
- контейнеризованный production build, smoke-check и rollback-инструкция.

### Не входит

- хранение лидов в PostgreSQL/CRM;
- админка, платежи, расписание и бронирование;
- аналитика, рекламные пиксели и cookies;
- рассылки или сообщения бота после благодарности;
- CAPTCHA до появления подтверждённого спама;
- автоматический fallback Yandex ↔ Mail.ru;
- неподтверждённые регалии, отзывы, цифры результата и гарантии.

## 3. Визуальная система Editorial Strength

### Композиция

**Экран 1 — hero.** Header является частью hero и не создаёт третью секцию. Слева — крупный заголовок `Сила становится стилем`, короткий текст и CTA. По центру/справа — крупный монохромный портрет тренера на фоне декоративной типографики `FIT`. Фигура может перекрывать декоративные буквы, но не интерактивный текст.

**Экран 2 — процесс и заявка.** На desktop три колонки: короткий блок о подходе, три этапа работы и форма. На mobile порядок линейный: подход → этапы → форма.

### Токены

```css
:root {
  --color-bg: #0b0b0c;
  --color-surface: #151416;
  --color-text: #f5f0e8;
  --color-text-muted: #c9c0b5;
  --color-burgundy: #6d1e32;
  --color-burgundy-hover: #81243b;
  --color-gold: #b99b61;
  --color-gold-focus: #d1b77c;
  --color-border: rgb(245 240 232 / 22%);
  --color-error: #ff9a9a;
  --color-success: #a9d7b5;
  --font-display: "Cormorant Garamond", Georgia, serif;
  --font-body: "Manrope", Arial, sans-serif;
  --container: 80rem;
  --gutter: clamp(1.25rem, 5vw, 4rem);
  --radius-control: 0.125rem;
  --control-height: 3.25rem;
}
```

- display serif используется только для крупных заголовков и декоративных цифр;
- geometric sans используется для основного текста, навигации, формы и кнопок;
- бордовый — CTA и один главный акцент; золото — линии, номера и focus ring;
- полупрозрачность сдержанная, без «пузырчатых» SaaS-карточек;
- пользовательские тексты остаются HTML-текстом, а не частью изображения;
- hero-портрет и favicon создаются как реальные assets, не как CSS/div art.

### Responsive

- `>= 1024px`: hero 5/7 колонок; экран 2 — 7/5; обе секции `min-block-size: 100svh`;
- `768–1023px`: адаптивные две колонки, форма не уже `20rem`;
- `< 768px`: одна колонка, портрет под текстом или безопасно затемнённым фоном;
- на низкой высоте, при zoom и увеличенном тексте секции растут по контенту; фиксированный `height: 100vh` запрещён;
- обязательные проверки: 320×568, 390×844, 768×1024, 1440×900;
- горизонтальный scroll запрещён; touch targets не меньше 44×44 px.

## 4. Контент

До получения подтверждённых данных о тренере используется нейтральное `тренер D&K Fit`; вымышленное имя не публикуется.

Утверждённый базовый текст:

- hero: `Сила становится стилем`;
- подзаголовок: `Персональные тренировки с вниманием к каждой детали.`;
- CTA: `Начать персонально`;
- экран 2: `Тренировки, которые подстраиваются под вас, а не наоборот.`;
- этапы: `Знакомство`, `План`, `Тренировка`;
- форма: `Оставьте заявку`;
- Telegram note: `После отправки откроется Telegram. Нажмите Start / Запустить, чтобы получить подтверждение.`

Запрещены без отдельного подтверждения: стаж, сертификаты, количество клиентов, отзывы, сроки похудения, проценты результата, адрес, телефон тренера и гарантии.

## 5. Форма и API-контракт

### Запрос

```ts
type LeadSubmitRequest = {
  name: string;
  phone: string;
  goal?: string;
  consent: true;
  website?: "";        // honeypot
  startedAt: number;   // epoch ms, защита от мгновенных submit
};
```

`POST /api/leads`, `Content-Type: application/json`, same-origin only.

Валидация:

- `name`: trim, 2–80 символов, минимум одна Unicode-буква, без CR/LF/control chars;
- `phone`: исходная строка 7–32 символа, после удаления форматирования 7–15 цифр;
- `goal`: optional, trim, максимум 300 символов, без control chars кроме обычного переноса;
- `consent`: строго `true`;
- `website`: отсутствует или пустая строка;
- body: не больше 8 KiB;
- запрос раньше чем через 2 секунды после `startedAt` отклоняется как spam.

Успех:

```ts
type LeadSubmitSuccess = {
  ok: true;
  status: "email_accepted";
  telegramDeepLink: string;
};
```

HTTP `201`. Это означает, что SMTP-сервер принял сообщение; доставка в папку «Входящие» дополнительно проверяется release-smoke.

Ошибки:

```ts
type LeadErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_ORIGIN"
  | "IDEMPOTENCY_CONFLICT"
  | "REQUEST_IN_PROGRESS"
  | "RATE_LIMITED"
  | "EMAIL_UNAVAILABLE"
  | "CONFIGURATION_ERROR"
  | "INTERNAL_ERROR";

type LeadSubmitError = {
  ok: false;
  error: {
    code: LeadErrorCode;
    requestId: string;
    fieldErrors?: Record<string, string[]>;
  };
};
```

HTTP: `400` malformed JSON/content type, `403` origin, `409` idempotency conflict/in progress, `422` fields/bot trap, `429` limit, `503` SMTP/config, `500` unknown. Honeypot или submit быстрее двух секунд возвращает `422 INVALID_REQUEST`, не вызывает SMTP и не возвращает Telegram URL. Telegram URL возвращается только при `201` или успешном replay ранее принятого запроса.

### UI state machine

```text
idle -> validating -> submitting -> email_accepted -> redirecting
                     |-> validation_error
                     |-> rate_limited
                     |-> delivery_error
```

Кнопка блокируется во время запроса. Ошибка сохраняет введённые данные. При успешном ответе UI кратко показывает `Заявка отправлена. Открываем Telegram…` и выполняет `window.location.assign(telegramDeepLink)`. Возврат Back не должен повторять POST.

## 6. Письмо

Получатель зафиксирован: `superhumansmm@yandex.ru`.

Subject:

```text
D&K Fit — новая заявка
```

Plain-text body:

```text
Новая заявка с сайта {PUBLIC_SITE_URL}
Автор: {SITE_AUTHOR_FULL_NAME}

Данные из заявки:
Имя: {name}
Телефон: {phone}
Цель тренировок: {goalOrНеУказана}
```

- URL и ФИО берутся только из server env;
- пользовательские значения не подставляются в SMTP headers;
- активный SMTP настраивается generic env и меняется без правки кода;
- automatic provider fallback запрещён: неизвестный исход timeout может породить дубль;
- редирект в Telegram происходит только после успешного `sendMail()` с целевым recipient в `accepted`.

## 7. Telegram

Deep link строится сервером:

```text
https://t.me/{TELEGRAM_BOT_USERNAME}?start=registered
```

Payload не содержит PII. Telegram показывает кнопку `Start`; бот не может инициировать диалог до действия пользователя.

Webhook:

- `POST /api/telegram/webhook`;
- обязательный `X-Telegram-Bot-Api-Secret-Token`;
- `allowed_updates=["message"]`;
- отвечает только на `/start`, `/start registered` и `/start@bot_username registered` в private chat;
- точный ответ: `Спасибо за регистрацию!`;
- остальные сообщения и события получают HTTP 200 без вызова `sendMessage`;
- повторный `update_id` не должен породить второй ответ;
- первый принятый `/start` атомарно создаёт `telegram:started:<hmac(chat_id)>`; любой последующий `/start` того же private chat получает HTTP 200 без `sendMessage`.

## 8. Идемпотентность и rate limit

MVP разворачивается с Redis. Он хранит только технические записи без исходной PII; все rate/idempotency records имеют TTL, а одноразовый Telegram chat marker хранится как HMAC:

- `lead:idempotency:<hmac>` — 24 часа;
- `lead:rate:ip:<hmac>` — окна 10 минут/сутки;
- `lead:rate:phone:<hmac>` — окна час/сутки;
- `telegram:update:<update_id>` — 7 суток.
- `telegram:started:<hmac(chat_id)>` — без TTL; хранится только HMAC-маркер факта благодарности, без raw chat id.

Клиент создаёт UUID v4 `Idempotency-Key` на одну логическую отправку и повторно использует его только при сетевом retry. Один ключ с тем же payload возвращает прежний success без второго письма; другой payload с тем же ключом возвращает `409`.

Лимиты MVP: 5 новых заявок с IP за 10 минут, 30 в сутки; 3 с одного нормализованного телефона в час, 5 в сутки. Redis недоступен — endpoint формы возвращает `503` до SMTP.

## 9. Privacy, безопасность и доступность

- SMTP/Telegram/Redis secrets только в server env, без `NEXT_PUBLIC_`;
- не логировать request body, имя, телефон, цель, письмо и полный Telegram update;
- логи содержат `requestId`, status, duration и HMAC-fingerprint;
- same-origin request, проверка `Origin`, JSON only, лимит размера body;
- обязательное согласие и ссылка на `/privacy`;
- юридические реквизиты политики передаёт владелец; техническая команда не придумывает их;
- видимые labels, `autocomplete=name/tel`, `aria-invalid`, `aria-describedby`, live region;
- keyboard-only сценарий, focus-visible, WCAG 2.2 AA, reduced motion;
- без cookies и клиентского хранения данных формы.

## 10. Переменные окружения

Обязательные production keys:

```text
PUBLIC_SITE_URL
SITE_AUTHOR_FULL_NAME
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
SMTP_CONNECTION_TIMEOUT_MS
SMTP_SOCKET_TIMEOUT_MS
TELEGRAM_BOT_TOKEN
TELEGRAM_BOT_USERNAME
TELEGRAM_WEBHOOK_SECRET
REDIS_URL
PII_HASH_SECRET
LEGAL_OPERATOR_NAME
LEGAL_OPERATOR_CONTACT
```

Пустые/невалидные обязательные значения блокируют production start. Bot username хранится без `@`. `PUBLIC_SITE_URL` обязан быть HTTPS в production.

## 11. Deployment

Baseline — один Docker Compose stack: Next.js Node runtime + Redis. HTTPS reverse proxy и домен предоставляются целевой площадкой. Архитектура не зависит от конкретного VPS; перенос на serverless потребует managed Redis и отдельной проверки SMTP timeout.

Webhook устанавливается только после доступности production HTTPS URL. Rollback возвращает предыдущий immutable image и повторно привязывает webhook к правильному URL.

## 12. Критерии приёмки

- `<main>` содержит ровно две верхнеуровневые секции;
- вариант Editorial Strength воспроизведён по выбранному mockup: композиция, типографика, crop, палитра и ритм;
- нет horizontal overflow на 320, 390, 768 и 1440 px;
- форма полностью доступна с клавиатуры и не обрезается при zoom 200%; axe не находит critical/serious;
- один submit создаёт одно письмо с точным subject/body;
- при SMTP error нет success и Telegram redirect;
- успех открывает только сконфигурированный `t.me` URL;
- до нажатия Start бот молчит; `/start` даёт ровно `Спасибо за регистрацию!`;
- другие сообщения не получают ответа;
- секреты и PII отсутствуют в client bundle, логах и error responses;
- production preflight, real SMTP smoke и Telegram webhook smoke пройдены;
- hero image, logo/favicon и шрифты имеют подтверждённые права на использование.

## 13. Обязательные входы перед production

Разработка с тестовыми fixtures может идти без них, но production deploy блокируется до передачи:

1. публичного URL и выбранного хостинга;
2. ФИО автора для письма;
3. SMTP provider/account/from/password;
4. Telegram bot token и username;
5. юридического имени и контакта оператора данных;
6. подтверждённого имени/биографии тренера, если их нужно публиковать;
7. прав на финальное фото и шрифты.

## 14. Источники контрактов

- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Next.js environment variables: https://nextjs.org/docs/app/guides/environment-variables
- Telegram Bot API and webhook secret: https://core.telegram.org/bots/api
- Telegram bot deep links and `start`: https://core.telegram.org/api/links
- Node.js production baseline: Node.js 24 LTS.
