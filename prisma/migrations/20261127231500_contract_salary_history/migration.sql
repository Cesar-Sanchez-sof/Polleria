CREATE TABLE "contract_salary_history" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "previous_salary" DECIMAL(10,2) NOT NULL,
    "new_salary" DECIMAL(10,2) NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by_id" INTEGER,

    CONSTRAINT "contract_salary_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_contract_salary_history" ON "contract_salary_history"("contract_id", "changed_at");

ALTER TABLE "contract_salary_history"
ADD CONSTRAINT "contract_salary_history_contract_id_fkey"
FOREIGN KEY ("contract_id") REFERENCES "employment_contract"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contract_salary_history"
ADD CONSTRAINT "contract_salary_history_changed_by_id_fkey"
FOREIGN KEY ("changed_by_id") REFERENCES "app_user"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
