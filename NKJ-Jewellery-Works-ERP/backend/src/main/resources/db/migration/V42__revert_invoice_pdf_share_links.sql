-- Revert the temporary invoice PDF share-link storage introduced after PR #9.
-- Retain V41 for Flyway validation on databases where it has already been applied.
-- V42 removes only temporary PDF/token records; finalized invoices, payments,
-- customers, cashbook entries and installment records are not modified.
DROP TABLE IF EXISTS public.invoice_share_files;
