// Keep the Node.js entry point on the canonical Python generator to avoid divergent suites.
const { spawnSync } = require('child_process');
const path = require('path');

const script = path.join(__dirname, 'generate_benchmark_suite.py');
const python = process.env.PYTHON || 'python';
const result = spawnSync(python, [script], { stdio: 'inherit' });

if (result.error) {
  console.error(`No se pudo ejecutar ${python}: ${result.error.message}`);
  process.exitCode = 1;
} else if (result.status !== 0) {
  process.exitCode = result.status || 1;
}
