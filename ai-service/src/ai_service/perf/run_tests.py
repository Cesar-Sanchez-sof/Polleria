"""Pruebas automatizadas de los componentes optimizados, con resumen ``[TEST]`` por archivo.

Uso (desde ``ai-service/``)::

    .venv\\Scripts\\python.exe -m ai_service.perf.run_tests          # con PYTHONPATH=src;.

Ejecuta pytest solo sobre los archivos relacionados con las optimizaciones y la seguridad (sin red, sin
modelos y sin base de datos: las barreras de ``tests/guards.py`` bloquean cualquier conexión). No oculta
fallos: el código de salida es el de pytest y cada fallo se lista con su nombre.
"""

from __future__ import annotations

import sys
import time
from collections import defaultdict
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[3]
TEST_FILES = (
    "test_perf_optimizations.py",  # indicadores, RAG en paralelo, pool, cachés, budget, [MODEL]
    "test_perf_security.py",  # seguridad con todas las optimizaciones activas
    "test_postgres_executor.py",  # Executor de solo lectura
    "test_validator.py",  # validador AST
    "test_pipeline_security.py",  # incidentes y datos sensibles
    "test_isolation_guards.py",  # barreras de red y variables protegidas
    "test_free_route.py",  # ruta ampliada
    "test_query_families.py",  # ruta entrenada (familias)
    "test_openai_provider.py",  # proveedor OpenAI
    "test_sqlgen_client.py",  # cliente XiYanSQL
    "test_inference_server.py",  # servidor de inferencia
    "test_retrieval.py",  # RAG
    "test_budget.py",  # presupuesto
    "test_diagnostics.py",  # traza técnica
    "test_http_api.py",  # API HTTP
)


class _Summary:
    def __init__(self) -> None:
        self.counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.failures: list[str] = []

    def pytest_runtest_logreport(self, report) -> None:  # noqa: ANN001 - hook de pytest
        name = Path(report.nodeid.split("::")[0]).name
        if getattr(report, "context", None) is not None:  # subtest: solo cuentan sus fallos
            if report.failed:
                self.counts[name]["failed"] += 1
                self.failures.append(report.nodeid)
            return
        if report.when == "call" or (report.when == "setup" and report.outcome != "passed"):
            self.counts[name][report.outcome] += 1
            if report.failed:
                self.failures.append(report.nodeid)


def main() -> int:
    import pytest

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    tests_dir = SERVICE_ROOT / "tests"
    for path in (str(SERVICE_ROOT / "src"), str(SERVICE_ROOT), str(tests_dir)):
        if path not in sys.path:
            sys.path.insert(0, path)
    files = [str(tests_dir / name) for name in TEST_FILES]
    summary = _Summary()
    print(f"[TEST] Ejecutando {len(files)} archivos de prueba relacionados (sin red, sin modelos, sin base de datos)")
    started = time.perf_counter()
    code = pytest.main(["-q", "-p", "no:warnings", "-p", "no:cacheprovider", *files], plugins=[summary])
    seconds = time.perf_counter() - started
    total_passed = total_failed = 0
    print()
    for name in TEST_FILES:
        counts = summary.counts.get(name, {})
        passed, failed = counts.get("passed", 0), counts.get("failed", 0)
        skipped = counts.get("skipped", 0)
        total_passed, total_failed = total_passed + passed, total_failed + failed
        status = "OK   " if failed == 0 and passed > 0 else "FALLO"
        print(f"[TEST] {status} {name:<30} {passed:>4} superadas  {failed:>3} fallidas" + (f"  {skipped} omitidas" if skipped else ""))
    for failure in summary.failures:
        print(f"[TEST] FALLÓ: {failure}")
    print(f"[TEST] Total: {total_passed} superadas, {total_failed} fallidas en {seconds:.1f} s (código pytest {int(code)})")
    return int(code)


if __name__ == "__main__":
    raise SystemExit(main())
