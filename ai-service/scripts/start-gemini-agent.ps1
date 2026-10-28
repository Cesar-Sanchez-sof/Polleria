# Prepara y arranca ai-service con los agentes "Gemini + ERP" y "Groq + ERP" (solo lectura) en desarrollo local.
# Cada agente se activa solo si su clave esta en ai-service/.env (GEMINI_API_KEY y/o GROQ_API_KEY).
#
# Uso (PowerShell, desde ai-service/):   .\scripts\start-gemini-agent.ps1
#
# Que hace:
#  - Genera (una sola vez) el token interno, la clave de identidad y la clave de auditoria, y los guarda en
#    los .env (ignorados por git). No muestra ningun secreto.
#  - Completa en el .env de la raiz las variables de Next.js que faltan. No pisa valores existentes.
#  - Desactiva AI_ASSISTANT_EVAL_ENABLED en ese .env (el modo evaluacion solo funciona en Vercel).
#  - Exige que ai-service/.env tenga DATABASE_URL_READONLY y al menos una clave (GEMINI_API_KEY o GROQ_API_KEY).
#  - Arranca ai-service en 127.0.0.1:8001.
# Texto solo ASCII: Windows PowerShell 5.1 lee los .ps1 sin BOM como ANSI.

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

# 1) Secretos compartidos (se generan solo si faltan; el token vive en el .env de la raiz)
$token = Get-EnvValue $rootEnv "AI_SERVICE_INTERNAL_TOKEN"
if ($token -notmatch "^[0-9a-fA-F]{64,}$") { $token = New-Secret }
$identity = Get-EnvValue $serviceEnv "AI_ASSISTANT_IDENTITY_KEY"
if ($identity -notmatch "^[0-9a-fA-F]{64,}$") { $identity = Get-EnvValue $rootEnv "AI_ASSISTANT_IDENTITY_KEY" }
if ($identity -notmatch "^[0-9a-fA-F]{64,}$") { $identity = New-Secret }
$audit = Get-EnvValue $serviceEnv "AI_ASSISTANT_AUDIT_HMAC_KEY"
if ($audit -notmatch "^[0-9a-fA-F]{64,}$") { $audit = New-Secret }

# 2) .env de la raiz (Next.js)
if (-not (Test-Path $rootEnv)) { [System.IO.File]::WriteAllLines($rootEnv, @(), $utf8) }
Set-EnvValue $rootEnv "AI_ASSISTANT_DEMO" "1"
Set-EnvValue $rootEnv "AI_SERVICE_URL" "http://127.0.0.1:8001"
Set-EnvValue $rootEnv "AI_SERVICE_INTERNAL_TOKEN" $token
Set-EnvValue $rootEnv "AI_ASSISTANT_IDENTITY_KEY" $identity
if ((Get-EnvValue $rootEnv "AI_ASSISTANT_EVAL_ENABLED") -eq "1") {
    Set-EnvValue $rootEnv "AI_ASSISTANT_EVAL_ENABLED" ""
    Write-Host "Aviso: AI_ASSISTANT_EVAL_ENABLED estaba en 1 en el .env de la raiz; se dejo vacio (solo sirve en Vercel)."
}

# 3) ai-service/.env: lo que debe poner el usuario y la clave de identidad
if (-not (Test-Path $serviceEnv)) { [System.IO.File]::WriteAllLines($serviceEnv, @(), $utf8) }
Set-EnvValue $serviceEnv "AI_ASSISTANT_IDENTITY_KEY" $identity
Set-EnvValue $serviceEnv "AI_ASSISTANT_AUDIT_HMAC_KEY" $audit
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

# 4) Entorno del proceso (el token y la clave de auditoria solo se leen del entorno) y arranque
$env:AI_SERVICE_ENV = "development"
$env:AI_SERVICE_INTERNAL_TOKEN = $token
$env:AI_ASSISTANT_AUDIT_HMAC_KEY = $audit
$env:AI_GEMINI_SQL = $geminiFlag
$env:AI_GROQ_SQL = $groqFlag
$env:PYTHONPATH = "src"
Write-Host ("Agentes activos: " + $(if ($geminiOn) { "Gemini " } else { "" }) + $(if ($groqOn) { "Groq" } else { "" }))
Write-Host "Arrancando ai-service en http://127.0.0.1:8001 (Ctrl+C para detener)..."
Write-Host "Reinicia tambien 'npm run dev' para que Next.js lea el .env actualizado."
Set-Location $serviceDir
python -m ai_service.main
