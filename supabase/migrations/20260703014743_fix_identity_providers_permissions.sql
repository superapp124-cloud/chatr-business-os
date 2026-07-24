-- Grant necessary privileges to service_role so auth Edge Functions can
-- sync auth users and upsert identity-provider mappings.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO service_role;
GRANT ALL PRIVILEGES ON public.identity_providers TO service_role;
