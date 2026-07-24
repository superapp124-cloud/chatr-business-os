-- Fix permissions for the profiles view
GRANT SELECT ON public.profiles TO anon, authenticated;

-- Ensure the view uses the invoker's permissions so RLS on users table applies correctly
ALTER VIEW public.profiles SET (security_invoker = true);
