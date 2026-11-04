import dotenv from "dotenv";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno de .env.test
dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true });

try {
  console.log("🔄 Sincronizando esquema en base de datos de pruebas (.env.test)...");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: process.env,
  });

  console.log("🌱 Poblando base de datos de pruebas con el seed...");
  execSync("npx prisma db seed", {
    stdio: "inherit",
    env: process.env,
  });

  console.log("🎭 Ejecutando suite de pruebas E2E con Playwright...");
  const extraArgs = process.argv.slice(2).join(" ");
  execSync(`npx playwright test ${extraArgs}`.trim(), {
    stdio: "inherit",
    env: process.env,
  });
} catch (error) {
  process.exit(error.status ?? 1);
}
