# Prepara y arranca agents-service (agentes "Gemini + ERP" y "Groq + ERP", solo lectura) en desarrollo local.
# Cada agente se activa solo si su clave esta en agents-service/.env (GEMINI_API_KEY y/o GROQ_API_KEY).
#
# Uso (PowerShell, desde agents-service/):   .\scripts\start-local.ps1        (-NoStart solo prepara los .env)
#
# Que hace:
#  - Genera (una sola vez) el token interno y la clave de identidad, y los guarda en los .env (ignorados por git).
#    No muestra ningun secreto.
#  - Completa en el .env de la raiz las variables de Next.js que faltan. No pisa valores existentes
#    (no toca AI_SERVICE_URL: el Modelo R de ai-service es independiente).
#  - Desactiva AI_ASSISTANT_EVAL_ENABLED en ese .env (el modo evaluacion solo funciona en Vercel).
#  - Exige que agents-service/.env tenga DATABASE_URL_READONLY y al menos una clave (GEMINI_API_KEY o GROQ_API_KEY).
#  - Arranca agents-service en 127.0.0.1:8002.
# Texto solo ASCII: Windows PowerShell 5.1 lee los .ps1 sin BOM como ANSI.

param([switch]$NoStart)

$ErrorActionPreference = "Stop"
$serviceDir = Split-Path -Parent $PSScriptRoot
$rootDir = Split-Path -Parent $serviceDir
$rootEnv = Join-Path $rootDir ".env"
$serviceEnv = Join-Path $serviceDir ".env"
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Lines($path) {
    if (Test-Path $path) { return [System.IO.File]::ReadAllLines($path) }
    return @()
}

function Get-EnvValue($path, $name) {
    foreach ($line in (Read-Lines $path)) {
        if ($line -match "^\s*$name\s*=(.*)$") {
            $value = $Matches[1].Trim()
            if ($value.Length -ge 2 -and $value[0] -eq $value[$value.Length - 1] -and "`"'".Contains($value[0])) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            return $value
        }
    }
    return ""
}

# Fija NAME=valor: reemplaza la linea si existe (vacia o forzada) o la agrega al final.
function Set-EnvValue($path, $name, $value, [switch]$OnlyIfEmpty) {
    $lines = @(Read-Lines $path)
    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*$name\s*=(.*)$") {
            $found = $true
            if (-not $OnlyIfEmpty -or $Matches[1].Trim() -eq "") { $lines[$i] = "$name=$value" }
            break
        }
    }
    if (-not $found) { $lines += "$name=$value" }
    [System.IO.File]::WriteAllLines($path, $lines, $utf8)
}

function New-Secret { return (python -c "import secrets; print(secrets.token_hex(32))").Trim() }

# 1) Secretos compartidos con Next.js (se generan solo si faltan)
$token = Get-EnvValue $rootEnv "AGENTS_SERVICE_INTERNAL_TOKEN"
if ($token -notmatch "^[0-9a-fA-F]{64,}$") { $token = Get-EnvValue $serviceEnv "AGENTS_SERVICE_INTERNAL_TOKEN" }
if ($token -notmatch "^[0-9a-fA-F]{64,}$") { $token = New-Secret }
$identity = Get-EnvValue $serviceEnv "AI_ASSISTANT_IDENTITY_KEY"
if ($identity -notmatch "^[0-9a-fA-F]{64,}$") { $identity = Get-EnvValue $rootEnv "AI_ASSISTANT_IDENTITY_KEY" }
if ($identity -notmatch "^[0-9a-fA-F]{64,}$") { $identity = New-Secret }

# 2) .env de la raiz (Next.js)
if (-not (Test-Path $rootEnv)) { [System.IO.File]::WriteAllLines($rootEnv, @(), $utf8) }
Set-EnvValue $rootEnv "AI_ASSISTANT_DEMO" "1"
Set-EnvValue $rootEnv "AGENTS_SERVICE_URL" "http://127.0.0.1:8002"
Set-EnvValue $rootEnv "AGENTS_SERVICE_INTERNAL_TOKEN" $token
Set-EnvValue $rootEnv "AI_ASSISTANT_IDENTITY_KEY" $identity
if ((Get-EnvValue $rootEnv "AI_ASSISTANT_EVAL_ENABLED") -eq "1") {
    Set-EnvValue $rootEnv "AI_ASSISTANT_EVAL_ENABLED" ""
    Write-Host "Aviso: AI_ASSISTANT_EVAL_ENABLED estaba en 1 en el .env de la raiz; se dejo vacio (solo sirve en Vercel)."
}

# 3) agents-service/.env: lo que debe poner el usuario, el token y la clave de identidad
if (-not (Test-Path $serviceEnv)) { [System.IO.File]::WriteAllLines($serviceEnv, @(), $utf8) }
Set-EnvValue $serviceEnv "AGENTS_SERVICE_INTERNAL_TOKEN" $token
Set-EnvValue $serviceEnv "AI_ASSISTANT_IDENTITY_KEY" $identity
Set-EnvValue $serviceEnv "GEMINI_API_KEY" "" -OnlyIfEmpty
Set-EnvValue $serviceEnv "GROQ_API_KEY" "" -OnlyIfEmpty
Set-EnvValue $serviceEnv "DATABASE_URL_READONLY" "" -OnlyIfEmpty

$geminiOn = (Get-EnvValue $serviceEnv "GEMINI_API_KEY") -ne ""
$groqOn = (Get-EnvValue $serviceEnv "GROQ_API_KEY") -ne ""
$geminiFlag = if ($geminiOn) { "1" } else { "" }
$groqFlag = if ($groqOn) { "1" } else { "" }
Set-EnvValue $rootEnv "AI_GEMINI_SQL" $geminiFlag
Set-EnvValue $rootEnv "AI_GROQ_SQL" $groqFlag

$missing = @()
if (-not $geminiOn -and -not $groqOn) { $missing += "GEMINI_API_KEY o GROQ_API_KEY (al menos una)" }
if ((Get-EnvValue $serviceEnv "DATABASE_URL_READONLY") -eq "") { $missing += "DATABASE_URL_READONLY" }
if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "Falta completar en $serviceEnv :"
    foreach ($name in $missing) { Write-Host "  - $name" }
    Write-Host "Ponles su valor y vuelve a ejecutar este script. (No lo compartas ni lo subas a git.)"
    exit 1
}

if ($NoStart) { Write-Host "Listo (-NoStart): .env preparados, no se arranco el servicio."; exit 0 }

# 4) Entorno del proceso y arranque (solo escucha en local)
$env:AI_GEMINI_SQL = $geminiFlag
$env:AI_GROQ_SQL = $groqFlag
$env:AGENTS_SERVICE_HOST = "127.0.0.1"
$env:AGENTS_SERVICE_PORT = "8002"
$env:PYTHONPATH = "src"
Write-Host ("Agentes activos: " + $(if ($geminiOn) { "Gemini " } else { "" }) + $(if ($groqOn) { "Groq" } else { "" }))
Write-Host "Arrancando agents-service en http://127.0.0.1:8002 (Ctrl+C para detener)..."
Write-Host "Reinicia tambien 'npm run dev' para que Next.js lea el .env actualizado."
Set-Location $serviceDir
python -m agents_service.main
