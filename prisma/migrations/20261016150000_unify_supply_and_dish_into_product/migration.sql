-- Unifies `supply` (insumos) and `dish` (platos) into a single `product` table.
--
-- A product can be a raw material or a finished product, may be sold (price + sellable),
-- has its own stock and may carry a reference recipe (product_recipe) for the cook.
-- Transformations add stock to the finished product. Selling decrements product stock.
--
-- Existing dishes become sellable finished products with stock 0 (their old stock lived in Redis
-- and was not backed by inventory); they must be stocked by transformation, purchase or adjustment.

-- ---------------------------------------------------------------------
-- 1. supply -> product
-- ---------------------------------------------------------------------
ALTER TYPE "supply_type" RENAME TO "product_type";
ALTER TABLE "supply" RENAME TO "product";
ALTER TABLE "product" RENAME CONSTRAINT "supply_pkey" TO "product_pkey";
ALTER TABLE "product" ALTER COLUMN "name" TYPE VARCHAR(100);
ALTER TABLE "product" ADD COLUMN "description" TEXT;
ALTER TABLE "product" ADD COLUMN "price" DECIMAL(10, 2);
ALTER TABLE "product" ADD COLUMN "sellable" BOOLEAN NOT NULL DEFAULT false;

-- supply_id -> product_id in the tables that reference it
ALTER TABLE "purchase_order_item" RENAME COLUMN "supply_id" TO "product_id";
ALTER TABLE "purchase_order_item" RENAME CONSTRAINT "purchase_order_item_supply_id_fkey" TO "purchase_order_item_product_id_fkey";
ALTER INDEX "idx_purchase_order_item_supply" RENAME TO "idx_purchase_order_item_product";

ALTER TABLE "informal_purchase" RENAME COLUMN "supply_id" TO "product_id";
ALTER TABLE "informal_purchase" RENAME CONSTRAINT "informal_purchase_supply_id_fkey" TO "informal_purchase_product_id_fkey";
ALTER INDEX "idx_informal_purchase_supply" RENAME TO "idx_informal_purchase_product";

ALTER TABLE "inventory_movement" RENAME COLUMN "supply_id" TO "product_id";
ALTER TABLE "inventory_movement" RENAME CONSTRAINT "inventory_movement_supply_id_fkey" TO "inventory_movement_product_id_fkey";
ALTER INDEX "idx_inventory_movement_supply" RENAME TO "idx_inventory_movement_product";

ALTER TABLE "transformation_item" RENAME COLUMN "supply_id" TO "product_id";
ALTER TABLE "transformation_item" RENAME CONSTRAINT "transformation_item_supply_id_fkey" TO "transformation_item_product_id_fkey";
ALTER INDEX "idx_transformation_item_supply" RENAME TO "idx_transformation_item_product";

ALTER TABLE "transformation_recipe" RENAME COLUMN "produced_supply_id" TO "produced_product_id";
ALTER TABLE "transformation_recipe" RENAME COLUMN "consumed_supply_id" TO "consumed_product_id";
ALTER TABLE "transformation_recipe" RENAME CONSTRAINT "transformation_recipe_produced_supply_id_fkey" TO "transformation_recipe_produced_product_id_fkey";
ALTER TABLE "transformation_recipe" RENAME CONSTRAINT "transformation_recipe_consumed_supply_id_fkey" TO "transformation_recipe_consumed_product_id_fkey";

-- ---------------------------------------------------------------------
-- 2. dish -> product (sellable finished products)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE "dish_product_map" ("dish_id" INTEGER PRIMARY KEY, "product_id" INTEGER NOT NULL);

DO $$
DECLARE
  d RECORD;
  new_id INTEGER;
BEGIN
  FOR d IN SELECT * FROM "dish" ORDER BY "id" LOOP
    INSERT INTO "product" ("name", "type", "unit_of_measure", "current_stock", "minimum_stock", "last_cost", "average_cost", "active", "description", "price", "sellable")
    VALUES (d."name", 'FinishedProduct', 'UND', 0, 0, 0, 0, d."active", d."description", d."price", true)
    RETURNING "id" INTO new_id;
    INSERT INTO "dish_product_map" VALUES (d."id", new_id);
  END LOOP;
END $$;

-- order_item.dish_id -> product_id
ALTER TABLE "order_item" ADD COLUMN "product_id" INTEGER;
UPDATE "order_item" oi SET "product_id" = m."product_id" FROM "dish_product_map" m WHERE m."dish_id" = oi."dish_id";
ALTER TABLE "order_item" ALTER COLUMN "product_id" SET NOT NULL;
ALTER TABLE "order_item" DROP CONSTRAINT "order_item_dish_id_fkey";
ALTER TABLE "order_item" DROP COLUMN "dish_id";
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "idx_order_item_product" ON "order_item"("product_id");

-- dish_recipe -> product_recipe (reference recipe: product = what is sold, ingredient = what it uses)
ALTER TABLE "dish_recipe" RENAME TO "product_recipe";
ALTER TABLE "product_recipe" RENAME CONSTRAINT "dish_recipe_pkey" TO "product_recipe_pkey";
ALTER TABLE "product_recipe" RENAME COLUMN "supply_id" TO "ingredient_id";
ALTER TABLE "product_recipe" RENAME CONSTRAINT "dish_recipe_supply_id_fkey" TO "product_recipe_ingredient_id_fkey";
ALTER INDEX "idx_dish_recipe_supply" RENAME TO "idx_product_recipe_ingredient";
ALTER TABLE "product_recipe" ADD COLUMN "product_id" INTEGER;
UPDATE "product_recipe" r SET "product_id" = m."product_id" FROM "dish_product_map" m WHERE m."dish_id" = r."dish_id";
ALTER TABLE "product_recipe" ALTER COLUMN "product_id" SET NOT NULL;
ALTER TABLE "product_recipe" DROP CONSTRAINT "dish_recipe_dish_id_fkey";
ALTER TABLE "product_recipe" DROP COLUMN "dish_id";
ALTER TABLE "product_recipe" ADD CONSTRAINT "product_recipe_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "idx_product_recipe_product" ON "product_recipe"("product_id");
CREATE UNIQUE INDEX "uq_product_recipe_ingredient" ON "product_recipe"("product_id", "ingredient_id");

-- ---------------------------------------------------------------------
-- 3. Starter transformation recipes: whole chicken -> cuts that are sold
-- ---------------------------------------------------------------------
INSERT INTO "transformation_recipe" ("produced_product_id", "consumed_product_id", "produced_quantity", "required_quantity", "active")
SELECT p."id", base."id", v."yield", 1, true
FROM (VALUES ('1/4 Pollo a la Brasa', 4), ('1/2 Pollo a la Brasa', 2), ('1 Pollo a la Brasa Entero', 1)) AS v("name", "yield")
JOIN "product" p ON p."name" = v."name" AND p."sellable"
JOIN LATERAL (
  SELECT "id" FROM "product" WHERE "name" = 'Pollo entero' AND "active" AND NOT "sellable" ORDER BY "id" LIMIT 1
) base ON true
ON CONFLICT DO NOTHING;

DROP TABLE "dish";
DROP TABLE "dish_product_map";
