-- Update the existing test user to have the correct email
UPDATE auth.users 
SET email = '919717845477@chatr.local' 
WHERE email = '9717845477@chatr.local';

UPDATE auth.identities 
SET identity_data = json_build_object('sub', user_id::text, 'email', '919717845477@chatr.local')
WHERE provider = 'email' AND identity_data->>'email' = '9717845477@chatr.local';

UPDATE public.users 
SET email = '919717845477@chatr.local' 
WHERE email = '9717845477@chatr.local';
