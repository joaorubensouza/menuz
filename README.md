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
