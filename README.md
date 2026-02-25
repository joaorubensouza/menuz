# Menuz AR (prototype)

Run locally:

1. npm install
2. npm start
3. Open http://localhost:5170

Demo logins:
- Master: admin@menuz.local / admin123
- Cliente: bistro@menuz.local / cliente123

Use apenas em ambiente local de desenvolvimento.

Notes:
- Web AR uses model-viewer. Android uses GLB, iOS needs USDZ.
- The scanner captures photos and you can create jobs in "Fila 3D" in /admin.
- AI provider integration (Meshy) is available via backend endpoints.

AI setup (Meshy):

1. Configure API key before starting the server:
   - PowerShell: `$env:MESHY_API_KEY="sua_chave"`
   - or copy `.env.example` to `.env` and fill values
   - or create `.env` in project root:
     - `MESHY_API_KEY=sua_chave`
     - `MESHY_AI_MODEL=meshy-6`
     - `MESHY_MAX_REFERENCE_IMAGES=4`
2. Start server: `npm start`
3. In `/admin` -> restaurant -> `Fila 3D`:
   - Create a job with provider `Meshy`
   - Upload fotos no job (o backend envia ate 4 referencias para Meshy Pro)
   - Click `Rodar IA`
   - Click `Sincronizar` until status reaches `revisao` or `publicado`
