-- ============================================================
-- Issue 1: Estimated profit = ₹0
-- Root cause: sale_items never stored what the product cost at the
-- time of sale, so profit (selling price - cost) could not be computed.
-- ============================================================

alter table public.sale_items
  add column if not exists cost_price numeric(14,2) not null default 0;

create or replace function public.create_sale_atomic(
  payload jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  sale_data jsonb := payload->'sale';
  sale_id uuid;
  target_business_id uuid;
  customer_id uuid;
  item_data jsonb;
  movement_data jsonb;
  current_qty numeric;
  previous_qty numeric;
  change_qty numeric;
  new_qty numeric;
begin
  if sale_data is null
     or jsonb_typeof(payload->'items') <> 'array'
     or jsonb_typeof(payload->'stockMovements') <> 'array'
  then
    raise exception 'Invalid sale payload';
  end if;

  sale_id := (sale_data->>'id')::uuid;
  target_business_id := (sale_data->>'businessId')::uuid;
  customer_id := nullif(sale_data->>'customerId', '')::uuid;

  if sale_id is null or target_business_id is null then
    raise exception 'Invalid sale or business';
  end if;

  if not public.has_business_access(target_business_id) then
    raise exception 'Business access denied';
  end if;

  insert into public.sales (
    id, business_id, invoice_number, customer_id, subtotal, discount,
    tax_amount, total, paid, due, payment_method, status, notes, created_at
  )
  values (
    sale_id, target_business_id, sale_data->>'invoiceNumber', customer_id,
    (sale_data->>'subtotal')::numeric, (sale_data->>'discount')::numeric,
    (sale_data->>'taxAmount')::numeric, (sale_data->>'total')::numeric,
    (sale_data->>'paid')::numeric, (sale_data->>'due')::numeric,
    sale_data->>'paymentMethod', sale_data->>'status',
    nullif(sale_data->>'notes', ''), (sale_data->>'createdAt')::timestamptz
  );

  -- Sale items now snapshot cost_price so profit can be computed later
  for item_data in select * from jsonb_array_elements(payload->'items')
  loop
    insert into public.sale_items (
      id, sale_id, product_id, product_name, quantity, price, discount,
      tax_rate, tax_amount, total, cost_price
    )
    values (
      (item_data->>'id')::uuid, sale_id, (item_data->>'productId')::uuid,
      item_data->>'productName', (item_data->>'quantity')::numeric,
      (item_data->>'price')::numeric, (item_data->>'discount')::numeric,
      (item_data->>'taxRate')::numeric, (item_data->>'taxAmount')::numeric,
      (item_data->>'total')::numeric,
      coalesce((item_data->>'costPrice')::numeric, 0)
    );
  end loop;

  for movement_data in select * from jsonb_array_elements(payload->'stockMovements')
  loop
    previous_qty := (movement_data->>'previousQty')::numeric;
    change_qty := (movement_data->>'changeQty')::numeric;
    new_qty := (movement_data->>'newQty')::numeric;

    if previous_qty is null or change_qty is null or new_qty is null then
      raise exception 'Invalid stock movement';
    end if;

    select current_stock into current_qty
    from public.inventory
    where product_id = (movement_data->>'productId')::uuid
      and business_id = target_business_id
    for update;

    if current_qty is null then
      raise exception 'Product inventory not found';
    end if;
    if new_qty <> current_qty + change_qty then
      raise exception 'Invalid stock movement';
    end if;
    if new_qty < 0 then
      raise exception 'Insufficient stock';
    end if;

    update public.inventory
    set current_stock = new_qty, updated_at = now()
    where product_id = (movement_data->>'productId')::uuid
      and business_id = target_business_id;

    insert into public.stock_movements (
      id, business_id, product_id, previous_qty, change_qty, new_qty,
      type, reason, reference_id, created_at
    )
    values (
      (movement_data->>'id')::uuid, target_business_id,
      (movement_data->>'productId')::uuid, previous_qty, change_qty, new_qty,
      movement_data->>'type', nullif(movement_data->>'reason', ''),
      sale_id, (movement_data->>'createdAt')::timestamptz
    );
  end loop;

  insert into public.invoices (id, business_id, sale_id, invoice_number, html_content, created_at)
  values (
    gen_random_uuid(), target_business_id, sale_id, sale_data->>'invoiceNumber',
    coalesce(payload->>'invoiceHtml', ''), (sale_data->>'createdAt')::timestamptz
  );

  if customer_id is not null and (sale_data->>'due')::numeric > 0 then
    update public.customers as c
    set balance = c.balance + (sale_data->>'due')::numeric, updated_at = now()
    where c.id = customer_id and c.business_id = target_business_id;

    insert into public.customer_ledger (
      business_id, customer_id, date, type, description, reference_id, debit, credit, balance
    )
    select
      target_business_id, customer_id, (sale_data->>'createdAt')::timestamptz,
      'credit_sale', 'Sale ' || (sale_data->>'invoiceNumber'), sale_id,
      (sale_data->>'due')::numeric, 0, c.balance
    from public.customers as c
    where c.id = customer_id and c.business_id = target_business_id;
  end if;
end;
$$;
