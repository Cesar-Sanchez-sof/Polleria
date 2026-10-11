-- Migración aplicada manualmente a Neon vía prisma db push.
-- Este archivo existe solo para que Prisma reconozca que el campo 
-- s3_url ya está en la base de datos.

ALTER TABLE "sales_invoice" ADD COLUMN "s3_url" VARCHAR(300);