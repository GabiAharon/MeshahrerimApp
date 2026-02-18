-- ============================================
-- 006_finance_settings_and_apartment_payments.sql
-- Finance control by apartment + yearly settings
-- ============================================

-- 1) Finance settings (single row)
CREATE TABLE IF NOT EXISTS public.finance_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    annual_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    apartments TEXT[] NOT NULL DEFAULT '{}',
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage finance settings" ON public.finance_settings;
CREATE POLICY "Admins can manage finance settings"
ON public.finance_settings FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_admin = TRUE
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_admin = TRUE
    )
);

DROP POLICY IF EXISTS "Approved users can read finance settings" ON public.finance_settings;
CREATE POLICY "Approved users can read finance settings"
ON public.finance_settings FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_approved = TRUE
    )
);

DROP TRIGGER IF EXISTS update_finance_settings_updated_at ON public.finance_settings;
CREATE TRIGGER update_finance_settings_updated_at
BEFORE UPDATE ON public.finance_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.finance_settings (id, annual_fee, apartments)
VALUES (
    1,
    0,
    COALESCE(
        (
            SELECT ARRAY(
                SELECT DISTINCT apartment
                FROM public.profiles
                WHERE apartment IS NOT NULL
                  AND apartment <> ''
                ORDER BY apartment
            )
        ),
        '{}'
    )
)
ON CONFLICT (id) DO NOTHING;

-- 2) Payments uniqueness by apartment + year (instead of user + year)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_user_year_unique;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_apartment_year_unique;

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY apartment, year
            ORDER BY COALESCE(paid_at, created_at) DESC, created_at DESC
        ) AS rn
    FROM public.payments
    WHERE apartment IS NOT NULL
      AND apartment <> ''
)
DELETE FROM public.payments p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

ALTER TABLE public.payments
    ADD CONSTRAINT payments_apartment_year_unique UNIQUE (apartment, year);

CREATE INDEX IF NOT EXISTS idx_payments_apartment_year
ON public.payments(apartment, year);
