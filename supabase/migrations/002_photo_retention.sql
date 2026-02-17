-- ============================================
-- 002_photo_retention.sql
-- Automatically remove fault photos after 30 days
-- unless preserve_photos = TRUE
-- ============================================

ALTER TABLE public.faults
    ADD COLUMN IF NOT EXISTS preserve_photos BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS photos_expires_at TIMESTAMPTZ;

-- Backfill existing records with photos so they expire after 30 days from creation.
UPDATE public.faults
SET photos_expires_at = created_at + INTERVAL '30 days'
WHERE preserve_photos = FALSE
  AND photos IS NOT NULL
  AND COALESCE(array_length(photos, 1), 0) > 0
  AND photos_expires_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_fault_photo_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.preserve_photos = TRUE THEN
        NEW.photos_expires_at := NULL;
        RETURN NEW;
    END IF;

    IF NEW.photos IS NULL OR COALESCE(array_length(NEW.photos, 1), 0) = 0 THEN
        NEW.photos_expires_at := NULL;
        RETURN NEW;
    END IF;

    -- If preserve is turned off, start a fresh 30-day countdown from now.
    IF TG_OP = 'UPDATE'
       AND OLD.preserve_photos = TRUE
       AND NEW.preserve_photos = FALSE THEN
        NEW.photos_expires_at := NOW() + INTERVAL '30 days';
        RETURN NEW;
    END IF;

    IF NEW.photos_expires_at IS NULL THEN
        NEW.photos_expires_at := COALESCE(NEW.created_at, NOW()) + INTERVAL '30 days';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_fault_photo_expiry_trigger ON public.faults;
CREATE TRIGGER set_fault_photo_expiry_trigger
BEFORE INSERT OR UPDATE OF photos, preserve_photos
ON public.faults
FOR EACH ROW
EXECUTE FUNCTION public.set_fault_photo_expiry();

CREATE OR REPLACE FUNCTION public.cleanup_expired_fault_photos(batch_size INTEGER DEFAULT 200)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cleared_count INTEGER := 0;
BEGIN
    WITH expired_faults AS (
        SELECT id, photos
        FROM public.faults
        WHERE preserve_photos = FALSE
          AND photos_expires_at IS NOT NULL
          AND photos_expires_at <= NOW()
          AND photos IS NOT NULL
          AND COALESCE(array_length(photos, 1), 0) > 0
        ORDER BY photos_expires_at ASC
        LIMIT GREATEST(batch_size, 1)
    ),
    expanded AS (
        SELECT
            ef.id AS fault_id,
            match_data[1] AS bucket_id,
            split_part(match_data[2], '?', 1) AS object_name
        FROM expired_faults ef
        CROSS JOIN LATERAL unnest(ef.photos) AS photo_url
        CROSS JOIN LATERAL regexp_match(
            photo_url,
            '/storage/v1/object/(?:public|sign)/([^/]+)/(.+)$'
        ) AS match_data
    ),
    deleted_storage_objects AS (
        DELETE FROM storage.objects so
        USING expanded e
        WHERE so.bucket_id = e.bucket_id
          AND so.name = e.object_name
        RETURNING e.fault_id
    ),
    cleared_faults AS (
        UPDATE public.faults f
        SET photos = NULL,
            photos_expires_at = NULL,
            updated_at = NOW()
        WHERE f.id IN (SELECT id FROM expired_faults)
        RETURNING f.id
    )
    SELECT COUNT(*) INTO cleared_count FROM cleared_faults;

    RETURN cleared_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_fault_photos(INTEGER) FROM PUBLIC;

CREATE INDEX IF NOT EXISTS idx_faults_photos_expires_at
ON public.faults(photos_expires_at)
WHERE preserve_photos = FALSE;

-- Optional scheduler (run once manually if pg_cron is enabled):
-- SELECT cron.schedule(
--   'cleanup-fault-photos-daily',
--   '15 3 * * *',
--   $$SELECT public.cleanup_expired_fault_photos(500);$$
-- );
