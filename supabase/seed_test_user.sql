-- Seed test user for +919717845477

DO $$ 
DECLARE 
  new_user_id uuid := gen_random_uuid();
  user_email text := '919717845477@chatr.local';
  user_phone text := '+919717845477';
  user_password text := '+919717845477';
BEGIN
  -- 1. Insert into auth.users
  INSERT INTO auth.users (
    id, 
    instance_id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    raw_app_meta_data, 
    raw_user_meta_data, 
    aud, 
    role
  ) VALUES (
    new_user_id, 
    '00000000-0000-0000-0000-000000000000', 
    user_email, 
    crypt(user_password, gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    json_build_object('phone_number', user_phone, 'username', 'TestUser'), 
    'authenticated', 
    'authenticated'
  );

  -- 2. Insert into auth.identities
  INSERT INTO auth.identities (
    id, 
    user_id, 
    provider_id, 
    identity_data, 
    provider, 
    last_sign_in_at, 
    created_at, 
    updated_at
  ) VALUES (
    gen_random_uuid(), 
    new_user_id, 
    new_user_id::text, 
    json_build_object('sub', new_user_id::text, 'email', user_email), 
    'email', 
    now(), 
    now(), 
    now()
  );

  -- 3. Insert into public.users
  INSERT INTO public.users (
    id, 
    phone_number, 
    email, 
    username, 
    onboarding_completed
  ) VALUES (
    new_user_id, 
    user_phone, 
    user_email, 
    'TestUser', 
    true
  );

END $$;
