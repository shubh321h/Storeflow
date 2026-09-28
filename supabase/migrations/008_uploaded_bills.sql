-- ============================================================
-- Upload Media Bills
--
-- Shop owners photograph / pick a handwritten or digital bill and
-- store it as private media together with manually-entered
-- metadata (customer, amount, Paid/Credit). No OCR: the image is
-- only stored, never parsed.
--
-- Lifecycle
--   Paid   -> media + row are deleted 7 days after upload.
--   Credit -> kept indefinitely until "Mark Paid"; then paid_at is
--             saved and the 7-day deletion clock starts.
--             An unpaid credit bill is NEVER auto-deleted (enforced
--             by a CHECK constraint AND by the purge function).
--
-- Storage files can only be removed through the Storage API (deleting
-- storage.objects rows from SQL orphans the file). So deletion is done
-- by the `purge-expired-bills` Edge Function, invoked every 15 minutes
-- by pg_cron + pg_net. It does not depend on the mobile app.
--
-- Ledger
--   Uploaded bills are separate from `sales`/`invoices`. Only a
--   CREDIT bill touches the customer ledger:
--     upload      -> debit  (customers.balance += amount)
--     Mark Paid   -> credit (customers.balance -= amount)
--   Both are written in the same transaction as the bill row, so they
--   net to zero. Ledger rows are NOT deleted when the bill is purged.
--   A PAID upload never touches the ledger (nothing is outstanding).
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;


-- ------------------------------------------------------------
-- Table
-- ------------------------------------------------------------

create table public.uploaded_bills (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- If a customer row is ever deleted, paid bills keep existing (set null).
  -- Credit bills cannot lose their customer (see credit_customer check), so
  -- a customer with an unpaid uploaded credit bill cannot be deleted.
  customer_id uuid references public.customers(id) on delete set null,
  media_path text not null unique,
  bill_type text not null check (bill_type in ('handwritten', 'digital')),
  amount numeric(14,2) not null check (amount > 0),
  payment_status text not null check (payment_status in ('paid', 'credit')),
  uploaded_at timestamptz not null default now(),
  paid_at timestamptz,
  delete_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- paid   => always scheduled for deletion
  -- credit => never scheduled, never has paid_at
  constraint uploaded_bills_lifecycle check (
    (payment_status = 'paid' and delete_after is not null)
    or (payment_status = 'credit' and delete_after is null and paid_at is null)
  ),
  constraint uploaded_bills_credit_customer check (
    payment_status <> 'credit' or customer_id is not null
  ),
  -- Media must live under the owning business's folder.
  constraint uploaded_bills_media_path check (
    media_path like business_id::text || '/%'
  )
);

create trigger uploaded_bills_updated_at
  before update on public.uploaded_bills
  for each row execute function public.set_updated_at();

create index idx_uploaded_bills_business_uploaded
  on public.uploaded_bills(business_id, uploaded_at desc);
create index idx_uploaded_bills_customer
  on public.uploaded_bills(customer_id);
-- Used by the purge job: only rows that are actually scheduled.
create index idx_uploaded_bills_delete_after
  on public.uploaded_bills(delete_after)
  where delete_after is not null;


-- ------------------------------------------------------------
-- Row Level Security
--
-- Same helper as every other StoreFlow table (has_business_access).
-- Unlike the other tables this is SELECT-only for clients: inserts and
-- lifecycle changes go through the two RPCs below, so a client cannot
-- postpone delete_after, flip a credit bill to paid without the ledger
-- entry, or otherwise bypass the lifecycle.
-- ------------------------------------------------------------

alter table public.uploaded_bills enable row level security;

revoke all on public.uploaded_bills from anon, authenticated;
grant select on public.uploaded_bills to authenticated;

create policy uploaded_bills_select on public.uploaded_bills
  for select using (public.has_business_access(business_id));


