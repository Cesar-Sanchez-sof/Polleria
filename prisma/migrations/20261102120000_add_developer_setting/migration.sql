-- CreateTable
CREATE TABLE "developer_setting" (
    "key" VARCHAR(60) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" VARCHAR(50),
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "developer_setting_pkey" PRIMARY KEY ("key")
);
