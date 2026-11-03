-- CreateTable
CREATE TABLE "dashboard_role_access" (
    "id" TEXT NOT NULL,
    "dashboard_id" TEXT NOT NULL,
    "role_id" INTEGER NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dashboard_role_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_user_access" (
    "id" TEXT NOT NULL,
    "dashboard_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dashboard_user_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_role_access_dashboard_id_role_id_key" ON "dashboard_role_access"("dashboard_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_user_access_dashboard_id_user_id_key" ON "dashboard_user_access"("dashboard_id", "user_id");

-- AddForeignKey
ALTER TABLE "dashboard_role_access" ADD CONSTRAINT "dashboard_role_access_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_role_access" ADD CONSTRAINT "dashboard_role_access_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_user_access" ADD CONSTRAINT "dashboard_user_access_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_user_access" ADD CONSTRAINT "dashboard_user_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