-- ------------------------------------------------------------
-- Private Storage bucket + policies
--
-- Path convention: <business_id>/<bill_id>.<ext>
-- The bucket is private: there are no public URLs; the app requests
-- short-lived signed URLs, which requires the SELECT policy below.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploaded-bills', 'uploaded-bills', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Safely extract the business id from the first path segment.
-- Returns NULL (=> no access) instead of raising on malformed paths.
create or replace function public.uploaded_bill_path_business_id(object_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when split_part(object_name, '/', 1)
         ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;

create policy uploaded_bills_media_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'uploaded-bills'
    and public.has_business_access(public.uploaded_bill_path_business_id(name))
  );

create policy uploaded_bills_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploaded-bills'
    and public.has_business_access(public.uploaded_bill_path_business_id(name))
  );

-- Clients may only delete ORPHANED uploads (a file whose bill row was never
-- created, e.g. the RPC failed after the upload). Files that belong to a bill
-- can only be removed by the purge job (service role).
create policy uploaded_bills_media_delete_orphan on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'uploaded-bills'
    and public.has_business_access(public.uploaded_bill_path_business_id(name))
    and not exists (
      select 1 from public.uploaded_bills b where b.media_path = objects.name
    )
  );


-- ------------------------------------------------------------
-- RPC: create an uploaded bill (and, for credit, the ledger debit)
-- SECURITY DEFINER because clients have no INSERT/UPDATE rights on the
-- table; every statement is scoped by business_id and access is checked
-- explicitly up front.
-- ------------------------------------------------------------

create or replace function public.create_uploaded_bill_atomic(
  payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bill_id uuid := (payload->>'id')::uuid;
  target_business_id uuid := (payload->>'businessId')::uuid;
  target_customer_id uuid := nullif(payload->>'customerId', '')::uuid;
  media text := payload->>'mediaPath';
  kind text := payload->>'billType';
  status text := payload->>'paymentStatus';
  bill_amount numeric := round((payload->>'amount')::numeric, 2);
  now_ts timestamptz := now();
  updated_balance numeric;
begin

  if bill_id is null
     or target_business_id is null
     or media is null
     or bill_amount is null
     or bill_amount <= 0
     or kind is null
     or kind not in ('handwritten', 'digital')
     or status is null
     or status not in ('paid', 'credit')
  then
    raise exception 'Invalid uploaded bill';
  end if;

  if not public.has_business_access(target_business_id) then
    raise exception 'Business access denied';
  end if;

  if left(media, length(target_business_id::text) + 1) <> target_business_id::text || '/' then
    raise exception 'Bill media path does not belong to this business';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'uploaded-bills' and o.name = media
  ) then
    raise exception 'Bill media was not uploaded';
  end if;

  if status = 'credit' and target_customer_id is null then
    raise exception 'A customer is required for a credit bill';
  end if;

  if target_customer_id is not null and not exists (
    select 1 from public.customers c
    where c.id = target_customer_id and c.business_id = target_business_id
  ) then
    raise exception 'Selected customer was not found for this business';
  end if;

  insert into public.uploaded_bills (
    id, business_id, customer_id, media_path, bill_type, amount,
    payment_status, uploaded_at, paid_at, delete_after
  )
  values (
    bill_id, target_business_id, target_customer_id, media, kind, bill_amount,
    status, now_ts, null,
    case when status = 'paid' then now_ts + interval '7 days' end
  );

  if status = 'credit' then

    update public.customers as c
    set balance = c.balance + bill_amount, updated_at = now()
    where c.id = target_customer_id
      and c.business_id = target_business_id
    returning c.balance into updated_balance;

    if updated_balance is null then
      raise exception 'Failed to update customer balance for uploaded credit bill';
    end if;

    insert into public.customer_ledger (
      business_id, customer_id, date, type, description,
      reference_id, debit, credit, balance
    )
    values (
      target_business_id, target_customer_id, now_ts, 'uploaded_bill',
      'Uploaded credit bill (' ||
        case kind when 'handwritten' then 'handwritten' else 'digital' end || ')',
      bill_id, bill_amount, 0, updated_balance
    );

  end if;

end;
$$;


