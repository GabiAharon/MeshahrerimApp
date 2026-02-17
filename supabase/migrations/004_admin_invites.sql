-- ============================================
-- 004_admin_invites.sql
-- Secure admin invite flow with one-time code
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage admin invites" ON public.admin_invites;
CREATE POLICY "Admins can manage admin invites"
ON public.admin_invites FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND is_admin = TRUE
    )
);

CREATE OR REPLACE FUNCTION public.create_admin_invite(p_expires_hours INTEGER DEFAULT 24)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    generated_code TEXT;
    is_admin_user BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND is_admin = TRUE
    ) INTO is_admin_user;

    IF NOT is_admin_user THEN
        RAISE EXCEPTION 'Only admins can create admin invites';
    END IF;

    generated_code := encode(gen_random_bytes(18), 'hex');

    INSERT INTO public.admin_invites (code, created_by, expires_at)
    VALUES (generated_code, auth.uid(), NOW() + make_interval(hours => GREATEST(p_expires_hours, 1)));

    RETURN generated_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_admin_invite(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    invite_row public.admin_invites%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT *
    INTO invite_row
    FROM public.admin_invites
    WHERE code = p_code
      AND used_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF invite_row.id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.profiles
    SET is_admin = TRUE,
        is_approved = TRUE,
        updated_at = NOW()
    WHERE id = auth.uid();

    UPDATE public.admin_invites
    SET used_by = auth.uid(),
        used_at = NOW()
    WHERE id = invite_row.id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_admin_invite(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_admin_invite(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_admin_invite(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_admin_invite(TEXT) TO authenticated;
