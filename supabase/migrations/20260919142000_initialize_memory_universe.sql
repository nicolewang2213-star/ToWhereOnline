create extension if not exists pgcrypto;

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  main_image text not null default '',
  lng double precision,
  lat double precision,
  departure text,
  color text default '#ffff00',
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.city_images (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  url text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.firsts (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  description text not null,
  created_at timestamptz default now()
);

create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  sender text,
  recipient text,
  date text,
  content text,
  is_draft boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  date date not null,
  keyword text not null,
  quality text not null check (quality in ('high', 'medium', 'low', 'none')),
  created_at timestamptz default now(),
  unique (user_id, date, keyword)
);

create table if not exists public.keyword_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  keyword text not null,
  content text not null,
  is_completed boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.towhere_logs (
  id bigint primary key,
  content text not null default '',
  updated_at timestamptz default now()
);

alter table public.cities enable row level security;
alter table public.city_images enable row level security;
alter table public.firsts enable row level security;
alter table public.letters enable row level security;
alter table public.app_config enable row level security;
alter table public.checkins enable row level security;
alter table public.keyword_tasks enable row level security;
alter table public.towhere_logs enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'cities', 'city_images', 'firsts', 'letters', 'app_config',
    'checkins', 'keyword_tasks', 'towhere_logs'
  ] loop
    execute format('drop policy if exists "Public read memory site" on public.%I', table_name);
    execute format('drop policy if exists "Authenticated write memory site" on public.%I', table_name);
    execute format(
      'create policy "Public read memory site" on public.%I for select to anon, authenticated using (true)',
      table_name
    );
    execute format(
      'create policy "Authenticated write memory site" on public.%I for all to authenticated using (true) with check (true)',
      table_name
    );
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('firsts-images', 'firsts-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read firsts images" on storage.objects;
create policy "Public read firsts images"
on storage.objects for select
to public
using (bucket_id = 'firsts-images');

drop policy if exists "Authenticated upload firsts images" on storage.objects;
create policy "Authenticated upload firsts images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'firsts-images');

drop policy if exists "Authenticated update firsts images" on storage.objects;
create policy "Authenticated update firsts images"
on storage.objects for update
to authenticated
using (bucket_id = 'firsts-images')
with check (bucket_id = 'firsts-images');

drop policy if exists "Authenticated delete firsts images" on storage.objects;
create policy "Authenticated delete firsts images"
on storage.objects for delete
to authenticated
using (bucket_id = 'firsts-images');