-- ------------------------------------------------------------
-- RPC: mark an uploaded credit bill as paid
-- Starts the 7-day deletion period and settles the ledger debit.
-- ------------------------------------------------------------

create or replace function public.mark_uploaded_bill_paid_atomic(
  payload jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  bill_id uuid := (payload->>'id')::uuid;
  target_business_id uuid := (payload->>'businessId')::uuid;
  bill public.uploaded_bills%rowtype;
  now_ts timestamptz := now();
  new_delete_after timestamptz := now() + interval '7 days';
  updated_balance numeric;
begin

  if bill_id is null or target_business_id is null then
    raise exception 'Invalid request';
  end if;

  if not public.has_business_access(target_business_id) then
    raise exception 'Business access denied';
  end if;

  select * into bill
  from public.uploaded_bills b
  where b.id = bill_id and b.business_id = target_business_id
  for update;

  if not found then
    raise exception 'Uploaded bill not found';
  end if;

  if bill.payment_status <> 'credit' then
    raise exception 'Bill is already marked as paid';
  end if;

  update public.uploaded_bills
  set payment_status = 'paid',
      paid_at = now_ts,
      delete_after = new_delete_after
  where id = bill.id;

  update public.customers as c
  set balance = c.balance - bill.amount, updated_at = now()
  where c.id = bill.customer_id
    and c.business_id = target_business_id
  returning c.balance into updated_balance;

  if updated_balance is null then
    raise exception 'Failed to update customer balance for uploaded bill payment';
  end if;

  insert into public.customer_ledger (
    business_id, customer_id, date, type, description,
    reference_id, debit, credit, balance
  )
  values (
    target_business_id, bill.customer_id, now_ts, 'uploaded_bill_payment',
    'Payment received for uploaded bill',
    bill.id, 0, bill.amount, updated_balance
  );

  return new_delete_after;

end;
$$;

revoke all on function public.create_uploaded_bill_atomic(jsonb)
  from public, anon, authenticated;
revoke all on function public.mark_uploaded_bill_paid_atomic(jsonb)
  from public, anon, authenticated;
grant execute on function public.create_uploaded_bill_atomic(jsonb) to authenticated;
grant execute on function public.mark_uploaded_bill_paid_atomic(jsonb) to authenticated;


-- ------------------------------------------------------------
-- Automatic deletion (server side)
--
-- pg_cron calls invoke_purge_uploaded_bills() every 15 minutes, which POSTs
-- to the `purge-expired-bills` Edge Function (see
-- supabase/functions/purge-expired-bills). The function deletes the Storage
-- object first and the row second, so a failed Storage delete is retried on
-- the next run instead of leaving an orphaned file.
--
-- Two Vault secrets are needed (NOT created here so no secret is committed):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random string>', 'bill_purge_secret');
-- and the same random string must be set as the Edge Function secret
-- BILL_PURGE_SECRET. See the deployment steps in the function's README.
-- ------------------------------------------------------------

create or replace function public.invoke_purge_uploaded_bills()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  purge_secret text;
  request_id bigint;
begin
  select decrypted_secret into base_url
  from vault.decrypted_secrets where name = 'project_url';

  select decrypted_secret into purge_secret
  from vault.decrypted_secrets where name = 'bill_purge_secret';

  -- Fail loudly (visible in cron.job_run_details) when not configured.
  if base_url is null or purge_secret is null then
    raise exception 'Vault secrets project_url and bill_purge_secret must exist for uploaded-bill purging';
  end if;

  -- Nothing due: skip the HTTP call.
  if not exists (
    select 1 from public.uploaded_bills
    where payment_status = 'paid'
      and delete_after is not null
      and delete_after <= now()
  ) then
    return null;
  end if;

  select net.http_post(
    url := base_url || '/functions/v1/purge-expired-bills',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', purge_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_purge_uploaded_bills()
  from public, anon, authenticated;

select cron.schedule(
  'purge-expired-uploaded-bills',
  '*/15 * * * *',
  $$ select public.invoke_purge_uploaded_bills(); $$
);
