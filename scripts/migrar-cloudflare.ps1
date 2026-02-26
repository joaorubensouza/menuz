param(
  [string]$TunnelName = "menuz-prod",
  [string]$Hostname = "menuz.omniaprod.pt",
  [string]$LocalUrl = "http://localhost:5170",
  [string]$WorkerName = "menuz-cloud-0910",
  [string]$OriginHost = "menuz.omniaprod.pt"
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Comando '$Name' nao encontrado no PATH."
  }
}

function Invoke-CmdLine([string]$CommandLine) {
  return cmd.exe /d /c $CommandLine
}

function Get-TunnelByName([string]$Name) {
  $rawOutput = Invoke-CmdLine "cloudflared tunnel list --output json 2>nul"
  if (-not $rawOutput) {
    return $null
  }
  $rawText = ($rawOutput | Out-String)
  $jsonStart = $rawText.IndexOf("[")
  $jsonEnd = $rawText.LastIndexOf("]")
  if ($jsonStart -lt 0 -or $jsonEnd -lt 0 -or $jsonEnd -le $jsonStart) {
    return $null
  }
  $jsonText = $rawText.Substring($jsonStart, $jsonEnd - $jsonStart + 1)
  $tunnels = $jsonText | ConvertFrom-Json
  return $tunnels | Where-Object { $_.name -eq $Name } | Select-Object -First 1
}

function Ensure-Tunnel([string]$Name) {
  $existing = Get-TunnelByName -Name $Name
  if ($existing) {
    Write-Host "Tunnel encontrado: $Name ($($existing.id))"
    return $existing.id
  }

  Write-Host "Criando tunnel: $Name"
  $createOutput = Invoke-CmdLine "cloudflared tunnel create $Name 2>&1"
  $text = ($createOutput | Out-String)
  $regex = [regex]"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"
  $match = $regex.Match($text)
  if (-not $match.Success) {
    throw "Nao foi possivel obter o ID do tunnel criado. Saida: $text"
  }
  return $match.Value.ToLower()
}

Require-Command "cloudflared"
Require-Command "npx"

$cloudflaredDir = Join-Path $env:USERPROFILE ".cloudflared"
$certPath = Join-Path $cloudflaredDir "cert.pem"
if (-not (Test-Path $certPath)) {
  throw "Login Cloudflare nao encontrado. Rode antes: cloudflared tunnel login"
}

$tunnelId = Ensure-Tunnel -Name $TunnelName
$credPath = Join-Path $cloudflaredDir "$tunnelId.json"
if (-not (Test-Path $credPath)) {
  throw "Arquivo de credencial do tunnel nao encontrado em: $credPath"
}

Write-Host "Configurando DNS: $Hostname"
Invoke-CmdLine "cloudflared tunnel route dns $TunnelName $Hostname 2>&1" | Out-Null

$configPath = Join-Path $cloudflaredDir "config.yml"
$configBody = @"
tunnel: $tunnelId
credentials-file: $credPath

ingress:
  - hostname: $Hostname
    service: $LocalUrl
  - service: http_status:404
"@
$configBody | Set-Content -Path $configPath -Encoding UTF8
Write-Host "config.yml atualizado em: $configPath"

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
  Write-Host "Publicando Worker proxy: $WorkerName"
  npx wrangler deploy workers/menuz-proxy.js --name $WorkerName --compatibility-date 2026-02-25 --var "ORIGIN_HOST:$OriginHost"
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "Migracao concluida."
Write-Host "Tunnel ID: $tunnelId"
Write-Host "Hostname: https://$Hostname"
Write-Host "Worker:   ver URL exibida pelo wrangler no deploy acima"
Write-Host ""
Write-Host "Para manter online neste PC:"
Write-Host "1) npm start"
Write-Host "2) cloudflared tunnel run $TunnelName"
