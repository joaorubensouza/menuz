# Menuz AR (prototype)

Run locally:

1. npm install
2. npm start
3. Open http://localhost:5170

Demo logins:
- Master: admin@menuz.local / admin123
- Cliente: bistro@menuz.local / cliente123

Notes:
- Web AR uses model-viewer. Android uses GLB, iOS needs USDZ.
- The scanner captures photos and you can create jobs in "Fila 3D" in /admin.
- AI provider integration (Meshy) is available via backend endpoints.

AI setup (Meshy):

1. Configure API key before starting the server:
   - PowerShell: `$env:MESHY_API_KEY="sua_chave"`
2. Start server: `npm start`
3. In `/admin` -> restaurant -> `Fila 3D`:
   - Create a job with provider `Meshy`
   - Upload photos in the job form (or inside each job row)
   - Click `Rodar IA`
   - Click `Sincronizar` until status reaches `revisao` or `publicado`
