# dev-start.ps1 - instala dependencias y levanta Next dev en Windows
param(
  [switch]$ForceInstall
)

Write-Host "== Dev start helper =="

function HasCmd($name) {
  return (Get-Command $name -ErrorAction SilentlyContinue) -ne $null
}

if (HasCmd pnpm) { $pm = 'pnpm' }
elseif (HasCmd npm) { $pm = 'npm' }
elseif (HasCmd yarn) { $pm = 'yarn' }
else {
  Write-Host "No se encontró pnpm/npm/yarn en PATH. Instala Node.js y pnpm/npm antes." -ForegroundColor Red
  exit 1
}

Write-Host "Usando gestor: $pm"

if ($ForceInstall -or -not (Test-Path node_modules)) {
  Write-Host "Instalando dependencias..."
  & $pm install
}

if (Test-Path .next) {
  Write-Host "Limpiando cache .next..."
  Remove-Item -Recurse -Force .next
}

Write-Host "Iniciando servidor de desarrollo..."
& $pm run dev
