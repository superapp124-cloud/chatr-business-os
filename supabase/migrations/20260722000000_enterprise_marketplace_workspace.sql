-- Enterprise Marketplace and workspace state. All tenant data is protected by organization membership.

CREATE TABLE IF NOT EXISTS public.enterprise_marketplace_industries (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  template_ids text[] NOT NULL DEFAULT '{}',
  pack_count integer NOT NULL DEFAULT 0 CHECK (pack_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enterprise_marketplace_packs (
  id text PRIMARY KEY,
  name text NOT NULL,
  version text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  dependencies text[] NOT NULL DEFAULT '{}',
  permissions text[] NOT NULL DEFAULT '{}',
  objects text[] NOT NULL DEFAULT '{}',
  processes text[] NOT NULL DEFAULT '{}',
  policies text[] NOT NULL DEFAULT '{}',
  required_packs text[] NOT NULL DEFAULT '{}',
  optional_packs text[] NOT NULL DEFAULT '{}',
  preview_images text[] NOT NULL DEFAULT '{}',
  author text NOT NULL,
  certification text NOT NULL CHECK (certification IN ('Verified', 'Community', 'Alpha')),
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enterprise_marketplace_templates (
  id text PRIMARY KEY,
  industry_id text NOT NULL REFERENCES public.enterprise_marketplace_industries(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text NOT NULL,
  pack_ids text[] NOT NULL DEFAULT '{}',
  icon text,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enterprise_marketplace_templates_search_idx
  ON public.enterprise_marketplace_templates USING gin (search_vector);

CREATE TABLE IF NOT EXISTS public.enterprise_capability_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pack_id text NOT NULL REFERENCES public.enterprise_marketplace_packs(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'installed' CHECK (status IN ('installed', 'update_available', 'disabled')),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, pack_id)
);

CREATE INDEX IF NOT EXISTS enterprise_capability_installs_org_idx
  ON public.enterprise_capability_installs (organization_id, status);

ALTER TABLE public.enterprise_marketplace_industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_marketplace_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_marketplace_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_capability_installs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read enterprise marketplace industries"
  ON public.enterprise_marketplace_industries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read enterprise marketplace packs"
  ON public.enterprise_marketplace_packs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read enterprise marketplace templates"
  ON public.enterprise_marketplace_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Organization members can view capability installs"
  ON public.enterprise_capability_installs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.organization_members member
    WHERE member.organization_id = enterprise_capability_installs.organization_id
      AND member.user_id = auth.uid()
  ));
CREATE POLICY "Organization administrators manage capability installs"
  ON public.enterprise_capability_installs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.organization_members member
    WHERE member.organization_id = enterprise_capability_installs.organization_id
      AND member.user_id = auth.uid()
      AND member.role IN ('owner', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members member
    WHERE member.organization_id = enterprise_capability_installs.organization_id
      AND member.user_id = auth.uid()
      AND member.role IN ('owner', 'admin')
  ));

CREATE OR REPLACE FUNCTION public.touch_enterprise_capability_install()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_enterprise_capability_install ON public.enterprise_capability_installs;
CREATE TRIGGER touch_enterprise_capability_install
  BEFORE UPDATE ON public.enterprise_capability_installs
  FOR EACH ROW EXECUTE FUNCTION public.touch_enterprise_capability_install();

ALTER TABLE public.enterprise_capability_installs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enterprise_capability_installs;
