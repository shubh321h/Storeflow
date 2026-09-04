create or replace function public.increment_invoice_number(target_business_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.has_business_access(target_business_id) then
    raise exception 'Business access denied';
  end if;
  update public.businesses
  set invoice_next_number = invoice_next_number + 1, updated_at = now()
  where id = target_business_id;
  if not found then raise exception 'Business not found'; end if;
end;
$$;

create or replace function public.create_sale_atomic(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  sale_data jsonb := payload->'sale';
  sale_id uuid := (sale_data->>'id')::uuid;
  target_business_id uuid := (sale_data->>'businessId')::uuid;
  customer_id uuid;
  item_data jsonb;
  movement_data jsonb;
  current_qty numeric;
begin
  if sale_data is null or jsonb_typeof(payload->'items') <> 'array' or jsonb_typeof(payload->'stockMovements') <> 'array' then
    raise exception 'Invalid sale payload';
  end if;
  if not public.has_business_access(target_business_id) then raise exception 'Business access denied'; end if;
  customer_id := nullif(sale_data->>'customerId', '')::uuid;
  insert into public.sales (id, business_id, invoice_number, customer_id, subtotal, discount, tax_amount, total, paid, due, payment_method, status, notes, created_at)
  values (sale_id, target_business_id, sale_data->>'invoiceNumber', customer_id, (sale_data->>'subtotal')::numeric, (sale_data->>'discount')::numeric, (sale_data->>'taxAmount')::numeric, (sale_data->>'total')::numeric, (sale_data->>'paid')::numeric, (sale_data->>'due')::numeric, sale_data->>'paymentMethod', sale_data->>'status', nullif(sale_data->>'notes',''), (sale_data->>'createdAt')::timestamptz);
  for item_data in select * from jsonb_array_elements(payload->'items') loop
    insert into public.sale_items (id, sale_id, product_id, product_name, quantity, price, discount, tax_rate, tax_amount, total)
    values ((item_data->>'id')::uuid, sale_id, (item_data->>'productId')::uuid, item_data->>'productName', (item_data->>'quantity')::numeric, (item_data->>'price')::numeric, (item_data->>'discount')::numeric, (item_data->>'taxRate')::numeric, (item_data->>'taxAmount')::numeric, (item_data->>'total')::numeric);
  end loop;
  for movement_data in select * from jsonb_array_elements(payload->'stockMovements') loop
    insert into public.stock_movements (id, business_id, product_id, previous_qty, change_qty, new_qty, type, reason, reference_id, created_at)
    values ((movement_data->>'id')::uuid, target_business_id, (movement_data->>'productId')::uuid, (movement_data->>'previousQty')::numeric, (movement_data->>'changeQty')::numeric, (movement_data->>'newQty')::numeric, movement_data->>'type', nullif(movement_data->>'reason',''), sale_id, (movement_data->>'createdAt')::timestamptz);
    select current_stock into current_qty from public.inventory where product_id = (movement_data->>'productId')::uuid for update;
    if current_qty is null then raise exception 'Product inventory not found'; end if;
    if current_qty <> (movement_data->>'previousQty')::numeric then raise exception 'Product stock changed; retry sale'; end if;
    update public.inventory set current_stock = (movement_data->>'newQty')::numeric, updated_at = now() where product_id = (movement_data->>'productId')::uuid;
  end loop;
  insert into public.invoices (id, business_id, sale_id, invoice_number, html_content, created_at)
  values (gen_random_uuid(), target_business_id, sale_id, sale_data->>'invoiceNumber', coalesce(payload->>'invoiceHtml',''), (sale_data->>'createdAt')::timestamptz);
  if customer_id is not null and (sale_data->>'due')::numeric > 0 then
    update public.customers as c set balance = c.balance + (sale_data->>'due')::numeric, updated_at = now() where c.id = customer_id and c.business_id = target_business_id;
    insert into public.customer_ledger (business_id, customer_id, date, type, description, reference_id, debit, credit, balance)
    select target_business_id, customer_id, (sale_data->>'createdAt')::timestamptz, 'credit_sale', 'Sale ' || (sale_data->>'invoiceNumber'), sale_id, (sale_data->>'due')::numeric, 0, c.balance
    from public.customers as c where c.id = customer_id;
  end if;
end;
$$;

create or replace function public.create_purchase_atomic(payload jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  purchase_data jsonb := payload->'purchase'; purchase_id uuid := (purchase_data->>'id')::uuid; target_business_id uuid := (purchase_data->>'businessId')::uuid; supplier_id uuid := (purchase_data->>'supplierId')::uuid; item_data jsonb; movement_data jsonb; current_qty numeric;
begin
  if not public.has_business_access(target_business_id) or jsonb_typeof(payload->'items') <> 'array' or jsonb_typeof(payload->'stockMovements') <> 'array' then raise exception 'Invalid purchase payload'; end if;
  insert into public.purchases (id,business_id,invoice_number,supplier_id,subtotal,discount,tax_amount,total,paid,due,payment_method,status,notes,supplier_invoice_number,created_at) values (purchase_id,target_business_id,purchase_data->>'invoiceNumber',supplier_id,(purchase_data->>'subtotal')::numeric,(purchase_data->>'discount')::numeric,(purchase_data->>'taxAmount')::numeric,(purchase_data->>'total')::numeric,(purchase_data->>'paid')::numeric,(purchase_data->>'due')::numeric,purchase_data->>'paymentMethod',purchase_data->>'status',nullif(purchase_data->>'notes',''),nullif(purchase_data->>'supplierInvoiceNumber',''),(purchase_data->>'createdAt')::timestamptz);
  for item_data in select * from jsonb_array_elements(payload->'items') loop insert into public.purchase_items (id,purchase_id,product_id,product_name,quantity,price,discount,tax_rate,tax_amount,total) values ((item_data->>'id')::uuid,purchase_id,nullif(item_data->>'productId','')::uuid,item_data->>'productName',(item_data->>'quantity')::numeric,(item_data->>'price')::numeric,(item_data->>'discount')::numeric,(item_data->>'taxRate')::numeric,(item_data->>'taxAmount')::numeric,(item_data->>'total')::numeric); end loop;
  for movement_data in select * from jsonb_array_elements(payload->'stockMovements') loop
    insert into public.stock_movements (id,business_id,product_id,previous_qty,change_qty,new_qty,type,reason,reference_id,created_at) values ((movement_data->>'id')::uuid,target_business_id,(movement_data->>'productId')::uuid,(movement_data->>'previousQty')::numeric,(movement_data->>'changeQty')::numeric,(movement_data->>'newQty')::numeric,movement_data->>'type',nullif(movement_data->>'reason',''),purchase_id,(movement_data->>'createdAt')::timestamptz);
    select current_stock into current_qty from public.inventory where product_id=(movement_data->>'productId')::uuid for update; if current_qty is null or current_qty <> (movement_data->>'previousQty')::numeric then raise exception 'Product stock changed; retry purchase'; end if;
    update public.inventory set current_stock=(movement_data->>'newQty')::numeric,updated_at=now() where product_id=(movement_data->>'productId')::uuid;
  end loop;
  if (purchase_data->>'due')::numeric > 0 then update public.suppliers as s set balance=s.balance+(purchase_data->>'due')::numeric,updated_at=now() where s.id=supplier_id and s.business_id=target_business_id; insert into public.supplier_ledger (business_id,supplier_id,date,type,description,reference_id,debit,credit,balance) select target_business_id,supplier_id,(purchase_data->>'createdAt')::timestamptz,'purchase','Purchase '||(purchase_data->>'invoiceNumber'),purchase_id,(purchase_data->>'due')::numeric,0,s.balance from public.suppliers as s where s.id=supplier_id; end if;
end; $$;

create or replace function public.create_sales_return_atomic(sale_id uuid, returned_items jsonb, return_reason text)
returns void language plpgsql security invoker set search_path = public as $$
declare original public.sales%rowtype; item_data jsonb; qty numeric; old_qty numeric;
begin
 select * into original from public.sales where id=sale_id; if not found or not public.has_business_access(original.business_id) then raise exception 'Original sale not found or access denied'; end if;
 update public.sales set status='returned' where id=sale_id;
 for item_data in select * from jsonb_array_elements(returned_items) loop qty := (item_data->>'quantity')::numeric; select current_stock into old_qty from public.inventory where product_id=(item_data->>'productId')::uuid for update; if old_qty is null then raise exception 'Product inventory not found'; end if; update public.inventory set current_stock=old_qty+qty,updated_at=now() where product_id=(item_data->>'productId')::uuid; insert into public.stock_movements (business_id,product_id,previous_qty,change_qty,new_qty,type,reason,reference_id) values (original.business_id,(item_data->>'productId')::uuid,old_qty,qty,old_qty+qty,'sales_return','Sales Return - '||return_reason,sale_id); end loop;
end; $$;

create or replace function public.create_purchase_return_atomic(purchase_id uuid, returned_items jsonb, return_reason text)
returns void language plpgsql security invoker set search_path = public as $$
declare original public.purchases%rowtype; item_data jsonb; qty numeric; old_qty numeric;
begin
 select * into original from public.purchases where id=purchase_id; if not found or not public.has_business_access(original.business_id) then raise exception 'Original purchase not found or access denied'; end if;
 update public.purchases set status='returned' where id=purchase_id;
 for item_data in select * from jsonb_array_elements(returned_items) loop qty := (item_data->>'quantity')::numeric; select current_stock into old_qty from public.inventory where product_id=(item_data->>'productId')::uuid for update; if old_qty is null or old_qty < qty then raise exception 'Insufficient stock for return'; end if; update public.inventory set current_stock=old_qty-qty,updated_at=now() where product_id=(item_data->>'productId')::uuid; insert into public.stock_movements (business_id,product_id,previous_qty,change_qty,new_qty,type,reason,reference_id) values (original.business_id,(item_data->>'productId')::uuid,old_qty,-qty,old_qty-qty,'purchase_return','Purchase Return - '||return_reason,purchase_id); end loop;
end; $$;

create or replace function public.create_payment_atomic(payload jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare target_business_id uuid := (payload->>'businessId')::uuid; customer_id uuid := nullif(payload->>'customerId','')::uuid; supplier_id uuid := nullif(payload->>'supplierId','')::uuid; amount numeric := (payload->>'amount')::numeric; new_balance numeric;
begin
 if not public.has_business_access(target_business_id) or amount <= 0 then raise exception 'Invalid payment or access denied'; end if;
 insert into public.payments (id,business_id,customer_id,supplier_id,sale_id,purchase_id,amount,method,notes,created_at) values ((payload->>'id')::uuid,target_business_id,customer_id,supplier_id,nullif(payload->>'saleId','')::uuid,nullif(payload->>'purchaseId','')::uuid,amount,payload->>'method',nullif(payload->>'notes',''),(payload->>'createdAt')::timestamptz);
 if customer_id is not null and payload->>'saleId' is null then update public.customers as c set balance=c.balance-amount,updated_at=now() where c.id=customer_id and c.business_id=target_business_id returning c.balance into new_balance; insert into public.customer_ledger (business_id,customer_id,type,description,reference_id,credit,balance) values (target_business_id,customer_id,'payment_received','Payment Received - '||upper(payload->>'method'),(payload->>'id')::uuid,amount,new_balance); end if;
 if supplier_id is not null and payload->>'purchaseId' is null then update public.suppliers as s set balance=s.balance-amount,updated_at=now() where s.id=supplier_id and s.business_id=target_business_id returning s.balance into new_balance; insert into public.supplier_ledger (business_id,supplier_id,type,description,reference_id,credit,balance) values (target_business_id,supplier_id,'payment','Payment - '||upper(payload->>'method'),(payload->>'id')::uuid,amount,new_balance); end if;
end; $$;
