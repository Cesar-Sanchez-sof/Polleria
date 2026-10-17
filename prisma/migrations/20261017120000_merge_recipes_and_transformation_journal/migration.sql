-- Merges `transformation_recipe` (1 input -> 1 output) into `product_recipe` (N ingredients -> 1 product).
--
-- `product_recipe.quantity_required` now means "ingredient quantity per 1 unit produced" and the recipe
-- is what a transformation executes (it consumes every ingredient and adds stock to the product).
-- Existing 1:1 recipes become one ingredient row with required_quantity / produced_quantity per unit.
--
-- Also links journal entries to the transformation that generated them and registers account 211
-- (Productos terminados) for the value moved from raw materials (241) by a transformation.

-- ---------------------------------------------------------------------
-- 1. product_recipe: per-unit quantities with more precision + active flag
-- ---------------------------------------------------------------------
ALTER TABLE "product_recipe" ALTER COLUMN "quantity_required" TYPE DECIMAL(10, 4);
ALTER TABLE "product_recipe" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------
-- 2. transformation_recipe -> product_recipe (the executable recipe wins on conflict)
-- ---------------------------------------------------------------------
INSERT INTO "product_recipe" ("product_id", "ingredient_id", "quantity_required", "active")
SELECT "produced_product_id", "consumed_product_id", ROUND("required_quantity" / "produced_quantity", 4), "active"
FROM "transformation_recipe"
WHERE "produced_quantity" > 0
ON CONFLICT ("product_id", "ingredient_id")
DO UPDATE SET "quantity_required" = EXCLUDED."quantity_required", "active" = EXCLUDED."active";

DROP TABLE "transformation_recipe";

-- ---------------------------------------------------------------------
-- 3. journal_entry.transformation_id
-- ---------------------------------------------------------------------
ALTER TABLE "journal_entry" ADD COLUMN "transformation_id" INTEGER;
CREATE INDEX "idx_journal_entry_transformation" ON "journal_entry"("transformation_id");
ALTER TABLE "journal_entry"
  ADD CONSTRAINT "journal_entry_transformation_id_fkey"
  FOREIGN KEY ("transformation_id") REFERENCES "transformation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 4. Account 211 - Productos terminados
-- ---------------------------------------------------------------------
INSERT INTO "accounting_account" ("code", "name", "type", "active", "parent_id")
SELECT '211', 'Productos Terminados', 'Activo', true, (SELECT "id" FROM "accounting_account" WHERE "code" = '2' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM "accounting_account" WHERE "code" = '211');
