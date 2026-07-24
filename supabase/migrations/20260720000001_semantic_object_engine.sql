-- Migration: Semantic Object Engine
-- Sets up the dynamic tables for the Universal Business OS capabilities.

-- 1. Metadata Schema: Installed Packages
CREATE TABLE IF NOT EXISTS public.pkg_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    maturity_level VARCHAR(10) NOT NULL,
    description TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Metadata Schema: Semantic Objects
CREATE TABLE IF NOT EXISTS public.sem_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id VARCHAR(255) REFERENCES public.pkg_manifests(package_id) ON DELETE CASCADE,
    object_name VARCHAR(255) NOT NULL,
    plural_name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Metadata Schema: Semantic Capabilities (Executable Actions)
CREATE TABLE IF NOT EXISTS public.sem_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_id UUID REFERENCES public.sem_objects(id) ON DELETE CASCADE,
    capability_name VARCHAR(255) NOT NULL,
    action_type VARCHAR(100) NOT NULL, -- e.g., 'workflow', 'ai_agent', 'crud'
    payload_schema JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Runtime Schema: Semantic Records (The actual data)
CREATE TABLE IF NOT EXISTS public.sem_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_id UUID REFERENCES public.sem_objects(id) ON DELETE CASCADE,
    tenant_id UUID, -- For multi-tenancy
    data JSONB NOT NULL DEFAULT '{}'::jsonb, -- 100% Real data payload
    status VARCHAR(100) DEFAULT 'active',
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Runtime Schema: Semantic Relationships (The Business Graph)
CREATE TABLE IF NOT EXISTS public.sem_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_record_id UUID REFERENCES public.sem_records(id) ON DELETE CASCADE,
    target_record_id UUID REFERENCES public.sem_records(id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) NOT NULL, -- e.g., 'parent', 'dependency', 'reference'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Seed Data: The Recruitment Flagship
INSERT INTO public.pkg_manifests (package_id, name, category, maturity_level, description)
VALUES 
('recruitment', 'Recruitment & ATS', 'professional', 'L4', 'End-to-end applicant tracking, JD generation & interviews.')
ON CONFLICT (package_id) DO NOTHING;

-- Create the Candidate Semantic Object
INSERT INTO public.sem_objects (id, package_id, object_name, plural_name, description, icon)
VALUES 
('11111111-1111-1111-1111-111111111111', 'recruitment', 'Candidate', 'Candidates', 'A job applicant in the ATS', 'Users')
ON CONFLICT DO NOTHING;

-- Seed some realistic candidate records to prove the backend works
INSERT INTO public.sem_records (object_id, data, status)
VALUES 
('11111111-1111-1111-1111-111111111111', '{"first_name": "Sarah", "last_name": "Jenkins", "role": "Senior Frontend Engineer", "email": "sarah.j@example.com", "score": 94}', 'interview'),
('11111111-1111-1111-1111-111111111111', '{"first_name": "Michael", "last_name": "Chen", "role": "Product Designer", "email": "mchen@example.com", "score": 88}', 'shortlisted'),
('11111111-1111-1111-1111-111111111111', '{"first_name": "Elena", "last_name": "Rodriguez", "role": "Backend Engineer", "email": "elena.r@example.com", "score": 91}', 'new')
ON CONFLICT DO NOTHING;
