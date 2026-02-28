param(
  [string]$D1Name = "omniaprod",
  [string]$R2Bucket = "menuz-uploads",
  [string]$WorkerName = "menuz-cloud-0910"
)

$ErrorActionPreference = "Stop"

function Require-Cmd([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Comando '$name' nao encontrado no PATH."
  }
}

Require-Cmd "npx"
Require-Cmd "node"

function Invoke-CmdLine([string]$commandLine) {
  return cmd.exe /d /c $commandLine
}

Write-Host "1) Gerando seed SQL do db.json..."
node .\scripts\export-db-sql.mjs

Write-Host "2) Aplicando schema no D1 ($D1Name)..."
Invoke-CmdLine "npx wrangler d1 execute $D1Name --remote --file=cloudflare/schema.sql"

Write-Host "3) Aplicando seed no D1 ($D1Name)..."
Invoke-CmdLine "npx wrangler d1 execute $D1Name --remote --file=cloudflare/seed.sql"

Write-Host "4) Validando R2..."
$r2CheckOutput = Invoke-CmdLine "npx wrangler r2 bucket list 2>&1"
if ($LASTEXITCODE -ne 0) {
  $joined = ($r2CheckOutput | Out-String)
  if ($joined -match "code: 10042") {
    throw "R2 ainda nao esta habilitado nesta conta Cloudflare. Abra Dashboard > R2 > Enable e rode novamente."
  }
  throw "Falha ao consultar R2: $joined"
}

if (-not ($r2CheckOutput -match $R2Bucket)) {
  Write-Host "Criando bucket R2 '$R2Bucket'..."
  Invoke-CmdLine "npx wrangler r2 bucket create $R2Bucket"
}

Write-Host "5) Enviando uploads locais para R2..."
powershell -ExecutionPolicy Bypass -File .\scripts\sync-uploads-r2.ps1 -Bucket $R2Bucket -UploadsDir .\uploads

Write-Host "6) Deploy Worker cloud-native..."
Invoke-CmdLine "npx wrangler deploy --name $WorkerName"

Write-Host ""
Write-Host "Migracao cloud-native concluida."
