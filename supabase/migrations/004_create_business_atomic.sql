create or replace function public.create_business(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  business_id uuid := (payload->>'id')::uuid;
  created_at timestamptz := (payload->>'createdAt')::timestamptz;
  updated_at timestamptz := (payload->>'updatedAt')::timestamptz;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create a business';
  end if;
  if business_id is null then
    raise exception 'Business id is required';
  end if;

  insert into public.profiles (id, name, email)
  values (
    current_user_id,
    coalesce(auth.jwt()->'user_metadata'->>'name', ''),
    coalesce(auth.jwt()->>'email', '')
  )
  on conflict (id) do nothing;

  insert into public.businesses (
    id, owner_id, owner_name, store_name, mobile_number, address, gstin,
    business_type, currency, default_tax_rate, invoice_prefix,
    invoice_next_number, thank_you_message, created_at, updated_at
  ) values (
    business_id, current_user_id, payload->>'ownerName', payload->>'storeName',
    payload->>'mobileNumber', nullif(payload->>'address', ''), nullif(payload->>'gstin', ''),
    payload->>'businessType', payload->>'currency', (payload->>'defaultTaxRate')::numeric,
    payload->>'invoicePrefix', (payload->>'invoiceNextNumber')::integer,
    payload->>'thankYouMessage', created_at, updated_at
  );

  insert into public.business_members (business_id, user_id, role, created_at)
  values (business_id, current_user_id, 'owner', created_at);

  insert into public.business_settings (
    business_id, allow_negative_stock, low_stock_alert_enabled,
    payment_reminder_enabled, auto_backup_enabled, backup_interval, updated_at
  ) values (business_id, false, true, true, false, 7, updated_at);
end;
$$;