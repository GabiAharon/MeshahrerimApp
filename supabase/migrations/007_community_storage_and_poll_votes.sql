-- ============================================
-- 007_community_storage_and_poll_votes.sql
-- Community storage (marketplace photos) + poll vote read policy
-- ============================================

-- -----------------------------
-- Storage bucket for marketplace photos
-- -----------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'marketplace-photos',
    'marketplace-photos',
    TRUE,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Approved users can view marketplace photos" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can upload marketplace photos" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete own marketplace photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete marketplace photos" ON storage.objects;

CREATE POLICY "Approved users can view marketplace photos"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'marketplace-photos'
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_approved = TRUE
    )
);

CREATE POLICY "Approved users can upload marketplace photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'marketplace-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_approved = TRUE
    )
);

CREATE POLICY "Owner can delete own marketplace photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'marketplace-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can delete marketplace photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'marketplace-photos'
    AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_admin = TRUE
    )
);

-- -----------------------------
-- Poll votes visibility
-- -----------------------------
DROP POLICY IF EXISTS "Users can see own votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Approved users can read poll votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Admins can manage poll votes" ON public.poll_votes;

CREATE POLICY "Approved users can read poll votes"
ON public.poll_votes FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_approved = TRUE
    )
);

CREATE POLICY "Admins can manage poll votes"
ON public.poll_votes FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_admin = TRUE
    )
);
