$ErrorActionPreference = "Stop"

$repoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$branch = "main"
$logDir = Join-Path $env:LOCALAPPDATA "Menuz"
$logFile = Join-Path $logDir "auto-commit.log"

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Write-Log([string]$message) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $message
  Add-Content -Path $logFile -Value $line
}

try {
  Set-Location $repoPath

  git rev-parse --is-inside-work-tree *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Nao e um repositorio Git: $repoPath"
  }

  git fetch origin $branch --quiet

  git add -A
  git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Log "Sem alteracoes para commit."
    exit 0
  }

  $message = "chore(auto): backup " + (Get-Date -Format "yyyy-MM-dd HH:mm")
  git commit -m $message --quiet
  git pull --rebase origin $branch --autostash --quiet
  git push origin $branch --quiet

  Write-Log "Backup enviado para origin/$branch."
}
catch {
  Write-Log ("ERRO: " + $_.Exception.Message)
  exit 1
}
