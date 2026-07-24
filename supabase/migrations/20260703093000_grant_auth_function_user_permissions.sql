-- Allow public auth Edge Functions invoked with the service-role key to
-- mirror auth.users into public.users during identity exchange.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO service_role;
