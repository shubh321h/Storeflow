create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  owner_name text not null,
  store_name text not null,
  mobile_number text not null,
  address text,
  gstin text,
  business_type text not null,
  currency text not null default 'INR',
  default_tax_rate numeric(7,2) not null default 0 check (default_tax_rate >= 0),
  invoice_prefix text not null default 'INV',
  invoice_next_number integer not null default 1 check (invoice_next_number > 0),
  thank_you_message text not null default 'Thank you for shopping with us!',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, created_at timestamptz not null default now(), unique (business_id, name)
);
create table public.suppliers (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, mobile text, email text, address text, gstin text,
  opening_balance numeric(14,2) not null default 0, balance numeric(14,2) not null default 0, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.customers (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, mobile text, email text, address text,
  opening_balance numeric(14,2) not null default 0, balance numeric(14,2) not null default 0, credit_limit numeric(14,2), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, barcode text, sku text, category_id uuid references public.categories(id) on delete set null,
  brand text, purchase_price numeric(14,2) not null default 0, selling_price numeric(14,2) not null default 0, mrp numeric(14,2),
  tax_rate numeric(7,2) not null default 0, unit text not null default 'Piece', min_stock_level numeric(14,3) not null default 0,
  supplier_id uuid references public.suppliers(id) on delete set null, image_uri text, expiry_date date, batch_number text, notes text,
  is_archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.inventory (
  product_id uuid primary key references public.products(id) on delete cascade, business_id uuid not null references public.businesses(id) on delete cascade,
  current_stock numeric(14,3) not null default 0, updated_at timestamptz not null default now()
);
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade, previous_qty numeric(14,3) not null, change_qty numeric(14,3) not null,
  new_qty numeric(14,3) not null, type text not null, reason text, reference_id uuid, created_at timestamptz not null default now()
);
create table public.sales (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_number text not null, customer_id uuid references public.customers(id) on delete set null, subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0, tax_amount numeric(14,2) not null default 0, total numeric(14,2) not null default 0,
  paid numeric(14,2) not null default 0, due numeric(14,2) not null default 0, payment_method text not null, status text not null default 'completed', notes text,
  created_at timestamptz not null default now(), unique (business_id, invoice_number)
);
create table public.sale_items (
  id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict, product_name text not null, quantity numeric(14,3) not null,
  price numeric(14,2) not null, discount numeric(14,2) not null default 0, tax_rate numeric(7,2) not null default 0, tax_amount numeric(14,2) not null default 0, total numeric(14,2) not null
);
create table public.purchases (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_number text not null, supplier_id uuid not null references public.suppliers(id) on delete restrict, subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0, tax_amount numeric(14,2) not null default 0, total numeric(14,2) not null default 0, paid numeric(14,2) not null default 0, due numeric(14,2) not null default 0,
  payment_method text not null, status text not null default 'completed', notes text, supplier_invoice_number text, created_at timestamptz not null default now()
);
create table public.purchase_items (id uuid primary key default gen_random_uuid(), purchase_id uuid not null references public.purchases(id) on delete cascade, product_id uuid references public.products(id) on delete restrict, product_name text not null, quantity numeric(14,3) not null, price numeric(14,2) not null, discount numeric(14,2) not null default 0, tax_rate numeric(7,2) not null default 0, tax_amount numeric(14,2) not null default 0, total numeric(14,2) not null);
create table public.payments (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, customer_id uuid references public.customers(id) on delete set null, supplier_id uuid references public.suppliers(id) on delete set null, sale_id uuid references public.sales(id) on delete set null, purchase_id uuid references public.purchases(id) on delete set null, amount numeric(14,2) not null check (amount > 0), method text not null, notes text, created_at timestamptz not null default now());
create table public.expenses (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, title text not null default 'Expense', category text not null, amount numeric(14,2) not null check (amount >= 0), payment_method text not null default 'cash', description text, created_at timestamptz not null default now());
create table public.invoices (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, sale_id uuid not null references public.sales(id) on delete cascade, invoice_number text not null, html_content text not null, created_at timestamptz not null default now());
create table public.customer_ledger (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, customer_id uuid not null references public.customers(id) on delete cascade, date timestamptz not null default now(), type text not null, description text not null, reference_id uuid, debit numeric(14,2) not null default 0, credit numeric(14,2) not null default 0, balance numeric(14,2) not null default 0, created_at timestamptz not null default now());
create table public.supplier_ledger (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, supplier_id uuid not null references public.suppliers(id) on delete cascade, date timestamptz not null default now(), type text not null, description text not null, reference_id uuid, debit numeric(14,2) not null default 0, credit numeric(14,2) not null default 0, balance numeric(14,2) not null default 0, created_at timestamptz not null default now());
create table public.business_settings (id uuid primary key default gen_random_uuid(), business_id uuid not null unique references public.businesses(id) on delete cascade, allow_negative_stock boolean not null default false, low_stock_alert_enabled boolean not null default true, payment_reminder_enabled boolean not null default true, auto_backup_enabled boolean not null default false, backup_interval integer not null default 7, last_backup_at timestamptz, pin_code text, updated_at timestamptz not null default now());
create table public.backup_records (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, type text not null, data_size integer not null default 0, created_at timestamptz not null default now(), status text not null, error_message text);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger businesses_updated_at before update on public.businesses for each row execute function public.set_updated_at();
create trigger suppliers_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger inventory_updated_at before update on public.inventory for each row execute function public.set_updated_at();
create trigger settings_updated_at before update on public.business_settings for each row execute function public.set_updated_at();

create index idx_business_members_user on public.business_members(user_id);
create index idx_products_business on public.products(business_id);
create index idx_products_barcode on public.products(business_id, barcode);
create index idx_customers_business on public.customers(business_id);
create index idx_suppliers_business on public.suppliers(business_id);
create index idx_sales_business_created on public.sales(business_id, created_at desc);
create index idx_purchases_business_created on public.purchases(business_id, created_at desc);
create index idx_payments_business_created on public.payments(business_id, created_at desc);
create index idx_expenses_business_created on public.expenses(business_id, created_at desc);
create index idx_stock_movements_product_created on public.stock_movements(product_id, created_at desc);
create index idx_customer_ledger_customer_date on public.customer_ledger(customer_id, date desc);
create index idx_supplier_ledger_supplier_date on public.supplier_ledger(supplier_id, date desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles (id, name, email) values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.email); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
