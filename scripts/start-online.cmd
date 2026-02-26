@echo off
cd /d C:\Users\joaor\Desktop\Menuz

rem inicia servidor Menuz
start "Menuz Server" cmd /c "cd /d C:\Users\joaor\Desktop\Menuz && npm start"

rem inicia named tunnel Cloudflare (hostname fixo)
start "Menuz Tunnel" cmd /c "cloudflared tunnel run menuz-prod >> C:\Users\joaor\Desktop\Menuz\cloudflared-named.log 2>&1"
