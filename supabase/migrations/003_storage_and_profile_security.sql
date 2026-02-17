-- ============================================
-- 003_storage_and_profile_security.sql
-- 1) Add storage bucket and RLS for fault photos
-- 2) Harden profile self-update policy (block self-promotion to admin)
-- ============================================

-- -----------------------------
-- Storage bucket for fault photos
-- -----------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'fault-photos',
    'fault-photos',
    TRUE,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Remove old policies if they exist
DROP POLICY IF EXISTS "Approved users can view fault photos" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can upload fault photos" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete own fault photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete fault photos" ON storage.objects;

-- Approved users can read fault photos
CREATE POLICY "Approved users can view fault photos"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'fault-photos'
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_approved = TRUE
    )
);

-- Approved users can upload fault photos into their own folder
CREATE POLICY "Approved users can upload fault photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'fault-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_approved = TRUE
    )
);

-- Photo owner can delete files in their own folder
CREATE POLICY "Owner can delete own fault photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'fault-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can delete any fault photo
CREATE POLICY "Admins can delete fault photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'fault-photos'
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_admin = TRUE
    )
);

-- -----------------------------
-- Profile security hardening
-- -----------------------------
-- Existing policy allowed users to set is_admin/is_approved on themselves.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id
    AND is_admin = (
        SELECT p.is_admin
        FROM public.profiles p
        WHERE p.id = auth.uid()
    )
    AND is_approved = (
        SELECT p.is_approved
        FROM public.profiles p
        WHERE p.id = auth.uid()
    )
);
