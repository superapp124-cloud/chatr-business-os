UPDATE auth.users 
SET email = '919717845477@chatr.chat' 
WHERE email = '919717845477@chatr.local';

UPDATE auth.identities 
SET identity_data = json_build_object('sub', user_id::text, 'email', '919717845477@chatr.chat')
WHERE provider = 'email' AND identity_data->>'email' = '919717845477@chatr.local';

UPDATE public.users 
SET email = '919717845477@chatr.chat' 
WHERE email = '919717845477@chatr.local';
