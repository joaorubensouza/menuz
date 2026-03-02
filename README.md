# Menuz AR (prototype)

## Run local

1. `npm install`
2. `npm start`
3. Open `http://localhost:5170`

Demo logins:
- Master: `admin@menuz.local` / `admin123`
- Cliente: `bistro@menuz.local` / `cliente123`

## AI setup (Meshy)

1. Copy `.env.example` to `.env` and configure:
   - `MESHY_API_KEY=...`
   - `MESHY_AI_MODEL=meshy-6`
   - `MESHY_MAX_REFERENCE_IMAGES=4`
2. Start server with `npm start`
3. In `/admin` -> restaurant -> `Fila 3D`:
   - create job with provider `Meshy`
   - upload photos
   - `Rodar IA`
   - `Sincronizar` until `revisao` or `publicado`
   - `Avaliar QA` para gerar score de qualidade
   - `Publicar` (gate exige GLB + USDZ e score minimo)

## Security baseline (already applied)

- Login lock por IP (`LOGIN_*`)
- Rate limit para pedido publico (`ORDER_*`)
- Rate limit para chamadas de IA (`AI_ACTION_*`)
- Rate limit para tracking publico (`PUBLIC_EVENT_*`)
- Hardening de headers (CSP, HSTS, frame deny, etc.)
- Sanitizacao de entrada para restaurante/item/pedido
- Gate de publicacao de modelo por score QA (`QA_MIN_PUBLISH_SCORE`)

## Analytics de produto (novo)

- Tracking publico:
  - `menu_view`, `item_view`, `ar_open`, `add_to_cart`, `order_submit`, `qr_scan`
- Endpoint de coleta:
  - `POST /api/public/events`
- Endpoint de analytics por restaurante (autenticado):
  - `GET /api/restaurants/:id/analytics?days=30`
- Painel admin:
  - Secao `Analytics` com funil (menu -> AR -> pedido), receita e top itens.
  - Alertas de conversao para decidir a proxima acao comercial.

## Automacao da fila 3D

- Endpoint (autenticado):
  - `POST /api/restaurants/:id/model-jobs/auto-process`
- Painel admin:
  - botao `Rodar automacao` em `Fila 3D`
- Fluxo:
  - inicia jobs `auto_mode`
  - sincroniza status IA
  - avalia QA
  - publica automaticamente quando passar no gate
- Execucao automatica no Cloudflare:
  - cron `*/15 * * * *` no Worker
  - processa todos os restaurantes com jobs `auto_mode`

## Cloud-native migration (Worker + D1 + R2)

Prerequisite:
- Enable R2 in Cloudflare Dashboard (`R2 -> Enable`) for your account.

Run full migration:

1. `powershell -ExecutionPolicy Bypass -File .\scripts\migrar-cloudflare-native.ps1`

This script:
- applies `cloudflare/schema.sql` to D1
- imports data from `data/db.json` (via `cloudflare/seed.sql`)
- uploads local `uploads/` to R2
- deploys Worker

Main files:
- `workers/menuz-worker.js`
- `wrangler.toml`
- `cloudflare/schema.sql`
- `scripts/export-db-sql.mjs`
- `scripts/sync-uploads-r2.ps1`
- `scripts/migrar-cloudflare-native.ps1`

## Plano em PDF

- Fonte (editavel): `docs/plano-execucao-menuz.md`
- PDF gerado: `docs/plano-execucao-menuz.pdf`
- Regenerar PDF: `node scripts/generate-plan-pdf.mjs`
