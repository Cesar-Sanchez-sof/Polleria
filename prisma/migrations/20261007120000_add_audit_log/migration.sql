-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT');

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER,
    "username" VARCHAR(50) NOT NULL,
    "action" "audit_action" NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "entity" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(50),
    "description" VARCHAR(255) NOT NULL,
    "details" JSONB,
    "ip_address" VARCHAR(45),

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_log_created_at" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_log_user" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_log_module_entity" ON "audit_log"("module", "entity");

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;