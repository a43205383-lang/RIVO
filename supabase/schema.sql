-- Canonical RIVO schema for a clean Supabase project.
-- Run once in Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('employee', 'accountant');
create type public.expense_status as enum ('draft', 'needs_review', 'confirmed', 'approved', 'rejected');
create type public.expense_category as enum ('alimentos', 'combustible', 'transporte', 'oficina', 'servicios', 'otros');
create type public.payment_method as enum ('efectivo', 'tarjeta', 'transferencia', 'otro');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  role public.user_role not null default 'employee',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  merchant text,
  merchant_normalized text generated always as
    (lower(regexp_replace(trim(coalesce(merchant, '')), '\s+', ' ', 'g'))) stored,
  expense_date date,
  currency text not null default 'DOP' check (currency in ('DOP', 'USD')),
  subtotal numeric(14,2) check (subtotal is null or subtotal >= 0),
  tax numeric(14,2) check (tax is null or tax >= 0),
  tip numeric(14,2) check (tip is null or tip >= 0),
  total numeric(14,2) check (total is null or total >= 0),
  payment_method public.payment_method,
  rnc text,
  ncf text,
  category public.expense_category not null default 'otros',
  notes text,
  status public.expense_status not null default 'draft',
  ai_confidence jsonb,
  ai_notes text,
  review_reason text,
  approval_comment text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_reviewer_fields_check check (
    (reviewed_by is null and reviewed_at is null) or (reviewed_by is not null and reviewed_at is not null)
  )
);

create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity >= 0),
  unit_price numeric(14,2) check (unit_price is null or unit_price >= 0),
  line_total numeric(14,2) check (line_total is null or line_total >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.expense_images (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  storage_path text not null unique,
  thumb_path text,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  image_hash text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('extract','ask')),
  status text not null default 'started' check (status in ('started','succeeded','failed')),
  created_at timestamptz not null default now()
);

create index expenses_user_date_idx on public.expenses(user_id, expense_date desc);
create index expenses_status_date_idx on public.expenses(status, expense_date desc);
create index expenses_merchant_normalized_idx on public.expenses(merchant_normalized);
create index expense_items_expense_idx on public.expense_items(expense_id, position);
create index expense_images_expense_idx on public.expense_images(expense_id, position);
create unique index expense_images_hash_uidx on public.expense_images(expense_id, image_hash) where image_hash is not null;
create index ai_usage_user_created_idx on public.ai_usage(user_id, created_at desc);

create or replace function public.is_accountant()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'accountant');
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
  if new.role is distinct from old.role
    and not public.is_accountant()
    and current_user not in ('postgres','supabase_auth_admin','service_role')
    and current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
  then raise exception 'Only an administrator can change account roles'; end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email,full_name)
  values(new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data ->> 'full_name',''))
  on conflict(id) do update set email = excluded.email,
    full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger profiles_protect_role before update on public.profiles for each row execute function public.protect_profile_role();
create trigger expenses_set_updated_at before update on public.expenses for each row execute function public.set_updated_at();

create or replace function public.approve_expense(p_expense_id uuid,p_comment text default null)
returns public.expenses language plpgsql security invoker set search_path = '' as $$
declare result public.expenses;
begin
  if not public.is_accountant() then raise exception 'Accountant role required'; end if;
  update public.expenses set status='approved',approval_comment=p_comment,reviewed_by=(select auth.uid()),reviewed_at=now()
  where id=p_expense_id and status in ('confirmed','needs_review') returning * into result;
  if not found then raise exception 'Expense not found or not awaiting review'; end if;
  return result;
end;
$$;

create or replace function public.reject_expense(p_expense_id uuid,p_comment text)
returns public.expenses language plpgsql security invoker set search_path = '' as $$
declare result public.expenses;
begin
  if not public.is_accountant() then raise exception 'Accountant role required'; end if;
  if nullif(trim(p_comment),'') is null then raise exception 'A rejection comment is required'; end if;
  update public.expenses set status='rejected',approval_comment=p_comment,reviewed_by=(select auth.uid()),reviewed_at=now()
  where id=p_expense_id and status in ('confirmed','needs_review') returning * into result;
  if not found then raise exception 'Expense not found or not awaiting review'; end if;
  return result;
end;
$$;

create or replace function public.get_monthly_summary(p_from date,p_to date,p_currency text,p_scope_all boolean default false)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_currency not in ('DOP','USD') then raise exception 'Unsupported currency'; end if;
  if p_scope_all and not public.is_accountant() then raise exception 'Accountant role required'; end if;
  select jsonb_build_object(
    'total',coalesce(sum(e.total) filter(where e.status='approved'),0),
    'count',count(*) filter(where e.status='approved'),
    'pending_total',coalesce(sum(e.total) filter(where e.status in ('confirmed','needs_review')),0),
    'pending_count',count(*) filter(where e.status in ('confirmed','needs_review')),
    'categories',coalesce((select jsonb_agg(jsonb_build_object('category',c.category,'total',c.total,'count',c.count))
      from (select e2.category,coalesce(sum(e2.total),0) total,count(*) count from public.expenses e2
        where e2.expense_date between p_from and p_to and e2.currency=p_currency and e2.status='approved'
          and (e2.user_id=(select auth.uid()) or (p_scope_all and public.is_accountant())) group by e2.category)c),'[]'::jsonb)
  ) into result from public.expenses e where e.expense_date between p_from and p_to and e.currency=p_currency
    and (e.user_id=(select auth.uid()) or (p_scope_all and public.is_accountant()));
  return result;
