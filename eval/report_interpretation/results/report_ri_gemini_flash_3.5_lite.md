# Reporte — Interpretación de Reportes

| Agente | Casos | Accuracy | Correctas | Incorrectas | Sin gold |
|---|---:|---:|---:|---:|---:|
| gemini flash 3.5 lite | 30 | 20.00% | 6 | 24 | 0 |

## Por categoría

| Categoría | Total | Correctas | Accuracy |
|---|---:|---:|---:|
| lectura_cabecera | 8 | 4 | 50% |
| casos_fallidos | 7 | 2 | 29% |
| detalle_caso | 4 | 0 | 0% |
| comparativa | 5 | 0 | 0% |
| comprension_metrica | 6 | 0 | 0% |

## Detalle de casos

<details><summary>RI-001 [facil] ❌ — lectura_cabecera</summary>

**Pregunta:** ¿Cuántos casos en total evaluó el agente chatgpt oss 120 b?

**Gold:** `302`

**Respuesta:**
```
El agente chatgpt oss 120 b evaluó un total de 342 casos.
```

**Resultado:** `esperado '302'` — 5.406s

</details>

<details><summary>RI-002 [facil] ✅ — lectura_cabecera</summary>

**Pregunta:** ¿Cuál es el Execution Accuracy (EX) del agente gemini flash 3.5 lite?

**Gold:** `97.43%`

**Respuesta:**
```
97.43%
```

**Resultado:** `ok` — 1.875s

</details>

<details><summary>RI-003 [facil] ✅ — lectura_cabecera</summary>

**Pregunta:** ¿Cuántos errores de ejecución tuvo el agente gemini flash 3.5 lite?

**Gold:** `0`

**Respuesta:**
```
0
```

**Resultado:** `ok` — 2.141s

</details>

<details><summary>RI-004 [facil] ❌ — lectura_cabecera</summary>

**Pregunta:** ¿Cuántas consultas incorrectas tuvo el agente chatgpt oss 120 b?

**Gold:** `13`

**Respuesta:**
```
El agente chatgpt oss 120 b tuvo 17 consultas incorrectas.
```

**Resultado:** `esperado '13'` — 1.968s

</details>

<details><summary>RI-005 [facil] ❌ — lectura_cabecera</summary>

**Pregunta:** ¿Cuál es el VES del agente chatgpt oss 120 b?

**Gold:** `0.9304`

**Respuesta:**
```
El VES del agente chatgpt oss 120 b es 0.9018.
```

**Resultado:** `esperado '0.9304'` — 1.344s

</details>

<details><summary>RI-006 [facil] ❌ — lectura_cabecera</summary>

**Pregunta:** ¿Cuántas consultas ejecutó correctamente (sin error) el agente chatgpt oss 120 b?

**Gold:** `300`

**Respuesta:**
```
El agente chatgpt oss 120 b ejecutó correctamente (sin error) 315 consultas.
```

**Resultado:** `esperado '300'` — 2.0s

</details>

<details><summary>RI-007 [facil] ✅ — lectura_cabecera</summary>

**Pregunta:** ¿Cuántas consultas correctas obtuvo el agente gemini flash 3.5 lite?

**Gold:** `341`

**Respuesta:**
```
El agente gemini flash 3.5 lite obtuvo 341 consultas correctas.
```

**Resultado:** `ok` — 1.984s

</details>

<details><summary>RI-008 [facil] ✅ — lectura_cabecera</summary>

**Pregunta:** ¿Cuántas consultas incorrectas tuvo el agente gemini flash 3.5 lite?

**Gold:** `9`

**Respuesta:**
```
El agente gemini flash 3.5 lite tuvo 9 consultas incorrectas.
```

**Resultado:** `ok` — 1.907s

</details>

<details><summary>RI-009 [medio] ❌ — casos_fallidos</summary>

**Pregunta:** Lista todos los IDs de test que tienen EX=False en el reporte de chatgpt oss 120 b.

