-- ============================================
-- 005_payments_unique_and_yearly_control.sql
-- Ensure one payment status per user per year
-- ============================================

-- Keep latest row if duplicates already exist.
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, year
            ORDER BY COALESCE(paid_at, created_at) DESC, created_at DESC
        ) AS rn
    FROM public.payments
    WHERE user_id IS NOT NULL
)
DELETE FROM public.payments p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

ALTER TABLE public.payments
    ADD CONSTRAINT payments_user_year_unique UNIQUE (user_id, year);

CREATE INDEX IF NOT EXISTS idx_payments_year
ON public.payments(year);
