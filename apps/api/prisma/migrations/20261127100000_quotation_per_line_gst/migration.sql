-- ============================================================================
-- Day 7 (D101): quotations — GST rate per line item, a per-quotation
-- "prices include tax" toggle, and the quotation-level discount removed.
--
-- HAND-WRITTEN (a data migration cannot be generated). The structural result
-- was checked against prisma/schema.prisma with `prisma migrate diff` after
-- applying it to crm_test (no drift).
--
-- What it does, in order:
--   1. adds quotations.prices_include_tax (false for every existing row) and
--      line_items.gst_percent / taxable_amount / gst_amount (temporarily
--      nullable so existing rows can be filled);
--   2. back-fills every existing line:
--        gst_percent     = its quotation's old tax_percent
--        discount_percent = dl + dq - dl*dq/100   (line + quotation discount
--                          folded together; rounded to the column's 2 dp)
--        taxable_amount  = round2(qty * unit_price * (1 - dl/100) * (1 - dq/100))
--                          — computed from the EXACT combined factor, so
--                          rounding the stored percent to 2 dp cannot move it
--        gst_amount      = round2(taxable_amount * gst_percent / 100)
--        line_total      = taxable_amount + gst_amount   (was: pre-tax amount)
--   3. quotations.subtotal becomes the old "taxable amount"
--      (subtotal - discount_amount), the new meaning of subtotal. tax_amount
--      and total are NOT touched, so an existing quotation's total can never
--      change because of this migration;
--   4. reports (NOTICE only, never fails) how many quotations' stored totals
--      differ from the sum of their new line amounts — see the note below;
--   5. makes the new columns NOT NULL, drops the old quotation-level
--      discount_percent / tax_percent / discount_amount columns (their
--      CHECKs go with them), re-adds the money CHECK and adds CHECKs for the
--      new columns.
--
-- Rounding note: the old rule rounded GST once on the quotation, the new rule
-- rounds it once per line. For a multi-line quotation the two can differ by a
-- paisa. The stored quotation totals are deliberately left exactly as they
-- were issued; only a Draft can be edited, and saving a Draft recalculates it
-- with the new rule. Nothing is dropped that cannot be reconstructed: the old
-- discount lives on inside each line's folded discount_percent.
--
-- Not applied automatically anywhere: `pnpm db:migrate` (crm_dev) and
-- `pnpm staging:migrate` (staging) are run by the user.
-- ============================================================================

-- 1. New columns
ALTER TABLE "quotations" ADD COLUMN "prices_include_tax" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "quotation_line_items"
  ADD COLUMN "gst_percent" DECIMAL(5,2),
  ADD COLUMN "taxable_amount" DECIMAL(14,2),
  ADD COLUMN "gst_amount" DECIMAL(14,2);

-- 2. Back-fill the lines (every right-hand side reads the OLD values).
UPDATE "quotation_line_items" AS li
SET
  "gst_percent" = q."tax_percent",
  "taxable_amount" = round(
    li."quantity" * li."unit_price" * (1 - li."discount_percent" / 100) * (1 - q."discount_percent" / 100), 2
  ),
  "gst_amount" = round(
    round(li."quantity" * li."unit_price" * (1 - li."discount_percent" / 100) * (1 - q."discount_percent" / 100), 2)
      * q."tax_percent" / 100, 2
  ),
  "line_total" = round(
    li."quantity" * li."unit_price" * (1 - li."discount_percent" / 100) * (1 - q."discount_percent" / 100), 2
  ) + round(
    round(li."quantity" * li."unit_price" * (1 - li."discount_percent" / 100) * (1 - q."discount_percent" / 100), 2)
      * q."tax_percent" / 100, 2
  ),
  "discount_percent" = round(
    li."discount_percent" + q."discount_percent" - li."discount_percent" * q."discount_percent" / 100, 2
  )
FROM "quotations" AS q
WHERE q."id" = li."quotation_id";

-- 3. Quotation subtotal now means "sum of pre-GST amounts" (the old taxable amount).
UPDATE "quotations" SET "subtotal" = "subtotal" - "discount_amount";

-- 4. Visibility only: how many stored totals differ from the new per-line sums.
DO $$
DECLARE
  drifted integer;
  total_count integer;
BEGIN
  SELECT count(*) INTO total_count FROM "quotations";
  SELECT count(*) INTO drifted FROM "quotations" q
  WHERE q."subtotal" IS DISTINCT FROM COALESCE((SELECT sum(li."taxable_amount") FROM "quotation_line_items" li WHERE li."quotation_id" = q."id"), 0)
     OR q."tax_amount" IS DISTINCT FROM COALESCE((SELECT sum(li."gst_amount") FROM "quotation_line_items" li WHERE li."quotation_id" = q."id"), 0)
     OR q."total" IS DISTINCT FROM COALESCE((SELECT sum(li."line_total") FROM "quotation_line_items" li WHERE li."quotation_id" = q."id"), 0);
  RAISE NOTICE 'quotation_per_line_gst: % of % existing quotations have stored totals that differ from their new per-line sums by rounding (stored totals kept as issued)', drifted, total_count;
END $$;

-- 5. Finish the structure.
ALTER TABLE "quotation_line_items"
  ALTER COLUMN "gst_percent" SET NOT NULL,
  ALTER COLUMN "taxable_amount" SET NOT NULL,
  ALTER COLUMN "gst_amount" SET NOT NULL;

ALTER TABLE "quotations"
  DROP CONSTRAINT "quotations_discount_percent_range",
  DROP CONSTRAINT "quotations_tax_percent_range",
  DROP CONSTRAINT "quotations_amounts_non_negative";

ALTER TABLE "quotations"
  DROP COLUMN "discount_percent",
  DROP COLUMN "tax_percent",
  DROP COLUMN "discount_amount";

-- ============================================================================
-- HAND-WRITTEN ADDITIONS (CHECK constraints — Prisma's schema cannot express them)
-- ============================================================================

ALTER TABLE "quotations"
  ADD CONSTRAINT "quotations_amounts_non_negative" CHECK ("subtotal" >= 0 AND "tax_amount" >= 0 AND "total" >= 0);

ALTER TABLE "quotation_line_items"
  ADD CONSTRAINT "quotation_line_items_gst_percent_range" CHECK ("gst_percent" BETWEEN 0 AND 100),
  ADD CONSTRAINT "quotation_line_items_tax_amounts_non_negative" CHECK ("taxable_amount" >= 0 AND "gst_amount" >= 0);
