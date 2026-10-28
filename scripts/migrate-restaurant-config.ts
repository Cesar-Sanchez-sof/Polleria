/**
 * Script de migración idempotente de datos del restaurante y Yape desde JSON a PostgreSQL.
 *
 * Ejecución:
 *   npx tsx scripts/migrate-restaurant-config.ts
 *
 * Garantiza:
 * - No borra ninguna información previa en la base de datos.
 * - Si el registro 'default' ya existe en PostgreSQL, lo mantiene sin alterar.
 * - Si no existe, migra los datos de data/restaurant-config.json incluyendo la carga segura del QR de Yape a S3.
 */
import { migrateRestaurantConfigFromJson } from "../lib/services/restaurant-config.service";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🚀 Iniciando migración idempotente de datos del restaurante a PostgreSQL...");
  try {
    const result = await migrateRestaurantConfigFromJson();
    if (result.migrated) {
      console.log("✅ Migración ejecutada con éxito. Datos del restaurante creados en la tabla 'restaurant_config':");
      console.log(`   - Razón Social: ${result.restaurant.name}`);
      console.log(`   - Nombre Comercial: ${result.restaurant.commercialName}`);
      console.log(`   - RUC: ${result.restaurant.ruc}`);
      console.log(`   - Teléfono Yape: ${result.restaurant.yapePhone}`);
      console.log(`   - QR Yape URL: ${result.restaurant.yapeQrImageUrl || "(ninguno)"}`);
    } else {
      console.log("ℹ️ La configuración en PostgreSQL ya existía previamente. No se requirieron cambios (idempotente):");
      console.log(`   - Razón Social: ${result.restaurant.name}`);
      console.log(`   - RUC: ${result.restaurant.ruc}`);
    }
  } catch (error) {
    console.error("❌ Error durante la migración de datos:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
