-- CreateTable
CREATE TABLE "dining_area" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "level" VARCHAR(50) NOT NULL DEFAULT 'Piso 1',
    "description" VARCHAR(255),
    "table_numbers" INTEGER[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "color" VARCHAR(30) DEFAULT 'emerald',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dining_area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "printer_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "paper_width" VARCHAR(10) NOT NULL DEFAULT '80mm',
    "auto_cut" BOOLEAN NOT NULL DEFAULT true,
    "auto_print_voucher" BOOLEAN NOT NULL DEFAULT true,
    "print_waiter_copy" BOOLEAN NOT NULL DEFAULT false,
    "series" JSONB NOT NULL,
    "kitchen_printer" JSONB NOT NULL,
    "bar_printer" JSONB NOT NULL,
    "cashier_printer" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "printer_config_pkey" PRIMARY KEY ("id")
);
