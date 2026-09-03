create or replace function public.has_business_access(target_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where business_id = target_business_id and user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.stock_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.invoices enable row level security;
alter table public.customer_ledger enable row level security;
alter table public.supplier_ledger enable row level security;
alter table public.business_settings enable row level security;
alter table public.backup_records enable row level security;

create policy profiles_self_select on public.profiles for select using (id = auth.uid());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy businesses_member_select on public.businesses for select using (public.has_business_access(id));
create policy businesses_owner_select on public.businesses for select using (owner_id = auth.uid());
create policy businesses_owner_insert on public.businesses for insert with check (owner_id = auth.uid());
create policy businesses_owner_update on public.businesses for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy businesses_owner_delete on public.businesses for delete using (owner_id = auth.uid());

create policy business_members_select on public.business_members for select using (public.has_business_access(business_id));
create policy business_members_owner_insert on public.business_members for insert with check (
  user_id = auth.uid() and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
);
create policy business_members_owner_update on public.business_members for update using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
create policy business_members_owner_delete on public.business_members for delete using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'categories', 'suppliers', 'customers', 'products', 'inventory', 'stock_movements',
    'sales', 'purchases', 'payments', 'expenses', 'invoices', 'customer_ledger',
    'supplier_ledger', 'business_settings', 'backup_records'
  ] loop
    execute format('create policy %I_access on public.%I for all using (public.has_business_access(business_id)) with check (public.has_business_access(business_id))', table_name, table_name);
  end loop;
end $$;

create policy sale_items_access on public.sale_items for all
using (exists (select 1 from public.sales s where s.id = sale_id and public.has_business_access(s.business_id)))
with check (exists (select 1 from public.sales s where s.id = sale_id and public.has_business_access(s.business_id)));

create policy purchase_items_access on public.purchase_items for all
using (exists (select 1 from public.purchases p where p.id = purchase_id and public.has_business_access(p.business_id)))
with check (exists (select 1 from public.purchases p where p.id = purchase_id and public.has_business_access(p.business_id)));