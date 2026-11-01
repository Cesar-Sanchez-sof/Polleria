# Arranca ai-service (Windows, :8002) con el perfil de evaluación del runbook (guia_demostracion.md §2) y las
# optimizaciones de rendimiento DESACTIVADAS (-Modo base) o ACTIVADAS (-Modo optimizado).
#
#   powershell -ExecutionPolicy Bypass -File scripts\perf\iniciar_ai_service.ps1 -Modo base -UsuarioEvaluador <id>
#   powershell -ExecutionPolicy Bypass -File scripts\perf\iniciar_ai_service.ps1 -Modo optimizado -UsuarioEvaluador <id>
#   ... -Modo optimizado -Cache                 # además, cachés deterministas (medición aparte)
#   ... -Modo optimizado -ExplainEffort low     # si el modelo no admite 'minimal'
#
# Credenciales: AI_SERVICE_INTERNAL_TOKEN y AI_ASSISTANT_AUDIT_HMAC_KEY de ai-service\.env; AI_ASSISTANT_IDENTITY_KEY
# del .env.local de la raíz (la que firma el proxy del ERP y usa el benchmark). Se copian al entorno de ESTE proceso
# sin mostrarse. El resto (OPENAI_*, DATABASE_URL_READONLY, ZILLIZ_*, AI_RAG_*) lo lee el servicio de ai-service\.env.
param(
    [Parameter(Mandatory = $true)][ValidateSet('base', 'optimizado')][string]$Modo,
    [Parameter(Mandatory = $true)][int]$UsuarioEvaluador,
    [switch]$Cache,
    [ValidateSet('minimal', 'low', 'medium', 'high')][string]$ExplainEffort = 'minimal',
    [switch]$SoloVerificar
)
$ErrorActionPreference = 'Stop'
$servicio = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$raiz = Split-Path -Parent $servicio
Set-Location $servicio

function Copiar-Claves([string]$archivo, [string[]]$nombres) {
    if (-not (Test-Path $archivo)) { throw "No existe $archivo" }
    foreach ($linea in Get-Content $archivo) {
        foreach ($nombre in $nombres) {
            if ($linea -match "^\s*$nombre\s*=\s*(.+?)\s*$") {
                [Environment]::SetEnvironmentVariable($nombre, $Matches[1].Trim('"', "'"), 'Process')
            }
        }
    }
}
Copiar-Claves (Join-Path $servicio '.env') @('AI_SERVICE_INTERNAL_TOKEN', 'AI_ASSISTANT_AUDIT_HMAC_KEY')
Copiar-Claves (Join-Path $raiz '.env.local') @('AI_ASSISTANT_IDENTITY_KEY')
$tokenFile = Join-Path $env:TEMP 'erp_sqlgen_token.txt'
if (Test-Path $tokenFile) {
    $env:AI_SQLGEN_TOKEN = Get-Content $tokenFile
} elseif ($SoloVerificar) {
    $env:AI_SQLGEN_TOKEN = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })  # solo para validar
} else {
    throw "Falta ${tokenFile}: arranca primero el servicio XiYanSQL (iniciar_xiyan.ps1)."
}

$env:PYTHONPATH = 'src'
$env:AI_SERVICE_ENV = 'development'
$env:AI_SERVICE_PORT = '8002'
$env:AI_SERVICE_EVAL_MODE = '1'
$env:AI_SERVICE_EVAL_REAL_DATA = '1'
$env:AI_SERVICE_EVAL_ALLOWED_USER_IDS = "$UsuarioEvaluador"
$env:AI_SERVICE_DIAGNOSTICS = '1'
$env:AI_SQL_GENERATOR = 'xiyansql'
$env:AI_SQLGEN_URL = 'http://127.0.0.1:8011'
$env:AI_SQLGEN_ADAPTER = 'xiyansql_v17_json_v10_balanced_full'
$env:AI_SQL_EXECUTOR = 'postgres_readonly'
$env:AI_LLM_PROVIDER = 'openai'
$env:AI_SQLGEN_TIMEOUT_S = '15'
$env:AI_LLM_TIMEOUT_S = '15'
$env:AI_LLM_REASONING_EFFORT = 'low'
$env:AI_LLM_PRICE_INPUT_PER_1K_USD = '0.00011'
$env:AI_LLM_PRICE_OUTPUT_PER_1K_USD = '0.00055'
$env:AI_LLM_MAX_COST_PER_REQUEST_USD = '0.005'
$env:AI_LLM_MONTHLY_LIMIT_USD = '2.00'
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue   # el servicio exige una conexión de solo lectura distinta

# Registros [PERF]/[OPT] en ambos modos (para medir también la línea base).
$env:AI_PERF_CONSOLE = '1'
if ($Modo -eq 'optimizado') {
    $env:AI_PERF_OPT = '1'
    $env:AI_LLM_EXPLAIN_REASONING_EFFORT = $ExplainEffort
} else {
    $env:AI_PERF_OPT = '0'
    Remove-Item Env:AI_LLM_EXPLAIN_REASONING_EFFORT -ErrorAction SilentlyContinue  # explicar = 'low', como antes
}
$env:AI_PERF_CACHE = if ($Cache) { '1' } else { '0' }

Write-Host "[OPT] ai-service modo=$Modo cache=$($env:AI_PERF_CACHE) explicar=$(if ($Modo -eq 'optimizado') { $ExplainEffort } else { 'low (igual que interpretar)' }) usuario evaluador=$UsuarioEvaluador"
Write-Host "[OPT] credenciales copiadas al proceso (valores no mostrados): token interno y HMAC de ai-service\.env; identidad de .env.local"
if ($SoloVerificar) {
    .venv\Scripts\python.exe -c "import os; from pathlib import Path; from ai_service.config.settings import load_service_settings; s = load_service_settings(os.environ, dotenv_path=Path('.env')); print('[OPT] configuración válida: perf_opt=%s perf_cache=%s perf_console=%s explicar=%s' % (s.perf_opt, s.perf_cache, s.perf_console, s.llm.explain_reasoning_effort))"
    exit $LASTEXITCODE
}
.venv\Scripts\python.exe -m ai_service.main
