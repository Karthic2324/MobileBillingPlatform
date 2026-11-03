-- Run this once in Supabase -> SQL Editor.

-- 1. GST per product / per invoice line
alter table products      add column if not exists gst_percent numeric default 0;
alter table invoice_items add column if not exists gst_percent numeric;

-- 2. Vendor invoice settings the controller can edit
alter table profiles add column if not exists address          text;
alter table profiles add column if not exists invoice_prefix   text;
alter table profiles add column if not exists invoice_start_no integer default 1001;
alter table profiles add column if not exists bank_name        text;
alter table profiles add column if not exists account_no       text;
alter table profiles add column if not exists ifsc_code        text;
alter table profiles add column if not exists gstin            text;
alter table profiles add column if not exists phone            text;

-- 3. Track edits on invoices
alter table invoices add column if not exists updated_at timestamptz;

-- 4. Let a vendor edit ONLY their own invoices and lines (needed for the Edit option).
--    Skip a policy if you already have an equivalent one.
alter table invoices      enable row level security;
alter table invoice_items enable row level security;

drop policy if exists "vendor updates own invoices" on invoices;
create policy "vendor updates own invoices" on invoices
  for update using (vendor_id = auth.uid()) with check (vendor_id = auth.uid());

drop policy if exists "vendor manages own invoice items" on invoice_items;
create policy "vendor manages own invoice items" on invoice_items
  for all using (vendor_id = auth.uid()) with check (vendor_id = auth.uid());


-- ===== Fix pack (run this too) =====

-- 5. Keep invoice rows in the order they were entered
alter table invoice_items add column if not exists line_no integer;

-- 6. Controller (ADMIN) permissions. Without these, Supabase silently refuses the
--    controller's edits to vendor profiles, so changes "do not stick".
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN');
$$;

drop policy if exists "admin reads all profiles" on profiles;
create policy "admin reads all profiles" on profiles for select using (public.is_admin());

drop policy if exists "admin updates all profiles" on profiles;
create policy "admin updates all profiles" on profiles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manages all invoices" on invoices;
create policy "admin manages all invoices" on invoices
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manages all invoice items" on invoice_items;
create policy "admin manages all invoice items" on invoice_items
  for all using (public.is_admin()) with check (public.is_admin());

-- A vendor must be able to read their own profile (needed to show the controller's changes)
drop policy if exists "vendor reads own profile" on profiles;
create policy "vendor reads own profile" on profiles for select using (id = auth.uid());
