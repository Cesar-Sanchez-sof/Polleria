import httpx, json
from pathlib import Path

env = {}
for line in open('agents-service/.env').read().splitlines():
    if '=' in line and not line.startswith('#'):
        k, _, v = line.partition('=')
        env[k.strip()] = v.strip()

reports_dir = Path('test/agents/sql/reports')
parts = []
for path in sorted(reports_dir.glob('report_*.md')):
    lines = path.read_text(encoding='utf-8', errors='replace').splitlines()
    header = '\n'.join(lines[:15])
    summaries = [l.strip() for l in lines if '<summary>' in l]
    parts.append(f'### {path.name}\n{header}\n\nSumarios:\n' + '\n'.join(summaries))
context = '\n\n'.join(parts)
print(f"Contexto: {len(context)} chars / ~{len(context)//4} tokens")

system = 'Eres experto en reportes Text-to-SQL. Reportes:\n\n' + context
questions = [
    "¿Cuál es el VES del TEST-033 en el reporte de chatgpt oss 120 b?",
    "¿En el reporte de chatgpt oss 120 b TEST-001 tiene EX=True o EX=False?",
    "¿Qué agente tiene mayor EX: chatgpt oss 120 b o gemini flash 3.5 lite?",
]

model = env['GEMINI_MODEL']
api_key = env['GEMINI_API_KEY']
url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

for q in questions:
    payload = {
        'system_instruction': {'parts': [{'text': system}]},
        'contents': [{'role': 'user', 'parts': [{'text': q}]}],
        'generationConfig': {'maxOutputTokens': 256, 'temperature': 0.0},
    }
    try:
        r = httpx.post(url, json=payload, timeout=60)
        data = r.json()
        if 'error' in data:
            print(f"Q: {q}\n  ERROR: {data['error']}\n")
        elif not data.get('candidates'):
            print(f"Q: {q}\n  SIN CANDIDATOS: {list(data.keys())}\n")
        else:
            text = data['candidates'][0]['content']['parts'][0]['text']
            print(f"Q: {q}\n  R: {text[:200]}\n")
    except Exception as e:
        print(f"Q: {q}\n  EXCEPCION: {type(e).__name__}: {e}\n")
