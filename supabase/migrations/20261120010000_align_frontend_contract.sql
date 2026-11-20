-- Upgrade the original RIVO schema to the current frontend contract.
-- Safe to apply after 20261120000000_initial_schema.sql; preserves existing rows.

create extension if not exists pgcrypto with schema extensions;

-- Keep both original enum names and add the current frontend enum names/values.
do $$ begin
  create type public.user_role as enum ('employee', 'accountant');
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.expense_status add value if not exists 'needs_review';
  alter type public.expense_status add value if not exists 'confirmed';
  alter type public.expense_status add value if not exists 'approved';
  alter type public.expense_status add value if not exists 'rejected';
exception when undefined_object then
  create type public.expense_status as enum ('draft', 'needs_review', 'confirmed', 'approved', 'rejected');
end $$;
do $$ begin
  create type public.payment_method as enum ('efectivo', 'tarjeta', 'transferencia', 'otro');
exception when duplicate_object then null; end $$;

-- Align legacy role type to the current enum without changing role values.
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists full_name text not null default '';
do $$ begin
  alter table public.profiles alter column role drop default;
  alter table public.profiles alter column role type public.user_role using role::text::public.user_role;
  alter table public.profiles alter column role set default 'employee'::public.user_role;
exception when undefined_column then
  alter table public.profiles add column role public.user_role not null default 'employee';
end $$;

alter table public.expenses add column if not exists merchant_normalized text
  generated always as (lower(regexp_replace(trim(coalesce(merchant, '')), '\s+', ' ', 'g'))) stored;
alter table public.expenses add column if not exists rnc text;
alter table public.expenses add column if not exists notes text;
alter table public.expenses add column if not exists ai_notes text;
alter table public.expenses add column if not exists review_reason text;
alter table public.expenses add column if not exists approval_comment text;
alter table public.expenses add column if not exists submitted_at timestamptz;
alter table public.expenses add column if not exists ai_confidence jsonb;
alter table public.expenses alter column currency type text using currency::text;
alter table public.expenses alter column currency set default 'DOP';
alter table public.expenses add constraint expenses_currency_check check (currency in ('DOP', 'USD'));
alter table public.expenses alter column status type public.expense_status using status::text::public.expense_status;
alter table public.expenses alter column status set default 'draft'::public.expense_status;
alter table public.expenses alter column payment_method type public.payment_method
  using case when payment_method is null then null else payment_method::text::public.payment_method end;

