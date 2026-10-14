-- Renames the remaining Spanish column names to English.
-- Only column / index / constraint names change; no data is touched.

-- app_user: correo -> email, estado -> active
ALTER TABLE "app_user" RENAME COLUMN "correo" TO "email";
ALTER TABLE "app_user" RENAME COLUMN "estado" TO "active";
ALTER INDEX "app_user_correo_key" RENAME TO "app_user_email_key";

-- transformation: annulment columns
ALTER TABLE "transformation" RENAME COLUMN "anulado" TO "annulled";
ALTER TABLE "transformation" RENAME COLUMN "anulado_at" TO "annulled_at";
ALTER TABLE "transformation" RENAME COLUMN "anulado_por" TO "annulled_by_id";
ALTER TABLE "transformation" RENAME COLUMN "motivo_anulacion" TO "annulment_reason";
ALTER TABLE "transformation" RENAME CONSTRAINT "transformation_anulado_por_fkey" TO "transformation_annulled_by_id_fkey";

-- informal_purchase: annulment columns
ALTER TABLE "informal_purchase" RENAME COLUMN "anulado" TO "annulled";
ALTER TABLE "informal_purchase" RENAME COLUMN "anulado_at" TO "annulled_at";
ALTER TABLE "informal_purchase" RENAME COLUMN "anulado_por" TO "annulled_by_id";
ALTER TABLE "informal_purchase" RENAME COLUMN "motivo_anulacion" TO "annulment_reason";
ALTER TABLE "informal_purchase" RENAME CONSTRAINT "informal_purchase_anulado_por_fkey" TO "informal_purchase_annulled_by_id_fkey";
