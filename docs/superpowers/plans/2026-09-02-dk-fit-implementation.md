# D&K Fit Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать, проверить и подготовить к production двухэкранный лендинг D&K Fit с Editorial Strength design, SMTP-уведомлением и Telegram-ботом благодарности.

**Architecture:** Один Next.js App Router проект обслуживает лендинг, lead API и Telegram webhook. Redis обеспечивает краткоживущую идемпотентность, rate limit и дедупликацию Telegram updates; пользовательская PII не сохраняется в приложении. Production baseline — Node.js container + Redis, SMTP и Telegram подключаются только через server env.

**Tech Stack:** Node.js 24 LTS, Next.js App Router + React + strict TypeScript, CSS Modules, Zod, Nodemailer, Redis, Vitest + Testing Library, Playwright + axe, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-02-dk-fit-landing-design.md`

## Global Constraints

- Корень приложения: `dk-fit/`; текущий каталог не является git-репозиторием, поэтому Task 1 создаёт отдельный repo.
- В `<main>` ровно две верхнеуровневые секции: hero и trainer/process/form.
- Выбранная визуальная цель: `docs/design/assets/editorial-strength-selected.png`.
- Публичный UI на русском; бренд пишется ровно `D&K Fit`.
- Публичный текст не содержит неподтверждённых регалий, цифр, отзывов или гарантий.
- Форма собирает имя, телефон, необязательную цель и обязательное согласие.
- Письмо уходит только на server-only адрес из `LEAD_RECIPIENT_EMAIL` и имеет точный шаблон из spec.
- Telegram redirect разрешён только после SMTP `accepted`.
- Бот отвечает ровно `Спасибо за регистрацию!` только на `/start`; другие сообщения игнорируются.
- Пользователь обязан нажать `Start / Запустить`; бот не может первым написать пользователю.
- PII не хранится в Redis, browser storage, analytics или логах.
- Production secrets никогда не имеют префикс `NEXT_PUBLIC_`.
- Yandex/Mail.ru переключаются env-конфигурацией; автоматический fallback запрещён.
- Production deploy блокируется до получения входов из раздела 13 spec.
- Все code tasks выполняются через TDD; каждый task заканчивается собственными проверками и review gate.
- Если задача выполняется агентами, implementer не проводит собственную финальную приёмку: после него работает отдельный reviewer.

---

## Карта файлов

```text
dk-fit/
├── package.json                         # scripts/dependencies
├── package-lock.json                    # pinned dependency graph
├── tsconfig.json                        # strict TypeScript
├── next.config.ts                       # security headers/image policy
├── eslint.config.mjs                    # lint contract
├── vitest.config.mts                    # unit/component/integration projects
├── playwright.config.ts                 # desktop/mobile E2E
├── .env.example                         # empty required keys, no secrets
├── Dockerfile                           # reproducible Node runtime
├── compose.yaml                         # app + Redis
├── AGENTS.md                            # agent contract
├── public/
│   ├── images/hero-trainer.avif         # final editorial hero asset
│   ├── images/hero-trainer.webp         # compatibility asset
│   ├── brand/favicon-32.png             # generated brand mark
│   └── brand/apple-touch-icon.png
├── src/
│   ├── app/
│   │   ├── api/leads/route.ts
│   │   ├── api/telegram/webhook/route.ts
│   │   ├── privacy/page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── landing/{SiteHeader,HeroSection,TrainerProcessSection,ProcessSteps}.tsx
│   │   └── ui/{Button,TextField,ConsentField,FormStatus}.tsx
│   ├── content/{landing.ru.ts,landing-content.types.ts}
│   ├── features/lead-form/
│   │   ├── LeadForm.tsx
│   │   ├── LeadForm.module.css
│   │   ├── lead-client.ts
│   │   └── lead-form-state.ts
│   ├── lib/
│   │   ├── config/env.ts
│   │   ├── contracts/lead.ts
│   │   ├── leads/{email-message,mailer,idempotency,rate-limit,service}.ts
│   │   ├── redis/client.ts
│   │   ├── security/{fingerprint,origin,request-id}.ts
│   │   └── telegram/{client,command,dedupe,deep-link}.ts
│   └── styles/{reset,tokens}.css
├── scripts/
│   ├── check-env.mjs
│   ├── set-telegram-webhook.mjs
│   ├── verify-assets.mjs
│   └── smoke-production.mjs
└── tests/
    ├── unit/{env,lead-contract,email-message,telegram-command}.test.ts
    ├── component/{landing-page,lead-form}.test.tsx
    ├── integration/{lead-route,telegram-webhook}.test.ts
    └── e2e/{landing,lead-form,accessibility,visual}.spec.ts
