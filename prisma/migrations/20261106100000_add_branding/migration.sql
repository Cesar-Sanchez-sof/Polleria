-- CreateTable
CREATE TABLE "branding_setting" (
    "id" VARCHAR(50) NOT NULL DEFAULT 'default',
    "content" JSONB NOT NULL,
    "updated_by" VARCHAR(50),
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "branding_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branding_asset" (
    "slot" VARCHAR(40) NOT NULL,
    "mime_type" VARCHAR(60) NOT NULL,
    "data" BYTEA NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "updated_by" VARCHAR(50),
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "branding_asset_pkey" PRIMARY KEY ("slot")
);
