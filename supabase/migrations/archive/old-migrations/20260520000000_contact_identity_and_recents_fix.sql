-- Contact identity and recents performance fix.
-- Makes phonebook sync feed the hashed caller-ID graph and adds indexes for fast recents.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS contact_phone_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_phone_hash
  ON public.contacts(contact_phone_hash);

CREATE INDEX IF NOT EXISTS idx_contacts_user_phone
  ON public.contacts(user_id, contact_phone);

CREATE INDEX IF NOT EXISTS idx_calls_caller_created
  ON public.calls(caller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calls_receiver_created
  ON public.calls(receiver_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.sync_user_contacts(user_uuid uuid, contact_list jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  contact_item jsonb;
  matched_user_id uuid;
  v_phone text;
  v_hash text;
  v_name text;
  v_email text;
BEGIN
  FOR contact_item IN SELECT * FROM jsonb_array_elements(contact_list)
  LOOP
    v_phone := NULLIF(BTRIM(contact_item->>'phone'), '');
    v_hash := NULLIF(BTRIM(contact_item->>'phone_hash'), '');
    v_name := COALESCE(NULLIF(BTRIM(contact_item->>'name'), ''), 'Unknown');
    v_email := NULLIF(BTRIM(contact_item->>'email'), '');
    matched_user_id := NULL;

    IF v_phone IS NOT NULL AND v_hash IS NULL THEN
      v_hash := encode(digest(v_phone, 'sha256'), 'hex');
    END IF;

    IF v_email IS NOT NULL THEN
      SELECT id INTO matched_user_id
      FROM public.profiles
      WHERE email = v_email
      LIMIT 1;
    END IF;

    IF matched_user_id IS NULL AND v_phone IS NOT NULL THEN
      SELECT id INTO matched_user_id
      FROM public.profiles
      WHERE phone_number = v_phone
         OR (v_hash IS NOT NULL AND phone_hash = v_hash)
      LIMIT 1;
    END IF;

    IF v_phone IS NOT NULL THEN
      INSERT INTO public.contacts (
        user_id,
        contact_user_id,
        contact_name,
        contact_phone,
        contact_phone_hash,
        is_registered
      )
      VALUES (
        user_uuid,
        matched_user_id,
        v_name,
        v_phone,
        v_hash,
        matched_user_id IS NOT NULL
      )
      ON CONFLICT (user_id, contact_phone)
      DO UPDATE SET
        contact_user_id = EXCLUDED.contact_user_id,
        contact_name = EXCLUDED.contact_name,
        contact_phone_hash = EXCLUDED.contact_phone_hash,
        is_registered = EXCLUDED.is_registered;

      IF v_hash IS NOT NULL AND v_name <> 'Unknown' AND length(v_name) > 1 THEN
        INSERT INTO public.caller_identity_observations (
          reporter_id,
          phone_number,
          hashed_number,
          observed_name,
          source,
          confidence,
          updated_at
        )
        VALUES (
          user_uuid,
          v_phone,
          v_hash,
          v_name,
          'phonebook',
          85,
          now()
        )
        ON CONFLICT (reporter_id, hashed_number, source)
        DO UPDATE SET
          phone_number = EXCLUDED.phone_number,
          observed_name = EXCLUDED.observed_name,
          confidence = GREATEST(public.caller_identity_observations.confidence, EXCLUDED.confidence),
          updated_at = now();
      END IF;
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.lookup_caller_id(p_hashed_number TEXT, p_raw_number TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contact_record RECORD;
  aggregate_record RECORD;
  direct_spam_count INTEGER;
  final_name TEXT;
  final_trust INTEGER;
  final_spam_reports INTEGER;
BEGIN
  SELECT name, trust_score, frequency
  INTO contact_record
  FROM public.contacts_hash
  WHERE hashed_number = p_hashed_number
  LIMIT 1;

  SELECT community_name, total_reports, spam_reports, spam_percentage, most_common_type, community_label
  INTO aggregate_record
  FROM public.caller_id_aggregates
  WHERE phone_number = p_raw_number
  LIMIT 1;

  SELECT COUNT(*)
  INTO direct_spam_count
  FROM public.spam_reports
  WHERE number = p_raw_number;

  final_name := COALESCE(contact_record.name, aggregate_record.community_name, 'Unknown Caller');
  final_spam_reports := GREATEST(COALESCE(aggregate_record.spam_reports, 0), COALESCE(direct_spam_count, 0));
  final_trust := COALESCE(
    contact_record.trust_score,
    GREATEST(5, LEAST(99, 100 - COALESCE(aggregate_record.spam_percentage, 0)::INTEGER)),
    50
  );

  IF final_spam_reports >= 5 THEN
    final_trust := LEAST(final_trust, 30);
  END IF;

  RETURN json_build_object(
    'name', final_name,
    'trust_score', final_trust,
    'spam_reports', final_spam_reports,
    'total_reports', COALESCE(aggregate_record.total_reports, final_spam_reports),
    'spam_percentage', COALESCE(aggregate_record.spam_percentage, 0),
    'community_label', aggregate_record.community_label,
    'most_common_type', aggregate_record.most_common_type,
    'frequency', COALESCE(contact_record.frequency, 0)
  );
END;
$$;
