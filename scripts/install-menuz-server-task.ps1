$taskName = "MenuzServer"
$scriptPath = "C:\Users\joaor\Desktop\Menuz\scripts\start-menuz-server.cmd"

if (-not (Test-Path $scriptPath)) {
  Write-Error "Script nao encontrado: $scriptPath"
  exit 1
}

try {
  schtasks /Delete /TN $taskName /F | Out-Null
} catch {
  # ignore
}

$createCmd = @(
  "/Create",
  "/TN", $taskName,
  "/SC", "ONSTART",
  "/RL", "HIGHEST",
  "/TR", "`"$scriptPath`""
)

schtasks @createCmd | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error "Falha ao criar tarefa $taskName."
  exit 1
}

Write-Output "Tarefa criada: $taskName"
Write-Output "Para iniciar agora: schtasks /Run /TN $taskName"
