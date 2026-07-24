alter table public.users add column if not exists phone_number text;
alter table public.users add column if not exists email text;
alter table public.users add column if not exists onboarding_completed boolean default false;

create unique index if not exists users_phone_number_key on public.users(phone_number);
create unique index if not exists users_email_key on public.users(email);
