-- ============================================================
-- Issue 3: Supplier payments / product-related expenses
--
-- Supplier payments already worked via create_payment_atomic (see
-- SupplierDetailScreen), but expenses had no way to link to a
-- supplier or a product, so a "product-related expense" couldn't be
-- attributed, and it never touched the supplier's balance.
-- ============================================================

alter table public.expenses
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null,
  add column if not exists supplier_name text,
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists product_name text;

create index if not exists idx_expenses_supplier on public.expenses(supplier_id);

-- Records an expense and, when it is linked to a supplier, immediately
-- updates that supplier's balance and ledger too (e.g. a product-related
-- expense billed against a supplier, just like a purchase would be).
create or replace function public.record_expense_atomic(
  payload jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_business_id uuid := (payload->>'businessId')::uuid;
  supplier_id uuid := nullif(payload->>'supplierId', '')::uuid;
  product_id uuid := nullif(payload->>'productId', '')::uuid;
  amount numeric := (payload->>'amount')::numeric;
  updated_balance numeric;
begin

  if target_business_id is null
     or amount is null
     or amount <= 0
     or not public.has_business_access(target_business_id)
  then
    raise exception 'Invalid expense or access denied';
  end if;

  if supplier_id is not null
     and not exists (
       select 1 from public.suppliers s
       where s.id = supplier_id and s.business_id = target_business_id
     )
  then
    raise exception 'Selected supplier was not found for this business';
  end if;

  if product_id is not null
     and not exists (
       select 1 from public.products p
       where p.id = product_id and p.business_id = target_business_id
     )
  then
    raise exception 'Selected product was not found for this business';
  end if;

  insert into public.expenses (
    id, business_id, title, category, amount, payment_method,
    description, supplier_id, supplier_name, product_id, product_name, created_at
  )
  values (
    (payload->>'id')::uuid,
    target_business_id,
    payload->>'title',
    payload->>'category',
    amount,
    payload->>'paymentMethod',
    nullif(payload->>'description', ''),
    supplier_id,
    nullif(payload->>'supplierName', ''),
    product_id,
    nullif(payload->>'productName', ''),
    (payload->>'createdAt')::timestamptz
  );

  if supplier_id is not null then

    update public.suppliers as s
    set balance = s.balance + amount, updated_at = now()
    where s.id = supplier_id
      and s.business_id = target_business_id
    returning s.balance into updated_balance;

    if updated_balance is null then
      raise exception 'Failed to update supplier balance for expense';
    end if;

    insert into public.supplier_ledger (
      business_id, supplier_id, type, description, reference_id, debit, balance
    )
    values (
      target_business_id,
      supplier_id,
      'debit_adjustment',
      'Expense - ' || (payload->>'title'),
      (payload->>'id')::uuid,
      amount,
      updated_balance
    );

  end if;

end;
$$;