-- Original version stored image paths on expenses. Preserve them in normalized rows.
create table if not exists public.expense_images (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  storage_path text not null unique,
  thumb_path text,
  mime_type text not null default 'image/jpeg' check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null default 1 check (size_bytes > 0 and size_bytes <= 1572864),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  image_hash text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
insert into public.expense_images (expense_id, storage_path, position)
select e.id, p.path, p.ordinality::integer - 1
from public.expenses e
cross join lateral unnest(e.image_paths) with ordinality as p(path, ordinality)
where p.path is not null and p.path <> ''
on conflict (storage_path) do nothing;

alter table public.expense_items alter column quantity set default 1;
alter table public.expense_items alter column quantity set not null;
alter table public.expense_items add column if not exists position integer not null default 0;

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('extract', 'ask')),
  status text not null default 'started' check (status in ('started', 'succeeded', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists expenses_merchant_normalized_idx on public.expenses (merchant_normalized);
create index if not exists expense_items_expense_idx on public.expense_items (expense_id, position);
create index if not exists expense_images_expense_idx on public.expense_images (expense_id, position);
create unique index if not exists expense_images_hash_uidx on public.expense_images (expense_id, image_hash) where image_hash is not null;
create index if not exists ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

create or replace function public.is_accountant()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text = 'accountant');
$$;
revoke all on function public.is_accountant() from public;
grant execute on function public.is_accountant() to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role is distinct from old.role and not public.is_accountant() then
    raise exception 'Only an accountant can change account roles';
  end if;
  return new;
end;
$$;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email,
    full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles for each row execute function public.protect_profile_role();
drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at before update on public.expenses for each row execute function public.set_updated_at();

create or replace function public.approve_expense(p_expense_id uuid, p_comment text default null)
returns public.expenses language plpgsql security invoker set search_path = '' as $$
declare result public.expenses;
begin
  if not public.is_accountant() then raise exception 'Accountant role required'; end if;
  update public.expenses set status = 'approved', approval_comment = p_comment,
    reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = p_expense_id and status in ('confirmed', 'needs_review') returning * into result;
  if not found then raise exception 'Expense not found or not awaiting review'; end if;
  return result;
end;
$$;
create or replace function public.reject_expense(p_expense_id uuid, p_comment text)
returns public.expenses language plpgsql security invoker set search_path = '' as $$
declare result public.expenses;
begin
  if not public.is_accountant() then raise exception 'Accountant role required'; end if;
  if nullif(trim(p_comment), '') is null then raise exception 'A rejection comment is required'; end if;
  update public.expenses set status = 'rejected', approval_comment = p_comment,
    reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = p_expense_id and status in ('confirmed', 'needs_review') returning * into result;
  if not found then raise exception 'Expense not found or not awaiting review'; end if;
  return result;
end;
$$;
create or replace function public.get_monthly_summary(p_from date, p_to date, p_currency text, p_scope_all boolean default false)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_currency not in ('DOP', 'USD') then raise exception 'Unsupported currency'; end if;
  if p_scope_all and not public.is_accountant() then raise exception 'Accountant role required'; end if;
  select jsonb_build_object(
    'total', coalesce(sum(e.total) filter (where e.status = 'approved'), 0),
    'count', count(*) filter (where e.status = 'approved'),
    'pending_total', coalesce(sum(e.total) filter (where e.status in ('confirmed', 'needs_review')), 0),
    'pending_count', count(*) filter (where e.status in ('confirmed', 'needs_review')),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('category', c.category, 'total', c.total, 'count', c.count))
      from (select e2.category, coalesce(sum(e2.total), 0) total, count(*) count from public.expenses e2
        where e2.expense_date >= p_from and e2.expense_date <= p_to and e2.currency = p_currency and e2.status = 'approved'
          and (e2.user_id = (select auth.uid()) or (p_scope_all and public.is_accountant())) group by e2.category) c), '[]'::jsonb)
  ) into result from public.expenses e
  where e.expense_date >= p_from and e.expense_date <= p_to and e.currency = p_currency
    and (e.user_id = (select auth.uid()) or (p_scope_all and public.is_accountant()));
  return result;
end;
$$;
revoke all on function public.approve_expense(uuid, text), public.reject_expense(uuid, text), public.get_monthly_summary(date, date, text, boolean) from public;
grant execute on function public.approve_expense(uuid, text), public.reject_expense(uuid, text), public.get_monthly_summary(date, date, text, boolean) to authenticated;

alter table public.profiles enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_items enable row level security;
alter table public.expense_images enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists "Users read own profile; accountants read all" on public.profiles;
drop policy if exists "Users create own employee profile" on public.profiles;
drop policy if exists "Users update own profile; accountants manage profiles" on public.profiles;
drop policy if exists "Read own profile or all profiles as accountant" on public.profiles;
drop policy if exists "Create own employee profile" on public.profiles;
drop policy if exists "Update own profile or manage profiles as accountant" on public.profiles;
create policy "Read own profile or all profiles as accountant" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_accountant()));
create policy "Create own employee profile" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and role::text = 'employee');
create policy "Update own profile or manage profiles as accountant" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_accountant()))
  with check (id = (select auth.uid()) or (select public.is_accountant()));

drop policy if exists "Employees read own expenses; accountants read all" on public.expenses;
drop policy if exists "Employees create own expenses" on public.expenses;
drop policy if exists "Employees update own unreviewed expenses" on public.expenses;
drop policy if exists "Accountants review expenses" on public.expenses;
drop policy if exists "Employees delete own unreviewed expenses; accountants delete all" on public.expenses;
drop policy if exists "Read own expenses or all as accountant" on public.expenses;
drop policy if exists "Create own expenses" on public.expenses;
drop policy if exists "Update own unreviewed expenses" on public.expenses;
drop policy if exists "Delete own unreviewed expenses or all as accountant" on public.expenses;
create policy "Read own expenses or all as accountant" on public.expenses for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_accountant()));
create policy "Create own expenses" on public.expenses for insert to authenticated
  with check (user_id = (select auth.uid()) and reviewed_by is null and reviewed_at is null);
create policy "Update own unreviewed expenses" on public.expenses for update to authenticated
  using (user_id = (select auth.uid()) and status in ('draft', 'needs_review', 'confirmed'))
  with check (user_id = (select auth.uid()) and reviewed_by is null and reviewed_at is null);
