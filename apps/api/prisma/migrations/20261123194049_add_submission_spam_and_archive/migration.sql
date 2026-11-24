-- AlterEnum
ALTER TYPE "submission_status" ADD VALUE 'SPAM';

-- AlterTable
ALTER TABLE "website_submissions" ADD COLUMN     "archived_at" TIMESTAMPTZ(3);