**Gold:** `["TEST-033", "TEST-067", "TEST-088", "TEST-113", "TEST-148", "TEST-156", "TEST-173", "TEST-183", "TEST-191", "TEST-218", "TEST-224", "TEST-226", "TEST-253", "TEST-261"]`

**Respuesta:**
```
TEST-033, TEST-067, TEST-113, TEST-148, TEST-156, TEST-173, TEST-183, TEST-191, TEST-218, TEST-226, TEST-253, TEST-261, TEST-288, TEST-294, TEST-296, TEST-313, TEST-320, TEST-323, TEST-329, TEST-331, TEST-336, TEST-337, TEST-338, TEST-339, TEST-340, TEST-341, TEST-342
```

**Resultado:** `faltan: ['TEST-088', 'TEST-224']` — 2.281s

</details>

<details><summary>RI-010 [medio] ❌ — casos_fallidos</summary>

**Pregunta:** Lista todos los IDs de test que tienen EX=False en el reporte de gemini flash 3.5 lite.

**Gold:** `["TEST-043", "TEST-056", "TEST-091", "TEST-176", "TEST-183", "TEST-246", "TEST-277", "TEST-281", "TEST-320"]`

**Respuesta:**
```
TEST-043, TEST-056, TEST-091, TEST-176, TEST-246, TEST-277, TEST-281, TEST-320
```

**Resultado:** `faltan: ['TEST-183']` — 1.703s

</details>

<details><summary>RI-011 [medio] ❌ — casos_fallidos</summary>

**Pregunta:** ¿Cuántos tests tienen EX=False en el reporte de chatgpt oss 120 b?

**Gold:** `14`

**Respuesta:**
```
27
```

**Resultado:** `esperado '14'` — 2.125s

</details>

<details><summary>RI-012 [medio] ✅ — casos_fallidos</summary>

**Pregunta:** ¿Cuántos tests tienen EX=False en el reporte de gemini flash 3.5 lite?

**Gold:** `9`

**Respuesta:**
```
En el reporte de **gemini flash 3.5 lite**, hay **9** tests con `EX=False`. Estos corresponden a los casos:
TEST-043, TEST-056, TEST-091, TEST-176, TEST-246, TEST-277, TEST-281, TEST-320
```

**Resultado:** `ok` — 2.344s

</details>

<details><summary>RI-013 [medio] ✅ — casos_fallidos</summary>

**Pregunta:** ¿Hay algún test con EX=False que sea común a ambos agentes? Lista los IDs.

**Gold:** `["TEST-183"]`

**Respuesta:**
```
TEST-183, TEST-320
```

**Resultado:** `ok` — 2.297s

</details>

<details><summary>RI-014 [medio] ❌ — detalle_caso</summary>

**Pregunta:** ¿Cuál es el VES del TEST-033 en el reporte de chatgpt oss 120 b?

**Gold:** `0.0`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-015 [medio] ❌ — detalle_caso</summary>

**Pregunta:** En el reporte de chatgpt oss 120 b, ¿TEST-001 tiene EX=True o EX=False?

**Gold:** `EX=True`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-016 [medio] ❌ — detalle_caso</summary>

**Pregunta:** En el reporte de gemini flash 3.5 lite, ¿TEST-001 tiene EM=OK o EM=X?

**Gold:** `EM=X`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-017 [medio] ❌ — comparativa</summary>

**Pregunta:** ¿Qué agente tiene mayor EX: chatgpt oss 120 b o gemini flash 3.5 lite?

**Gold:** `gemini flash 3.5 lite`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-018 [medio] ❌ — comparativa</summary>

**Pregunta:** ¿Qué agente tiene mayor VES: chatgpt oss 120 b o gemini flash 3.5 lite?

**Gold:** `gemini flash 3.5 lite`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-019 [medio] ❌ — comparativa</summary>

**Pregunta:** ¿Cuántos casos más evalúa gemini flash 3.5 lite respecto a chatgpt oss 120 b?

**Gold:** `48`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-020 [medio] ❌ — comparativa</summary>

**Pregunta:** ¿Cuál agente tuvo errores de ejecución y cuántos?

