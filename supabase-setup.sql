create table if not exists public.apartments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  type text not null,
  area numeric not null,
  bedrooms integer not null default 0,
  bathrooms integer not null default 0,
  floor text not null default '',
  furnishing text not null default '',
  price numeric not null,
  status text not null default 'Available',
  location text not null default '',
  certificate text not null default '',
  description text not null default '',
  photos text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.apartments
  add column if not exists transaction_type text not null default 'Jual',
  add column if not exists rent_period text;

alter table public.apartments enable row level security;

drop policy if exists "Public can read apartment listings" on public.apartments;
create policy "Public can read apartment listings"
  on public.apartments for select
  using (true);

drop policy if exists "Authenticated admins can manage apartment listings" on public.apartments;
create policy "Authenticated admins can manage apartment listings"
  on public.apartments for all
  to authenticated
  using (true)
  with check (true);

grant select on public.apartments to anon, authenticated;
grant insert, update, delete on public.apartments to authenticated;

insert into storage.buckets (id, name, public)
values ('apartment-photos', 'apartment-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can view apartment photos" on storage.objects;
create policy "Public can view apartment photos"
  on storage.objects for select
  using (bucket_id = 'apartment-photos');

drop policy if exists "Authenticated admins can upload apartment photos" on storage.objects;
create policy "Authenticated admins can upload apartment photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'apartment-photos');

drop policy if exists "Authenticated admins can update apartment photos" on storage.objects;
create policy "Authenticated admins can update apartment photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'apartment-photos')
  with check (bucket_id = 'apartment-photos');

drop policy if exists "Authenticated admins can delete apartment photos" on storage.objects;
create policy "Authenticated admins can delete apartment photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'apartment-photos');