create policy "Accountants review expenses" on public.expenses for update to authenticated
  using ((select public.is_accountant())) with check ((select public.is_accountant()));
create policy "Delete own unreviewed expenses or all as accountant" on public.expenses for delete to authenticated
  using ((user_id = (select auth.uid()) and status in ('draft', 'needs_review', 'confirmed')) or (select public.is_accountant()));

drop policy if exists "Read items for accessible expenses" on public.expense_items;
drop policy if exists "Employees add items to own unreviewed expenses" on public.expense_items;
drop policy if exists "Employees update items on own unreviewed expenses" on public.expense_items;
drop policy if exists "Employees delete items on own unreviewed expenses; accountants delete all" on public.expense_items;
drop policy if exists "Add items to own unreviewed expenses" on public.expense_items;
drop policy if exists "Update items on own unreviewed expenses" on public.expense_items;
drop policy if exists "Delete accessible expense items" on public.expense_items;
create policy "Read items for accessible expenses" on public.expense_items for select to authenticated using (exists (
  select 1 from public.expenses e where e.id = expense_id and (e.user_id = (select auth.uid()) or (select public.is_accountant()))));
create policy "Add items to own unreviewed expenses" on public.expense_items for insert to authenticated with check (exists (
  select 1 from public.expenses e where e.id = expense_id and e.user_id = (select auth.uid()) and e.status in ('draft', 'needs_review', 'confirmed')));
create policy "Update items on own unreviewed expenses" on public.expense_items for update to authenticated using (exists (
  select 1 from public.expenses e where e.id = expense_id and e.user_id = (select auth.uid()) and e.status in ('draft', 'needs_review', 'confirmed')))
  with check (exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = (select auth.uid()) and e.status in ('draft', 'needs_review', 'confirmed')));
create policy "Delete accessible expense items" on public.expense_items for delete to authenticated using (exists (
  select 1 from public.expenses e where e.id = expense_id and ((e.user_id = (select auth.uid()) and e.status in ('draft', 'needs_review', 'confirmed')) or (select public.is_accountant()))));

drop policy if exists "Read images for accessible expenses" on public.expense_images;
drop policy if exists "Manage images for own unreviewed expenses" on public.expense_images;
create policy "Read images for accessible expenses" on public.expense_images for select to authenticated using (exists (
  select 1 from public.expenses e where e.id = expense_id and (e.user_id = (select auth.uid()) or (select public.is_accountant()))));
create policy "Manage images for own unreviewed expenses" on public.expense_images for all to authenticated using (exists (
  select 1 from public.expenses e where e.id = expense_id and e.user_id = (select auth.uid()) and e.status in ('draft', 'needs_review', 'confirmed')))
  with check (exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = (select auth.uid()) and e.status in ('draft', 'needs_review', 'confirmed')));
drop policy if exists "Read own AI usage or all as accountant" on public.ai_usage;
drop policy if exists "Create own AI usage records" on public.ai_usage;
drop policy if exists "Update own AI usage records" on public.ai_usage;
create policy "Read own AI usage or all as accountant" on public.ai_usage for select to authenticated using (user_id = (select auth.uid()) or (select public.is_accountant()));
create policy "Create own AI usage records" on public.ai_usage for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Update own AI usage records" on public.ai_usage for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 1572864, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Users read own receipt images; accountants read all" on storage.objects;
drop policy if exists "Users upload receipt images into own folder" on storage.objects;
drop policy if exists "Users update own receipt images" on storage.objects;
drop policy if exists "Users delete own receipt images; accountants delete all" on storage.objects;
drop policy if exists "Read own receipt objects or all as accountant" on storage.objects;
drop policy if exists "Upload receipt objects to own folder" on storage.objects;
drop policy if exists "Update own receipt objects" on storage.objects;
drop policy if exists "Delete own receipt objects or all as accountant" on storage.objects;
create policy "Read own receipt objects or all as accountant" on storage.objects for select to authenticated using (
  bucket_id = 'receipts' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_accountant())));
create policy "Upload receipt objects to own folder" on storage.objects for insert to authenticated with check (
  bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Update own receipt objects" on storage.objects for update to authenticated using (
  bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own receipt objects or all as accountant" on storage.objects for delete to authenticated using (
  bucket_id = 'receipts' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_accountant())));
