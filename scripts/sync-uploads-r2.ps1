param(
  [string]$Bucket = "menuz-uploads",
  [string]$UploadsDir = ".\\uploads"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  throw "npx nao encontrado no PATH."
}

$fullUploadsPath = (Resolve-Path $UploadsDir).Path
$files = Get-ChildItem -Path $fullUploadsPath -Recurse -File

if (-not $files.Count) {
  Write-Host "Nenhum arquivo para enviar em $fullUploadsPath"
  exit 0
}

$total = $files.Count
$index = 0

foreach ($file in $files) {
  $index += 1
  $relative = $file.FullName.Substring($fullUploadsPath.Length + 1).Replace("\", "/")
  $target = "$Bucket/$relative"
  Write-Host "[$index/$total] $target"
  npx wrangler r2 object put $target --file "$($file.FullName)" | Out-Null
}

Write-Host "Upload concluido: $total arquivos enviados para $Bucket."