```

---

### Task 1: Создать воспроизводимый проект и quality gates

**Owner:** foundation-agent.

**Files:**
- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `tests/component/landing-page.test.tsx`

**Interfaces:**
- Consumes: Node.js 24 LTS, npm.
- Produces: `npm run dev`, `lint`, `typecheck`, `test`, `test:e2e`, `build`, `verify`.

- [ ] **Step 1: Инициализировать отдельный git repo и feature branch**

```powershell
cd dk-fit
git init -b main
git add README.md AGENTS.md .agents docs
git commit -m "docs: add D&K Fit agent handoff"
git switch -c feature/dk-fit-mvp
```

Expected: `git status --short` пуст; активна `feature/dk-fit-mvp`.

- [ ] **Step 2: Создать package contract**

Установить runtime packages `next@19`, `react@19`, `react-dom@19`, `zod`, `nodemailer`, `redis`, `sharp`. Установить dev packages `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/nodemailer`, `eslint`, `eslint-config-next`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@playwright/test`, `@axe-core/playwright`.

Scripts обязаны включать:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "check:env": "node scripts/check-env.mjs",
  "verify:assets": "node scripts/verify-assets.mjs",
  "verify": "npm run lint && npm run typecheck && npm test && npm run build && npm run verify:assets && npm run test:e2e"
}
```

- [ ] **Step 3: Написать первый failing component test**

```tsx
it('renders exactly two top-level main sections', () => {
  render(<Home />);
  expect(screen.getByRole('main').querySelectorAll(':scope > section')).toHaveLength(2);
});
```

Run: `npm test -- tests/component/landing-page.test.tsx`  
Expected: FAIL, `Home`/sections ещё не реализованы.

- [ ] **Step 4: Создать минимальный semantic shell**

`layout.tsx` задаёт `lang="ru"`; `page.tsx` возвращает `<main>` с двумя временными semantic sections и заголовками. Никакого visual styling и API в Task 1.

- [ ] **Step 5: Проверить scaffold**

```powershell
npm run lint
npm run typecheck
npm test -- tests/component/landing-page.test.tsx
npm run build
```

Expected: все четыре команды exit 0.

- [ ] **Step 6: Commit и independent review**

```powershell
git add package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs vitest.config.mts playwright.config.ts src tests
git commit -m "build: scaffold D&K Fit application"
```

---

### Task 2: Зафиксировать env и shared lead contract

**Owner:** foundation-agent.

**Files:**
- Create: `.env.example`
- Create: `src/lib/config/env.ts`
- Create: `src/lib/contracts/lead.ts`
- Create: `tests/unit/env.test.ts`, `tests/unit/lead-contract.test.ts`
- Create: `scripts/check-env.mjs`

**Interfaces:**
- Produces: `getServerEnv(): ServerEnv`, `leadSubmitSchema`, `LeadSubmitRequest`, `LeadSubmitSuccess`, `LeadSubmitError`.

- [ ] **Step 1: Написать failing env tests**

Проверить: отсутствующий key; `PUBLIC_SITE_URL` не HTTPS в production; bot username с `@`; SMTP port вне `1..65535`; слишком короткие `PII_HASH_SECRET`/webhook secret; отсутствие legal operator fields.

Run: `npm test -- tests/unit/env.test.ts`  
Expected: FAIL, модуль `src/lib/config/env.ts` отсутствует.

- [ ] **Step 2: Реализовать fail-fast env schema**

```ts
export type ServerEnv = {
  publicSiteUrl: URL;
  siteAuthorFullName: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
    connectionTimeoutMs: number;
    socketTimeoutMs: number;
  };
  telegram: { token: string; username: string; webhookSecret: string };
  redisUrl: string;
  piiHashSecret: string;
  legalOperatorName: string;
  legalOperatorContact: string;
};
```

Значения читаются динамически на server; секреты не экспортируются в client modules.

- [ ] **Step 3: Написать failing lead-schema tests**

Проверить точные границы `name`, `phone`, optional `goal`, consent, honeypot, `startedAt`, unknown keys и control chars.

- [ ] **Step 4: Реализовать shared contract**

```ts
export const leadSubmitSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(32),
  goal: z.string().trim().max(300).optional(),
  consent: z.literal(true),
  website: z.literal('').optional(),
  startedAt: z.number().int().positive(),
}).strict();
```

После Zod выполнить domain checks на букву в имени, 7–15 цифр телефона и control chars.

- [ ] **Step 5: Создать `.env.example` и preflight**

`.env.example` содержит все keys из spec с пустыми secret/business values, `SMTP_CONNECTION_TIMEOUT_MS=10000`, `SMTP_SOCKET_TIMEOUT_MS=15000`. `scripts/check-env.mjs` печатает только имена отсутствующих/невалидных keys, никогда значения.

- [ ] **Step 6: Проверить и commit**

```powershell
npm test -- tests/unit/env.test.ts tests/unit/lead-contract.test.ts
npm run typecheck
git add .env.example src/lib/config src/lib/contracts tests/unit scripts/check-env.mjs
git commit -m "feat: define environment and lead contracts"
```

---

### Task 3: Подготовить финальные visual assets и content source

**Owner:** visual-frontend-agent.  
**Required skill:** product-design:image-to-code; use built-in ImageGen for raster assets.

**Files:**
- Create: `public/images/hero-trainer.avif`, `public/images/hero-trainer.webp`
- Create: `public/brand/favicon-32.png`, `public/brand/apple-touch-icon.png`
- Create: `src/content/landing-content.types.ts`, `src/content/landing.ru.ts`
- Create: `scripts/verify-assets.mjs`

**Interfaces:**
- Produces: `landingContent`, correctly-sized image files, verified asset inventory.

- [ ] **Step 1: Inspect selected reference at original resolution**

Catalog only two missing raster assets: monochrome editorial trainer portrait without embedded UI text, and geometric D&K brand mark. Record target crops: hero desktop 1200×1400 portrait-safe; mobile focal area centered on face/torso; icon sources square.

- [ ] **Step 2: Generate and inspect hero asset**

Use the selected mockup as reference. Require fictional adult athlete, black asymmetric sportswear, neutral studio background, grayscale/high contrast, no text/logo/watermark, no resemblance request to a real person. Inspect crop before saving.

- [ ] **Step 3: Generate and inspect brand mark**

Generate a minimal geometric D&K/diamond mark consistent with muted gold editorial luxury, on a removable flat background. Export raster 32×32 and 180×180; do not hand-draw SVG/CSS art.

- [ ] **Step 4: Centralize exact public copy**

`landing.ru.ts` contains only strings approved in spec, form labels/errors and accessible image descriptions. Components must not contain marketing copy literals.

- [ ] **Step 5: Verify assets**

`verify-assets.mjs` checks file existence, pixel dimensions, non-zero size and prohibits additional unreviewed files. It must fail before assets exist and pass after export.

- [ ] **Step 6: Commit and visual review**

```powershell
npm run verify:assets
git add public src/content scripts/verify-assets.mjs
git commit -m "feat: add approved editorial assets and content"
```

Reviewer checks rights/provenance note, crop, no embedded text and match to selected mockup.

---

### Task 4: Реализовать два responsive экрана Editorial Strength

**Owner:** visual-frontend-agent.  
**Required skill:** product-design:image-to-code.

**Files:**
- Create: `src/styles/reset.css`, `src/styles/tokens.css`
- Create: `src/components/landing/*.tsx`, corresponding `*.module.css`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Modify: `tests/component/landing-page.test.tsx`
- Create: `tests/e2e/landing.spec.ts`, `tests/e2e/visual.spec.ts`

**Interfaces:**
- Consumes: `landingContent`, image assets.
- Produces: `SiteHeader`, `HeroSection`, `TrainerProcessSection`, `ProcessSteps`.

- [ ] **Step 1: Expand failing structure tests**

Assert one `h1`, exactly two main sections, header inside hero, CTA `href="#lead-form"`, three process steps, no numeric claim patterns and no third marketing section.

- [ ] **Step 2: Implement semantic components**

`page.tsx` composes only:

```tsx
<main>
  <HeroSection />
  <TrainerProcessSection />
</main>
```

- [ ] **Step 3: Implement tokens and desktop grid**

Use exact tokens from spec, 12-column desktop grid, hero 5/7 and second screen 7/5. Sections use `min-block-size: 100svh; block-size: auto`.

- [ ] **Step 4: Implement mobile/tablet behavior**

At `<768px`, one column. The second section order is approach → steps → form slot. No fixed viewport height, no internal vertical scroll, no text over an unsafe image area.

- [ ] **Step 5: Add reduced-motion and focus behavior**

Anchor scrolling respects `prefers-reduced-motion`; all focus states remain visible; header CTA touch target >=44 px.

- [ ] **Step 6: Run targeted tests and capture baselines**

```powershell
npm test -- tests/component/landing-page.test.tsx
npx playwright test tests/e2e/landing.spec.ts tests/e2e/visual.spec.ts --update-snapshots
```

Expected: screenshots created for 1440×900 and 390×844; no overflow assertion failures.

- [ ] **Step 7: Run blocking design QA**

Compare reference and implementation at the same 1440×900 state. Fix P0/P1/P2 for layout, type, crop, color and spacing. Save `design-qa.md` with `final result: passed` before commit.

- [ ] **Step 8: Commit**

```powershell
git add src/app src/components src/styles tests design-qa.md
git commit -m "feat: implement Editorial Strength landing layout"
```

---

### Task 5: Реализовать доступную форму и client state machine

**Owner:** visual-frontend-agent.

**Files:**
- Create: `src/components/ui/*.tsx`
- Create: `src/features/lead-form/*`
- Create: `tests/component/lead-form.test.tsx`
- Create: `tests/unit/lead-form-state.test.ts`
- Modify: `src/components/landing/TrainerProcessSection.tsx`

**Interfaces:**
- Consumes: `leadSubmitSchema`, `POST /api/leads` contract.
- Produces: `LeadForm`, `submitLead(request, signal)`, state reducer.

- [ ] **Step 1: Write failing state/component tests**

Cover initial, blur error, first-invalid focus, submitting, double click, 201 redirect, 422 field error, 429, 503, offline retry, Back without resubmit and preserved values after error.

- [ ] **Step 2: Implement accessible primitives**

Visible labels; `autocomplete="name"/"tel"`; `inputMode="tel"`; linked hint/error; consent checkbox; live status; no placeholder-only label.

- [ ] **Step 3: Implement request adapter**

Create one UUID v4 per logical submit, send as `Idempotency-Key`, retain across network retry, set 15-second `AbortController` timeout. Never log request body.

- [ ] **Step 4: Implement state machine**

Only `201`/successful replay can enter `email_accepted`. Then announce success and call `window.location.assign()` with the server-provided URL. All errors keep the user on page.

- [ ] **Step 5: Verify**

```powershell
npm test -- tests/unit/lead-form-state.test.ts tests/component/lead-form.test.tsx
npm run typecheck
```

- [ ] **Step 6: Commit and review**

```powershell
git add src/components/ui src/features src/components/landing/TrainerProcessSection.tsx tests
git commit -m "feat: add accessible lead submission flow"
```

---

### Task 6: Реализовать Redis idempotency, fingerprints и rate limit

**Owner:** lead-integration-agent.

**Files:**
- Create: `src/lib/redis/client.ts`
- Create: `src/lib/security/{fingerprint,request-id}.ts`
- Create: `src/lib/leads/{idempotency,rate-limit}.ts`
- Create: `tests/unit/idempotency.test.ts`, `tests/unit/rate-limit.test.ts`

**Interfaces:**
- Produces: `claimLead(key, requestHash)`, `completeLead(...)`, `checkLeadRateLimit(...)`, shared Redis client.

- [ ] **Step 1: Write failing transition tests**

Cover first claim, same-key/same-payload replay, same-key/different-payload conflict, processing, succeeded TTL, Redis unavailable fail-closed and exact IP/phone windows.

- [ ] **Step 2: Implement HMAC fingerprints**

Only HMAC-SHA256 derived from `PII_HASH_SECRET` enters Redis/logs. Raw IP, phone and idempotency key never persist.

- [ ] **Step 3: Implement atomic Redis claims**

Use `SET ... NX EX` plus stored request hash/status. TTL: lead 24h; Telegram update 7d. Do not silently fall back to process memory.

- [ ] **Step 4: Implement limits**

5/IP/10m, 30/IP/day, 3/phone/hour, 5/phone/day. Successful replay does not spend quota twice.

- [ ] **Step 5: Verify and commit**

```powershell
npm test -- tests/unit/idempotency.test.ts tests/unit/rate-limit.test.ts
git add src/lib/redis src/lib/security src/lib/leads tests/unit
git commit -m "feat: add lead idempotency and abuse limits"
```

---

### Task 7: Реализовать точное письмо и lead API

**Owner:** lead-integration-agent.

**Files:**
- Create: `src/lib/leads/{email-message,mailer,service}.ts`
- Create: `src/lib/security/origin.ts`
- Create: `src/app/api/leads/route.ts`
- Create: `tests/unit/email-message.test.ts`
- Create: `tests/integration/lead-route.test.ts`

**Interfaces:**
- Produces: `formatLeadEmail(env, lead)`, `sendLeadEmail(message)`, `submitLead(...)`, POST handler.

- [ ] **Step 1: Write golden email test**

Expected exact fixture:

```text
Новая заявка с сайта https://dk-fit.test
Автор: Тестовый Автор

Данные из заявки:
Имя: Анна Иванова
Телефон: +7 900 000-00-00
Цель тренировок: Стать сильнее
```

Also assert the validated `LEAD_RECIPIENT_EMAIL` fixture recipient, subject `D&K Fit — новая заявка`, UTF-8 and no user input in headers.

- [ ] **Step 2: Implement Nodemailer adapter**

Generic SMTP env; connection/socket timeouts; TLS required in production. Treat success only when required recipient appears in `accepted`. No automatic secondary provider.

- [ ] **Step 3: Write failing route integration tests**

Cover 400, 403, 409, 422, 429, honeypot, too-fast submit, Redis down, SMTP accepted/rejected/timeout, idempotent replay and unknown error redaction.

- [ ] **Step 4: Implement route sequence**

```text
content-type/body-size -> origin -> schema -> bot checks
-> atomic idempotency claim
   -> succeeded: replay without quota
   -> processing/conflict: return 409 without quota
   -> new claim: continue
-> rate limit for the newly claimed submission
-> SMTP -> mark succeeded -> return deep link
```

A rate-limit rejection atomically changes the new claim to `retryable_failed` (or deletes it) before returning `429`; it must not leave a `processing` record. Because concurrent/replayed requests exit at the claim step, they never increment rate counters twice.

Never return a Telegram URL before SMTP success. Add `Cache-Control: no-store` and `requestId` to safe errors.

- [ ] **Step 5: Verify and commit**

```powershell
npm test -- tests/unit/email-message.test.ts tests/integration/lead-route.test.ts
npm run typecheck
git add src/lib/leads src/lib/security/origin.ts src/app/api/leads tests
git commit -m "feat: deliver lead notifications by SMTP"
```

---

### Task 8: Реализовать Telegram deep link и webhook

**Owner:** telegram-agent.

**Files:**
- Create: `src/lib/telegram/{client,command,dedupe,deep-link}.ts`
- Create: `src/app/api/telegram/webhook/route.ts`
- Create: `scripts/set-telegram-webhook.mjs`
- Create: `tests/unit/telegram-command.test.ts`
- Create: `tests/integration/telegram-webhook.test.ts`

**Interfaces:**
- Produces: `buildTelegramDeepLink(username)`, `parseStartCommand(text, username)`, webhook POST handler.

- [ ] **Step 1: Write failing parser/deep-link tests**

Accept `/start`, `/start registered`, `/start@bot registered`; reject `/help`, normal text, edited/channel events. Deep link must equal `https://t.me/test_bot?start=registered` and never contain PII.

- [ ] **Step 2: Write failing webhook tests**

Cover missing/wrong secret 401, first valid Start one `sendMessage`, duplicate update no second message, a new Start update from the same chat no second message, non-Start 200/no action, Telegram error retry-safe response and no raw update logging.

- [ ] **Step 3: Implement webhook**

Constant-time header comparison. Process private chat text only. Before sending, atomically claim both `update_id` and HMAC fingerprint of `chat.id`; store no raw chat id. Only the first Start for that chat sends exact `Спасибо за регистрацию!`; repeated Start or other messages return 200 without `sendMessage`. No keyboard/menu. Handle Telegram timeout as an explicit unknown state instead of blind resend.

- [ ] **Step 4: Implement webhook setup script**

Call `setWebhook` with `${PUBLIC_SITE_URL}/api/telegram/webhook`, `secret_token`, `allowed_updates=["message"]`; print only URL/status, never token/secret.

- [ ] **Step 5: Verify and commit**

```powershell
npm test -- tests/unit/telegram-command.test.ts tests/integration/telegram-webhook.test.ts
git add src/lib/telegram src/app/api/telegram scripts tests
git commit -m "feat: add registration-only Telegram bot"
```

---

### Task 9: Добавить privacy page, metadata, security headers и containers

**Owner:** platform-release-agent.

**Files:**
- Create: `src/app/privacy/page.tsx`
- Modify: `src/app/layout.tsx`, `next.config.ts`
- Create: `Dockerfile`, `compose.yaml`, `.dockerignore`
- Create: `tests/integration/security-headers.test.ts`

**Interfaces:**
- Consumes: verified env and app routes.
- Produces: production container, Redis service, legal route, metadata/favicon wiring.

- [ ] **Step 1: Write failing privacy/headers tests**

Assert privacy page renders operator name/contact from server config; production headers include CSP, HSTS, `X-Content-Type-Options: nosniff`, restrictive `Referrer-Policy` and frame policy.

- [ ] **Step 2: Implement metadata and icons**

Title `D&K Fit — персональные тренировки`; neutral description; canonical from `PUBLIC_SITE_URL`; reference generated favicon/apple icon. No fake address/contact.

- [ ] **Step 3: Implement privacy route**

State collected fields, purpose (contact about training), email recipient, operator contact and organizational retention responsibility. Mark content for owner/legal approval; do not invent legal entity details.

- [ ] **Step 4: Implement production containers**

Multi-stage Node 24 LTS image, non-root runtime, standalone Next output, healthcheck. Compose defines app and Redis with persistent service configuration but no PII volume requirement; secrets supplied externally.

- [ ] **Step 5: Verify and commit**

```powershell
npm test -- tests/integration/security-headers.test.ts
npm run build
docker compose config
git add src/app next.config.ts Dockerfile compose.yaml .dockerignore tests
git commit -m "build: prepare secure production runtime"
```

---

### Task 10: Сквозная E2E, accessibility и visual QA

**Owner:** independent-qa-agent.  
**Constraint:** QA не исправляет production code; findings возвращаются владельцам tasks.

**Files:**
- Create/Modify: `tests/e2e/{landing,lead-form,accessibility,visual}.spec.ts`
- Create: `docs/qa/acceptance-matrix.md`, `docs/qa/evidence/README.md`

**Interfaces:**
- Produces: reproducible test evidence and `GO`/`NO-GO` for local/staging build.

- [ ] **Step 1: Add mocked browser E2E**

Cover valid submit → one request → exact `t.me`; 422/429/503/offline stay on page; double click one POST; Back no resubmit; keyboard-only complete path.

- [ ] **Step 2: Add layout matrix**

Run 320×568, 390×844, 768×1024, 1440×900. Assert no horizontal overflow, visible form/CTA, correct section count and no clipped focused field.

- [ ] **Step 3: Add accessibility gate**

`@axe-core/playwright`: zero critical/serious. Manual checklist: keyboard, focus, 200% zoom, reduced motion and one screen-reader path.

- [ ] **Step 4: Run visual comparison**

Compare same viewport/state against selected mockup. P0/P1/P2 mismatches block. Document only renderer-specific or intentionally responsive residual differences.

- [ ] **Step 5: Run full local verification**

```powershell
npm run verify
docker compose build
docker compose config
```

Expected: every command exit 0; acceptance matrix has no unowned P0/P1.

- [ ] **Step 6: Commit evidence**

```powershell
git add tests docs/qa
git commit -m "test: verify D&K Fit end-to-end flow"
```

---

### Task 11: Production preflight, deploy, smoke и handoff

**Owner:** platform-release-agent with independent-qa-agent witness.

**Files:**
- Create: `scripts/smoke-production.mjs`
- Create: `docs/runbooks/deploy.md`, `docs/runbooks/rollback.md`
- Create: `docs/qa/release-verdict.md`

**Interfaces:**
- Consumes: owner-supplied inputs from spec §13.
- Produces: deployed release or explicit `NO-GO`; sanitized evidence package.

- [ ] **Step 1: Check required owner inputs**

Run `npm run check:env`; confirm URL/hosting, author FIO, one active SMTP account, bot username/token, legal operator details and asset rights. Missing input → `NO-GO`, no deploy.

- [ ] **Step 2: Verify active SMTP before deploy**

Run Nodemailer `verify()` without printing secrets. Send one marked real test to an owner-approved recipient; compare subject/body to golden fixture and check Spam. The public handler recipient remains the server-only `LEAD_RECIPIENT_EMAIL` value.

- [ ] **Step 3: Deploy immutable container and bind webhook**

Verify HTTPS, then run `scripts/set-telegram-webhook.mjs`. Check `getWebhookInfo` URL, pending updates and last error without exposing token.

- [ ] **Step 4: Run production smoke**

Check homepage 200/canonical/headers, two sections at desktop/mobile, one real lead email, exact Telegram redirect, no bot message before Start, exact thanks after Start, no reply to ordinary text.

- [ ] **Step 5: Check privacy and logs**

Inspect client bundle, server logs and error response: no SMTP/Telegram/Redis secrets, names, phones, goals or full Telegram update.

- [ ] **Step 6: Record rollback**

Rollback switches to previous immutable image, restores matching env and rebinds webhook. Mandatory triggers: lost/duplicate lead, false success, PII/secret leak, broken mobile form, mass SMTP/webhook errors.

- [ ] **Step 7: Final verification and code review**

Run the full `npm run verify` against release commit. Dispatch broad code reviewer over the whole branch, fix Critical/Important, rerun affected gates, then record `GO`, `GO WITH ACCEPTED RISKS` or `NO-GO` with evidence links.

- [ ] **Step 8: Commit runbooks and verdict**

```powershell
git add scripts/smoke-production.mjs docs/runbooks docs/qa/release-verdict.md
git commit -m "docs: add D&K Fit release runbooks"
```

---

## Execution order

```text
Task 1 foundation
  -> Task 2 contracts
      -> Task 3 assets ---------> Task 4 visual layout -> Task 5 form UI
      -> Task 6 Redis ----------> Task 7 lead/email API
      -> Task 8 Telegram
  -> Task 9 platform (after 4, 7, 8)
  -> Task 10 independent QA
  -> Task 11 production release
```

Tasks 3, 6 and 8 can run in parallel after Task 2 because their file ownership does not overlap. Task 4 starts after Task 3; Task 7 starts after Task 6. No other parallel execution is allowed without recalculating the edit ownership map.

## Final self-review checklist for the controller

- [ ] Every spec requirement maps to a task.
- [ ] No task adds a third landing section.
- [ ] Email golden fixture matches the user wording.
- [ ] Telegram success is not claimed before Start.
- [ ] SMTP error cannot issue redirect.
- [ ] Unknown production inputs are release gates, not invented values.
- [ ] Implementers and reviewers are different agents.
- [ ] Full verification output is fresh before any completion claim.
