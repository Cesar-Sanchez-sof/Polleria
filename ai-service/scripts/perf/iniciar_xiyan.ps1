# Arranca el servicio de inferencia XiYanSQL + QLoRA v1.7 en WSL (:8011), como guia_demostracion.md §1, con los
# indicadores de rendimiento del servidor (por defecto, todos desactivados = comportamiento previo).
#
#   powershell -ExecutionPolicy Bypass -File scripts\perf\iniciar_xiyan.ps1                       # base
#   powershell -ExecutionPolicy Bypass -File scripts\perf\iniciar_xiyan.ps1 -Warmup -QueueWait 10 # optimizado
#   powershell -ExecutionPolicy Bypass -File scripts\perf\iniciar_xiyan.ps1 -Warmup -QueueWait 10 -PromptLookup 10
#
# Genera un token nuevo de 32 bytes (no se muestra), lo pasa a WSL por WSLENV y lo deja en %TEMP% para ai-service.
param(
    [ValidateRange(0, 20)][int]$PromptLookup = 0,
    [switch]$Warmup,
    [ValidateRange(0, 30)][int]$QueueWait = 0
)
$ErrorActionPreference = 'Stop'
$b = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
$env:XIYAN_SERVER_TOKEN = ($b | ForEach-Object { $_.ToString('x2') }) -join ''
$env:XIYAN_PROMPT_LOOKUP = "$PromptLookup"
$env:XIYAN_WARMUP = if ($Warmup) { '1' } else { '0' }
$env:XIYAN_QUEUE_WAIT_S = "$QueueWait"
$env:WSLENV = 'XIYAN_SERVER_TOKEN:XIYAN_PROMPT_LOOKUP:XIYAN_WARMUP:XIYAN_QUEUE_WAIT_S'
Set-Content -Path (Join-Path $env:TEMP 'erp_sqlgen_token.txt') -Value $env:XIYAN_SERVER_TOKEN -NoNewline
Write-Host "[MODEL] XiYanSQL: prompt_lookup=$PromptLookup warmup=$($env:XIYAN_WARMUP) espera_cola=$QueueWait s (token nuevo, no mostrado)"

wsl --cd "/mnt/d/Study/Taller Integrador I/ERP_with_LoRA/ai-service" -e bash -c '
  export XIYAN_SERVER_ENV=development
  export XIYAN_ADAPTER_ID=xiyansql_v17_json_v10_balanced_full
  export XIYAN_ADAPTER_DIR=/home/ronaldo/proyectos/modeloQLoRA/outputs/adapters/xiyansql_v17_json_v10_balanced_full
  export HF_HUB_CACHE=/home/ronaldo/modelos/huggingface-hub
  export PYTHONPATH=src:.
  exec /home/ronaldo/proyectos/modeloQLoRA/venvQLoRA/bin/python -m inference_server.main'
