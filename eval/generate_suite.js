// Compatibility entry point; canonical launcher lives under eval/sql.
const { spawnSync } = require('child_process');
const path = require('path');

const script = path.join(__dirname, 'sql', 'generate_suite.js');
const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });

if (result.error) {
  console.error(`No se pudo ejecutar Node.js: ${result.error.message}`);
  process.exitCode = 1;
} else if (result.status !== 0) {
  process.exitCode = result.status || 1;
}
