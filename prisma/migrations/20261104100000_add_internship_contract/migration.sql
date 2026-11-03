-- CreateEnum
CREATE TYPE "internship_modality" AS ENUM ('PreProfessional', 'Professional');

-- AlterEnum
ALTER TYPE "contract_kind" ADD VALUE 'Internship';

-- AlterTable
ALTER TABLE "employment_contract" ADD COLUMN     "internship_modality" "internship_modality";
