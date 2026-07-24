-- Migration: Phase 5.5 — Marketplace (Internal + Public)
-- Date: 2026-07-09

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Separation: internal org assets vs public community listings
  listing_type text NOT NULL DEFAULT 'public'
    CHECK (listing_type IN ('internal', 'public')),
  
  -- What kind of asset is this?
  asset_type text NOT NULL
    CHECK (asset_type IN ('plugin', 'connector', 'workflow_template', 'import_template', 'mapping_profile', 'dashboard_widget', 'ai_prompt_pack', 'policy_pack')),
  
  -- Identity
  name text NOT NULL,
  description text,
  category text, -- e.g. 'crm', 'payments', 'hr', 'healthcare'
  tags jsonb DEFAULT '[]'::jsonb,
  
  -- The full plugin/asset manifest as a jsonb snapshot
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Publisher
  author text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  publisher_tenant_id uuid, -- Which org published this (for internal listings)
  
  -- Versioning
  version text NOT NULL DEFAULT '1.0.0',
  chatr_os_min_version text DEFAULT '4.0.0',
  
  -- Governance
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'listed', 'rejected', 'deprecated', 'unlisted')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  
  -- Metrics
  downloads integer DEFAULT 0,
  avg_rating numeric(2,1) DEFAULT 0,
  rating_count integer DEFAULT 0,
  
  -- Screenshots/media
  screenshots jsonb DEFAULT '[]'::jsonb,
  readme text,
  changelog text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

-- Public listed assets are readable by all authenticated users
CREATE POLICY "Anyone can view listed public marketplace assets"
  ON public.marketplace_listings FOR SELECT
  USING (status = 'listed');

-- Authors can manage their own listings
CREATE POLICY "Authors can manage their own listings"
  ON public.marketplace_listings FOR ALL
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Admins can manage all listings
CREATE POLICY "Admins can manage all marketplace listings"
  ON public.marketplace_listings FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_marketplace_asset_type ON public.marketplace_listings(asset_type, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listing_type ON public.marketplace_listings(listing_type, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_category ON public.marketplace_listings(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_downloads ON public.marketplace_listings(downloads DESC);

-- Track installed assets per tenant
CREATE TABLE IF NOT EXISTS public.marketplace_installs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid NOT NULL,
  installed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'quarantined'
    CHECK (status IN ('quarantined', 'pending_approval', 'approved', 'disabled', 'uninstalled')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  installed_at timestamptz DEFAULT now(),
  UNIQUE(listing_id, tenant_id)
);

ALTER TABLE public.marketplace_installs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their installs"
  ON public.marketplace_installs FOR SELECT
  USING (installed_by = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage installs"
  ON public.marketplace_installs FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trigger_marketplace_listings_updated_at
BEFORE UPDATE ON public.marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
