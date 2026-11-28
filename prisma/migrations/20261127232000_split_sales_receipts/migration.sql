ALTER TABLE "order_item"
ADD COLUMN "billed_quantity" SMALLINT NOT NULL DEFAULT 0;

CREATE TABLE "sales_invoice_item" (
    "id" SERIAL NOT NULL,
    "sales_invoice_id" INTEGER NOT NULL,
    "order_item_id" INTEGER,
    "name" VARCHAR(150) NOT NULL,
    "quantity" SMALLINT NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "notes" VARCHAR(100),

    CONSTRAINT "sales_invoice_item_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_sales_invoice_item_invoice" ON "sales_invoice_item"("sales_invoice_id");
CREATE INDEX "idx_sales_invoice_item_order_item" ON "sales_invoice_item"("order_item_id");

ALTER TABLE "sales_invoice_item"
ADD CONSTRAINT "sales_invoice_item_sales_invoice_id_fkey"
FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoice"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_invoice_item"
ADD CONSTRAINT "sales_invoice_item_order_item_id_fkey"
FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "sales_invoice_item" ("sales_invoice_id", "order_item_id", "name", "quantity", "unit_price", "subtotal", "notes")
SELECT si."id", oi."id", p."name", oi."quantity", oi."unit_price", oi."subtotal", oi."notes"
FROM "sales_invoice" si
JOIN "order_item" oi ON oi."order_id" = si."order_id"
JOIN "product" p ON p."id" = oi."product_id"
ORDER BY si."id", oi."id";

UPDATE "order_item" oi
SET "billed_quantity" = oi."quantity"
WHERE EXISTS (
    SELECT 1
    FROM "sales_invoice" si
    WHERE si."order_id" = oi."order_id"
);
