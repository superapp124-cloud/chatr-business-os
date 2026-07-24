-- Ensure the authenticated role has access to the tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;

-- Ensure usage on schema public
GRANT USAGE ON SCHEMA public TO authenticated;