**Gold:** `chatgpt oss 120 b con 2 errores. gemini flash 3.5 lite con 0 errores.`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-021 [dificil] ❌ — comprension_metrica</summary>

**Pregunta:** ¿Por qué un test puede tener EX=True aunque el alias de la columna en el SQL generado sea diferente al gold?

**Gold:** `Porque la métrica EX ignora los alias de columnas y el orden de filas; solo compara los valores retornados por la consulta.`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-022 [dificil] ❌ — comprension_metrica</summary>

**Pregunta:** ¿Qué significa que un test tenga VES=0.0?

**Gold:** `Que el test fue incorrecto o tuvo error de ejecución, por lo que no aporta al puntaje de eficiencia.`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-023 [dificil] ❌ — comprension_metrica</summary>

**Pregunta:** ¿Qué fórmula se usa para calcular el EX en el reporte de chatgpt oss 120 b?

**Gold:** `Correctas / Casos = 287 / 302 = 95.03%`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-024 [dificil] ❌ — comprension_metrica</summary>

**Pregunta:** ¿Qué significa EM=X en el reporte de gemini flash 3.5 lite?

**Gold:** `Que el SQL generado no es lexicamente identico al SQL gold (Exact Match falló), aunque puede que el resultado de ejecución sea correcto.`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-025 [dificil] ❌ — comprension_metrica</summary>

**Pregunta:** ¿Cuántas consultas ejecutó en total el agente gemini flash 3.5 lite y qué porcentaje representa del total de casos?

**Gold:** `350 consultas ejecutadas, que representan el 100% de los 350 casos.`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-026 [dificil] ❌ — detalle_caso</summary>

**Pregunta:** En el reporte de chatgpt oss 120 b, ¿cuántos tests tienen EX=True y VES mayor a 0.95?

**Gold:** `None`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-027 [dificil] ❌ — casos_fallidos</summary>

**Pregunta:** ¿Cuáles son los tests con EX=False exclusivos del agente chatgpt oss 120 b (no presentes en gemini flash 3.5 lite)?

**Gold:** `["TEST-033", "TEST-067", "TEST-088", "TEST-113", "TEST-148", "TEST-156", "TEST-173", "TEST-191", "TEST-218", "TEST-224", "TEST-226", "TEST-253", "TEST-261"]`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-028 [dificil] ❌ — casos_fallidos</summary>

**Pregunta:** ¿Cuáles son los tests con EX=False exclusivos del agente gemini flash 3.5 lite (no presentes en chatgpt oss 120 b)?

**Gold:** `["TEST-043", "TEST-056", "TEST-091", "TEST-176", "TEST-246", "TEST-277", "TEST-281", "TEST-320"]`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-029 [dificil] ❌ — comparativa</summary>

**Pregunta:** ¿Cuál agente falla en más casos en términos absolutos: chatgpt oss 120 b o gemini flash 3.5 lite? ¿Y en términos relativos (% sobre total de casos)?

**Gold:** `En términos absolutos: chatgpt oss 120 b (14 casos EX=False vs 9 de gemini). En términos relativos: chatgpt oss 120 b (14/302 = 4.64%) vs gemini flash 3.5 lite (9/350 = 2.57%). chatgpt oss 120 b falla más en ambas métricas.`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>

<details><summary>RI-030 [dificil] ❌ — comprension_metrica</summary>

**Pregunta:** Si el agente gemini flash 3.5 lite no tiene errores de ejecución, ¿cómo se explica que tenga 9 incorrectos?

**Gold:** `Los incorrectos son consultas que se ejecutaron sin error en PostgreSQL pero cuyos datos retornados difieren del resultado del SQL gold. Que no haya errores de ejecución no garantiza que el resultado sea correcto.`

**Respuesta:**
```
ERROR: Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
```

**Resultado:** `Client error '429 Too Many Requests' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=AIzaSyC8avnz2989_rke0KwVlB-Sy7YOyUI1FSs'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429` — 0.0s

</details>
