DELETE FROM auth.users WHERE email = '919717845477@chatr.chat';
DELETE FROM auth.identities WHERE identity_data->>'email' = '919717845477@chatr.chat';
DELETE FROM public.users WHERE email = '919717845477@chatr.chat';