end;
$$;
revoke all on function public.approve_expense(uuid,text),public.reject_expense(uuid,text),public.get_monthly_summary(date,date,text,boolean) from public;
grant execute on function public.approve_expense(uuid,text),public.reject_expense(uuid,text),public.get_monthly_summary(date,date,text,boolean) to authenticated;

alter table public.profiles enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_items enable row level security;
alter table public.expense_images enable row level security;
alter table public.ai_usage enable row level security;

create policy "Read own profile or all profiles as accountant" on public.profiles for select to authenticated
  using(id=(select auth.uid()) or (select public.is_accountant()));
create policy "Create own employee profile" on public.profiles for insert to authenticated
  with check(id=(select auth.uid()) and role='employee');
create policy "Update own profile or manage profiles as accountant" on public.profiles for update to authenticated
  using(id=(select auth.uid()) or (select public.is_accountant())) with check(id=(select auth.uid()) or (select public.is_accountant()));

create policy "Read own expenses or all as accountant" on public.expenses for select to authenticated
  using(user_id=(select auth.uid()) or (select public.is_accountant()));
create policy "Create own expenses" on public.expenses for insert to authenticated
  with check(user_id=(select auth.uid()) and reviewed_by is null and reviewed_at is null);
create policy "Update own unreviewed expenses" on public.expenses for update to authenticated
  using(user_id=(select auth.uid()) and status in ('draft','needs_review','confirmed'))
  with check(user_id=(select auth.uid()) and reviewed_by is null and reviewed_at is null);
create policy "Accountants review expenses" on public.expenses for update to authenticated
  using((select public.is_accountant())) with check((select public.is_accountant()));
create policy "Delete own unreviewed expenses or all as accountant" on public.expenses for delete to authenticated
  using((user_id=(select auth.uid()) and status in ('draft','needs_review','confirmed')) or (select public.is_accountant()));

create policy "Read items for accessible expenses" on public.expense_items for select to authenticated using(exists(
  select 1 from public.expenses e where e.id=expense_id and (e.user_id=(select auth.uid()) or (select public.is_accountant()))));
create policy "Add items to own unreviewed expenses" on public.expense_items for insert to authenticated with check(exists(
  select 1 from public.expenses e where e.id=expense_id and e.user_id=(select auth.uid()) and e.status in ('draft','needs_review','confirmed')));
create policy "Update items on own unreviewed expenses" on public.expense_items for update to authenticated using(exists(
  select 1 from public.expenses e where e.id=expense_id and e.user_id=(select auth.uid()) and e.status in ('draft','needs_review','confirmed')))
  with check(exists(select 1 from public.expenses e where e.id=expense_id and e.user_id=(select auth.uid()) and e.status in ('draft','needs_review','confirmed')));
create policy "Delete accessible expense items" on public.expense_items for delete to authenticated using(exists(
  select 1 from public.expenses e where e.id=expense_id and ((e.user_id=(select auth.uid()) and e.status in ('draft','needs_review','confirmed')) or (select public.is_accountant()))));

create policy "Read images for accessible expenses" on public.expense_images for select to authenticated using(exists(
  select 1 from public.expenses e where e.id=expense_id and (e.user_id=(select auth.uid()) or (select public.is_accountant()))));
create policy "Manage images for own unreviewed expenses" on public.expense_images for all to authenticated using(exists(
  select 1 from public.expenses e where e.id=expense_id and e.user_id=(select auth.uid()) and e.status in ('draft','needs_review','confirmed')))
  with check(exists(select 1 from public.expenses e where e.id=expense_id and e.user_id=(select auth.uid()) and e.status in ('draft','needs_review','confirmed')));
create policy "Read own AI usage or all as accountant" on public.ai_usage for select to authenticated
  using(user_id=(select auth.uid()) or (select public.is_accountant()));
create policy "Create own AI usage records" on public.ai_usage for insert to authenticated with check(user_id=(select auth.uid()));
create policy "Update own AI usage records" on public.ai_usage for update to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('receipts','receipts',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy "Read own receipt objects or all as accountant" on storage.objects for select to authenticated
  using(bucket_id='receipts' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_accountant())));
create policy "Upload receipt objects to own folder" on storage.objects for insert to authenticated
  with check(bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Update own receipt objects" on storage.objects for update to authenticated
  using(bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check(bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Delete own receipt objects or all as accountant" on storage.objects for delete to authenticated
  using(bucket_id='receipts' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_accountant())));
