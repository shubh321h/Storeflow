import * as SQLite from 'expo-sqlite';
import {
  User, Business, Category, Supplier, Product, StockMovement,
  Customer, Sale, SaleItem, Purchase, PurchaseItem, Payment, Expense, Invoice,
  CustomerLedger, SupplierLedger, BusinessSettings, BackupRecord,
  DashboardStats, RecentTransaction, UnifiedTransaction,
  SalesReport, ProductReport, CustomerReport, ExpenseReport,
} from './types';
import { generateId, getStartOfDay, getEndOfDay, generateInvoiceNumber } from './utils';
import { supabase } from '../supabase';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('storeflow.db');
    await initSchema();
  }
  return db;
}

async function initSchema() {
  const database = await getDB();
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      owner_name TEXT NOT NULL,
      store_name TEXT NOT NULL,
      mobile_number TEXT NOT NULL,
      address TEXT,
      gstin TEXT,
      business_type TEXT NOT NULL,
      currency TEXT DEFAULT '₹',
      default_tax_rate REAL DEFAULT 0,
      invoice_prefix TEXT DEFAULT 'INV',
      invoice_next_number INTEGER DEFAULT 1,
      thank_you_message TEXT DEFAULT 'Thank you for shopping with us!',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_businesses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      business_id TEXT NOT NULL,
      role TEXT DEFAULT 'owner',
      created_at TEXT NOT NULL,
      UNIQUE(user_id, business_id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mobile TEXT,
      email TEXT,
      address TEXT,
      gstin TEXT,
      opening_balance REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_suppliers_business ON suppliers(business_id);

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      barcode TEXT,
      sku TEXT,
      category_id TEXT,
      category_name TEXT,
      brand TEXT,
      purchase_price REAL NOT NULL DEFAULT 0,
      selling_price REAL NOT NULL DEFAULT 0,
      mrp REAL,
      tax_rate REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'Piece',
      current_stock REAL NOT NULL DEFAULT 0,
      min_stock_level REAL NOT NULL DEFAULT 0,
      supplier_id TEXT,
      supplier_name TEXT,
      image_uri TEXT,
      expiry_date TEXT,
      batch_number TEXT,
      notes TEXT,
      is_archived INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      previous_qty REAL NOT NULL,
      change_qty REAL NOT NULL,
      new_qty REAL NOT NULL,
      type TEXT NOT NULL,
      reason TEXT,
      reference_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stock_product ON stock_movements(product_id);

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mobile TEXT,
      email TEXT,
      address TEXT,
      opening_balance REAL DEFAULT 0,
      balance REAL NOT NULL DEFAULT 0,
      credit_limit REAL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      paid REAL NOT NULL DEFAULT 0,
      due REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sales_business ON sales(business_id);
    CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
    CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      supplier_name TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      paid REAL NOT NULL DEFAULT 0,
      due REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      notes TEXT,
      supplier_invoice_number TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_purchases_business ON purchases(business_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_created ON purchases(created_at);

    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      product_id TEXT,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      customer_id TEXT,
      supplier_id TEXT,
      sale_id TEXT,
      purchase_id TEXT,
      amount REAL NOT NULL DEFAULT 0,
      method TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id);
    CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_payments_supplier ON payments(supplier_id);

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Expense',
      category TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_business ON expenses(business_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(created_at);

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      sale_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      html_content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_sale ON invoices(sale_id);

    CREATE TABLE IF NOT EXISTS customer_ledger (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      reference_id TEXT,
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer ON customer_ledger(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_ledger_date ON customer_ledger(date);
    CREATE INDEX IF NOT EXISTS idx_customer_ledger_business ON customer_ledger(business_id);

    CREATE TABLE IF NOT EXISTS supplier_ledger (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      reference_id TEXT,
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier ON supplier_ledger(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_supplier_ledger_date ON supplier_ledger(date);
    CREATE INDEX IF NOT EXISTS idx_supplier_ledger_business ON supplier_ledger(business_id);

    CREATE TABLE IF NOT EXISTS business_settings (
      id TEXT PRIMARY KEY,
      business_id TEXT UNIQUE NOT NULL,
      allow_negative_stock INTEGER DEFAULT 0,
      low_stock_alert_enabled INTEGER DEFAULT 1,
      payment_reminder_enabled INTEGER DEFAULT 1,
      auto_backup_enabled INTEGER DEFAULT 0,
      backup_interval INTEGER DEFAULT 7,
      last_backup_at TEXT,
      pin_code TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backup_records (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      type TEXT NOT NULL,
      data_size INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT
    );
  `);
}

// ============== USERS ==============

export async function createUser(user: User): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [user.id, user.name, user.email, user.passwordHash || '', user.createdAt, user.updatedAt]
  );
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(`SELECT * FROM users WHERE email = ?`, [email]);
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, passwordHash: row.password_hash, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function getUserById(id: string): Promise<User | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, passwordHash: row.password_hash, createdAt: row.created_at, updatedAt: row.updated_at };
}

// ============== BUSINESS ==============

export async function createBusiness(business: Business): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user.id) throw new Error('You must be signed in to create a business.');
  const { error } = await supabase.from('businesses').insert({
    id: business.id, owner_id: session.session.user.id, owner_name: business.ownerName,
    store_name: business.storeName, mobile_number: business.mobileNumber, address: business.address || null,
    gstin: business.gstin || null, business_type: business.businessType, currency: business.currency,
    default_tax_rate: business.defaultTaxRate, invoice_prefix: business.invoicePrefix,
    invoice_next_number: business.invoiceNextNumber, thank_you_message: business.thankYouMessage,
    created_at: business.createdAt, updated_at: business.updatedAt,
  });
  if (error) throw error;
  await createBusinessSettings({ id: generateId(), businessId: business.id, allowNegativeStock: false, lowStockAlertEnabled: true, paymentReminderEnabled: true, autoBackupEnabled: false, backupInterval: 7, updatedAt: new Date().toISOString() });
}

export async function getBusinessById(id: string): Promise<Business | null> {
  const { data, error } = await supabase.from('businesses').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapBusiness(data) : null;
}

export async function getBusinessesForUser(userId: string): Promise<Business[]> {
  const { data, error } = await supabase.from('business_members').select('businesses(*)').eq('user_id', userId);
  if (error) throw error;
  return (data || []).flatMap((row: any) => row.businesses ? [mapBusiness(row.businesses)] : []);
}

export async function updateBusiness(business: Business): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `UPDATE businesses SET owner_name = ?, store_name = ?, mobile_number = ?, address = ?, gstin = ?,
     business_type = ?, currency = ?, default_tax_rate = ?, invoice_prefix = ?, invoice_next_number = ?,
     thank_you_message = ?, updated_at = ? WHERE id = ?`,
    [business.ownerName, business.storeName, business.mobileNumber, business.address || '',
     business.gstin || null, business.businessType, business.currency, business.defaultTaxRate,
     business.invoicePrefix, business.invoiceNextNumber, business.thankYouMessage,
     business.updatedAt, business.id]
  );
}

export async function incrementInvoiceNumber(businessId: string): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `UPDATE businesses SET invoice_next_number = invoice_next_number + 1, updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), businessId]
  );
}

function mapBusiness(row: any): Business {
  return {
    id: row.id, ownerName: row.owner_name, storeName: row.store_name, mobileNumber: row.mobile_number,
    address: row.address, gstin: row.gstin, businessType: row.business_type, currency: row.currency,
    defaultTaxRate: row.default_tax_rate, invoicePrefix: row.invoice_prefix, invoiceNextNumber: row.invoice_next_number,
    thankYouMessage: row.thank_you_message, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// ============== USER BUSINESS ==============

export async function createUserBusiness(ub: { id: string; userId: string; businessId: string; role: string; createdAt: string }): Promise<void> {
  const { error } = await supabase.from('business_members').insert({ id: ub.id, user_id: ub.userId, business_id: ub.businessId, role: ub.role, created_at: ub.createdAt });
  if (error) throw error;
}

// ============== CATEGORIES ==============

export async function createCategory(category: Category): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `INSERT INTO categories (id, business_id, name, created_at) VALUES (?, ?, ?, ?)`,
    [category.id, category.businessId, category.name, category.createdAt]
  );
}

export async function getCategories(businessId: string): Promise<Category[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(`SELECT * FROM categories WHERE business_id = ? ORDER BY name`, [businessId]);
  return rows.map(r => ({ id: r.id, businessId: r.business_id, name: r.name, createdAt: r.created_at }));
}

export async function deleteCategory(id: string): Promise<void> {
  const database = await getDB();
  await database.runAsync(`DELETE FROM categories WHERE id = ?`, [id]);
}

// ============== SUPPLIERS ==============

export async function createSupplier(supplier: Supplier): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `INSERT INTO suppliers (id, business_id, name, mobile, email, address, gstin, opening_balance, balance, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [supplier.id, supplier.businessId, supplier.name, supplier.mobile || null, supplier.email || null,
     supplier.address || null, supplier.gstin || null, supplier.openingBalance, supplier.balance,
     supplier.notes || null, supplier.createdAt, supplier.updatedAt]
  );
  if (supplier.openingBalance !== 0) {
    await createSupplierLedger({
      id: generateId(), businessId: supplier.businessId, supplierId: supplier.id, supplierName: supplier.name,
      date: new Date().toISOString(), type: 'opening_balance',
      description: `Opening Balance`, referenceId: undefined,
      debit: supplier.openingBalance > 0 ? supplier.openingBalance : 0,
      credit: supplier.openingBalance < 0 ? Math.abs(supplier.openingBalance) : 0,
      balance: supplier.openingBalance, createdAt: new Date().toISOString(),
    });
  }
}

export async function updateSupplier(supplier: Supplier): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `UPDATE suppliers SET name = ?, mobile = ?, email = ?, address = ?, gstin = ?, balance = ?, notes = ?, updated_at = ? WHERE id = ?`,
    [supplier.name, supplier.mobile || null, supplier.email || null, supplier.address || null,
     supplier.gstin || null, supplier.balance, supplier.notes || null, supplier.updatedAt, supplier.id]
  );
}

export async function getSuppliers(businessId: string): Promise<Supplier[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(`SELECT * FROM suppliers WHERE business_id = ? ORDER BY name`, [businessId]);
  return rows.map(mapSupplier);
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(`SELECT * FROM suppliers WHERE id = ?`, [id]);
  if (!row) return null;
  return mapSupplier(row);
}

export async function deleteSupplier(id: string): Promise<void> {
  const database = await getDB();
  await database.runAsync(`DELETE FROM suppliers WHERE id = ?`, [id]);
}

export async function updateSupplierBalance(supplierId: string, newBalance: number): Promise<void> {
  const database = await getDB();
  await database.runAsync(`UPDATE suppliers SET balance = ?, updated_at = ? WHERE id = ?`, [newBalance, new Date().toISOString(), supplierId]);
}

function mapSupplier(row: any): Supplier {
  return {
    id: row.id, businessId: row.business_id, name: row.name, mobile: row.mobile, email: row.email,
    address: row.address, gstin: row.gstin, openingBalance: row.opening_balance || 0, balance: row.balance || 0,
    notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// ============== PRODUCTS ==============

 export async function createProduct(product: Product): Promise<void> {
  const { error } = await supabase.from('products').insert({
    id: product.id,
    business_id: product.businessId,
    name: product.name,
    barcode: product.barcode || null,
    sku: product.sku || null,
    category_id: product.categoryId || null,
    category_name: product.categoryName || null,
    brand: product.brand || null,
    purchase_price: product.purchasePrice,
    selling_price: product.sellingPrice,
    mrp: product.mrp || null,
    tax_rate: product.taxRate,
    unit: product.unit,
    current_stock: product.currentStock,
    min_stock_level: product.minStockLevel,
    supplier_id: product.supplierId || null,
    supplier_name: product.supplierName || null,
    image_uri: product.imageUri || null,
    expiry_date: product.expiryDate || null,
    batch_number: product.batchNumber || null,
    notes: product.notes || null,
    is_archived: product.isArchived,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  });

  if (error) throw error;
}

export async function updateProduct(product: Product): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({
      name: product.name,
      barcode: product.barcode || null,
      sku: product.sku || null,
      category_id: product.categoryId || null,
      category_name: product.categoryName || null,
      brand: product.brand || null,
      purchase_price: product.purchasePrice,
      selling_price: product.sellingPrice,
      mrp: product.mrp || null,
      tax_rate: product.taxRate,
      unit: product.unit,
      current_stock: product.currentStock,
      min_stock_level: product.minStockLevel,
      supplier_id: product.supplierId || null,
      supplier_name: product.supplierName || null,
      image_uri: product.imageUri || null,
      expiry_date: product.expiryDate || null,
      batch_number: product.batchNumber || null,
      notes: product.notes || null,
      is_archived: product.isArchived,
      updated_at: product.updatedAt,
    })
    .eq('id', product.id)
    .eq('business_id', product.businessId);

  if (error) throw error;
}

export async function getProducts(
  businessId: string,
  includeArchived = false
): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .order('name');

  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(mapProduct);
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    businessId: String(row.business_id),
    name: String(row.name || ''),
    barcode: typeof row.barcode === 'string' ? row.barcode : undefined,
    sku: typeof row.sku === 'string' ? row.sku : undefined,
    categoryId: typeof row.category_id === 'string' ? row.category_id : undefined,
    categoryName: typeof row.category_name === 'string' ? row.category_name : undefined,
    brand: typeof row.brand === 'string' ? row.brand : undefined,
    purchasePrice: Number(row.purchase_price || 0),
    sellingPrice: Number(row.selling_price || 0),
    mrp: row.mrp == null ? undefined : Number(row.mrp),
    taxRate: Number(row.tax_rate || 0),
    unit: String(row.unit || 'Piece'),
    currentStock: Number(row.current_stock || 0),
    minStockLevel: Number(row.min_stock_level || 0),
    supplierId: typeof row.supplier_id === 'string' ? row.supplier_id : undefined,
    supplierName: typeof row.supplier_name === 'string' ? row.supplier_name : undefined,
    imageUri: typeof row.image_uri === 'string' ? row.image_uri : undefined,
    expiryDate: typeof row.expiry_date === 'string' ? row.expiry_date : undefined,
    batchNumber: typeof row.batch_number === 'string' ? row.batch_number : undefined,
    notes: typeof row.notes === 'string' ? row.notes : undefined,
    isArchived: row.is_archived === true || row.is_archived === 1 ? 1 : 0,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

export async function searchProducts(
  businessId: string,
  query: string
): Promise<Product[]> {
  const searchTerm = `%${query}%`;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_archived', false)
    .or(`name.ilike.${searchTerm},barcode.ilike.${searchTerm},sku.ilike.${searchTerm}`)
    .order('name')
    .limit(50);

  if (error) throw error;

  return (data || []).map(mapProduct);
}

export async function getProductById(
  id: string
): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;

  return data ? mapProduct(data) : null;
}

export async function getProductByBarcode(
  businessId: string,
  barcode: string
): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .eq('barcode', barcode)
    .eq('is_archived', false)
    .maybeSingle();

  if (error) throw error;

  return data ? mapProduct(data) : null;
}

export async function getLowStockProducts(
  businessId: string
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_archived', false);

  if (error) throw error;

  return (data || [])
    .map(mapProduct)
    .filter((product) => product.currentStock <= product.minStockLevel && product.currentStock > 0);
}

export async function getOutOfStockProducts(
  businessId: string
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_archived', false)
    .lte('current_stock', 0);

  if (error) throw error;

  return (data || []).map(mapProduct);
}

export async function updateProductStock(
  productId: string,
  newQty: number
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({
      current_stock: newQty,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId);

  if (error) throw error;
}



// ============== STOCK MOVEMENTS ==============

export async function createStockMovement(movement: StockMovement): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `INSERT INTO stock_movements (id, business_id, product_id, product_name, previous_qty, change_qty,
     new_qty, type, reason, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [movement.id, movement.businessId, movement.productId, movement.productName, movement.previousQty,
     movement.changeQty, movement.newQty, movement.type, movement.reason || null, movement.referenceId || null,
     movement.createdAt]
  );
}

export async function getStockMovements(productId: string): Promise<StockMovement[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC`, [productId]
  );
  return rows.map(r => ({
    id: r.id, businessId: r.business_id, productId: r.product_id, productName: r.product_name,
    previousQty: r.previous_qty, changeQty: r.change_qty, newQty: r.new_qty, type: r.type,
    reason: r.reason, referenceId: r.reference_id, createdAt: r.created_at,
  }));
}

// ============== CUSTOMERS ==============
 export async function createCustomer(customer: Customer): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .insert({
      id: customer.id,
      business_id: customer.businessId,
      name: customer.name,
      mobile: customer.mobile || null,
      email: customer.email || null,
      address: customer.address || null,
      opening_balance: customer.openingBalance,
      balance: customer.balance,
      credit_limit: customer.creditLimit ?? null,
      notes: customer.notes || null,
      created_at: customer.createdAt,
      updated_at: customer.updatedAt,
    });

  if (error) {
    throw error;
  }

  // Customer ledger will be migrated separately.
  // Do not call the old SQLite createCustomerLedger() here.
}

export async function updateCustomer(customer: Customer): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({
      name: customer.name,
      mobile: customer.mobile || null,
      email: customer.email || null,
      address: customer.address || null,
      credit_limit: customer.creditLimit ?? null,
      notes: customer.notes || null,
      updated_at: customer.updatedAt,
    })
    .eq('id', customer.id);

  if (error) {
    throw error;
  }
}

export async function getCustomers(businessId: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .order('name');

  if (error) {
    throw error;
  }

  return (data || []).map(mapCustomer);
}

export async function searchCustomers(
  businessId: string,
  query: string
): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .or(`name.ilike.%${query}%,mobile.ilike.%${query}%`)
    .order('name');

  if (error) {
    throw error;
  }

  return (data || []).map(mapCustomer);
}

export async function getCustomerById(
  id: string
): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapCustomer(data);
}

export async function updateCustomerBalance(
  customerId: string,
  newBalance: number
): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({
      balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId);

  if (error) {
    throw error;
  }
}

export async function getCustomerStats(
  businessId: string,
  customerId: string
): Promise<{
  totalPurchases: number;
  totalPaid: number;
  purchaseCount: number;
}> {
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('total')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .eq('status', 'completed');

  if (salesError) {
    throw salesError;
  }

  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('amount')
    .eq('business_id', businessId)
    .eq('customer_id', customerId);

  if (paymentsError) {
    throw paymentsError;
  }

  const totalPurchases = (sales || []).reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const totalPaid = (payments || []).reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  return {
    totalPurchases,
    totalPaid,
    purchaseCount: sales?.length || 0,
  };
}

function mapCustomer(row: any): Customer {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    mobile: row.mobile,
    email: row.email,
    address: row.address,
    openingBalance: Number(row.opening_balance || 0),
    balance: Number(row.balance || 0),
    creditLimit: row.credit_limit != null
      ? Number(row.credit_limit)
      : undefined,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============== CUSTOMER LEDGER ==============
 export async function createCustomerLedger(
  entry: CustomerLedger
): Promise<void> {
  const { error } = await supabase
    .from('customer_ledger')
    .insert({
      id: entry.id,
      business_id: entry.businessId,
      customer_id: entry.customerId,
      customer_name: entry.customerName,
      date: entry.date,
      type: entry.type,
      description: entry.description,
      reference_id: entry.referenceId ?? null,
      debit: entry.debit,
      credit: entry.credit,
      balance: entry.balance,
      created_at: entry.createdAt,
    });

  if (error) {
    throw error;
  }
}

export async function getCustomerLedger(
  customerId: string
): Promise<CustomerLedger[]> {
  const { data, error } = await supabase
    .from('customer_ledger')
    .select('*')
    .eq('customer_id', customerId)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(mapCustomerLedger);
}

export async function getCustomerLedgerByBusiness(
  businessId: string,
  customerId: string
): Promise<CustomerLedger[]> {
  const { data, error } = await supabase
    .from('customer_ledger')
    .select('*')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(mapCustomerLedger);
}

export async function recalculateCustomerBalance(
  customerId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('customer_ledger')
    .select('debit, credit')
    .eq('customer_id', customerId)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  let balance = 0;

  for (const row of data || []) {
    balance += Number(row.debit || 0) - Number(row.credit || 0);
  }

  const { error: updateError } = await supabase
    .from('customers')
    .update({
      balance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId);

  if (updateError) {
    throw updateError;
  }

  return balance;
}

function mapCustomerLedger(row: any): CustomerLedger {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    date: row.date,
    type: row.type,
    description: row.description,
    referenceId: row.reference_id,
    debit: Number(row.debit || 0),
    credit: Number(row.credit || 0),
    balance: Number(row.balance || 0),
    createdAt: row.created_at,
  };
}


// ============== SUPPLIER LEDGER ==============

export async function createSupplierLedger(entry: SupplierLedger): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `INSERT INTO supplier_ledger (id, business_id, supplier_id, supplier_name, date, type, description,
     reference_id, debit, credit, balance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.businessId, entry.supplierId, entry.supplierName, entry.date, entry.type, entry.description,
     entry.referenceId || null, entry.debit, entry.credit, entry.balance, entry.createdAt]
  );
}

export async function getSupplierLedger(supplierId: string): Promise<SupplierLedger[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM supplier_ledger WHERE supplier_id = ? ORDER BY date ASC, created_at ASC`, [supplierId]
  );
  return rows.map(r => ({
    id: r.id, businessId: r.business_id, supplierId: r.supplier_id, supplierName: r.supplier_name,
    date: r.date, type: r.type, description: r.description, referenceId: r.reference_id,
    debit: r.debit, credit: r.credit, balance: r.balance, createdAt: r.created_at,
  }));
}

export async function recalculateSupplierBalance(supplierId: string): Promise<number> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT debit, credit FROM supplier_ledger WHERE supplier_id = ? ORDER BY date ASC, created_at ASC`, [supplierId]
  );
  let balance = 0;
  for (const row of rows) {
    balance += row.debit - row.credit;
  }
  await database.runAsync(`UPDATE suppliers SET balance = ? WHERE id = ?`, [balance, supplierId]);
  return balance;
}

// ============== SALES ==============

export async function createSale(sale: Sale, items: SaleItem[], stockMovements: StockMovement[], invoiceHtml: string): Promise<void> {
  const database = await getDB();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO sales (id, business_id, invoice_number, customer_id, customer_name, subtotal, discount,
       tax_amount, total, paid, due, payment_method, status, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sale.id, sale.businessId, sale.invoiceNumber, sale.customerId || null, sale.customerName || null,
       sale.subtotal, sale.discount, sale.taxAmount, sale.total, sale.paid, sale.due,
       sale.paymentMethod, sale.status, sale.notes || null, sale.createdAt]
    );

    for (const item of items) {
      await database.runAsync(
        `INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, price, discount,
         tax_rate, tax_amount, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.saleId, item.productId, item.productName, item.quantity, item.price,
         item.discount, item.taxRate, item.taxAmount, item.total]
      );
    }

    for (const movement of stockMovements) {
      await database.runAsync(
        `INSERT INTO stock_movements (id, business_id, product_id, product_name, previous_qty, change_qty,
         new_qty, type, reason, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [movement.id, movement.businessId, movement.productId, movement.productName, movement.previousQty,
         movement.changeQty, movement.newQty, movement.type, movement.reason || null, movement.referenceId || null,
         movement.createdAt]
      );
      await database.runAsync(
        `UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?`,
        [movement.newQty, new Date().toISOString(), movement.productId]
      );
    }

    await database.runAsync(
      `INSERT INTO invoices (id, business_id, sale_id, invoice_number, html_content, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), sale.businessId, sale.id, sale.invoiceNumber, invoiceHtml, sale.createdAt]
    );

    if (sale.customerId && sale.due > 0) {
      const customer = await getCustomerById(sale.customerId);
      if (customer) {
        const newBalance = customer.balance + sale.due;
        await database.runAsync(`UPDATE customers SET balance = ?, updated_at = ? WHERE id = ?`, [newBalance, new Date().toISOString(), sale.customerId]);
        await createCustomerLedger({
          id: generateId(), businessId: sale.businessId, customerId: sale.customerId, customerName: customer.name,
          date: sale.createdAt, type: 'credit_sale', description: `Sale ${sale.invoiceNumber}`, referenceId: sale.id,
          debit: sale.due, credit: 0, balance: newBalance, createdAt: new Date().toISOString(),
        });
      }
    }
  });
}

export async function createSalesReturn(saleId: string, returnedItems: { productId: string; productName: string; quantity: number; price: number; }[], reason: string): Promise<void> {
  const database = await getDB();
  const originalSale = await getSaleById(saleId);
  if (!originalSale) throw new Error('Original sale not found');
  const now = new Date().toISOString();

  await database.withTransactionAsync(async () => {
    const returnAmount = returnedItems.reduce((s, i) => s + i.quantity * i.price, 0);
    const newStatus = returnAmount >= originalSale.total ? 'returned' : 'completed';

    await database.runAsync(
      `UPDATE sales SET status = ?, updated_at = ? WHERE id = ?`,
      [newStatus, now, saleId]
    );

    for (const item of returnedItems) {
      const product = await getProductById(item.productId);
      if (product) {
        const newQty = product.currentStock + item.quantity;
        await database.runAsync(
          `INSERT INTO stock_movements (id, business_id, product_id, product_name, previous_qty, change_qty,
           new_qty, type, reason, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [generateId(), originalSale.businessId, item.productId, item.productName, product.currentStock,
           item.quantity, newQty, 'sales_return', `Sales Return - ${reason}`, saleId, now]
        );
        await database.runAsync(`UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?`, [newQty, now, item.productId]);
      }
    }

    if (originalSale.customerId) {
      const customer = await getCustomerById(originalSale.customerId);
      if (customer) {
        const refundAmount = Math.min(returnAmount, customer.balance);
        if (refundAmount > 0) {
          const newBalance = customer.balance - refundAmount;
          await database.runAsync(`UPDATE customers SET balance = ?, updated_at = ? WHERE id = ?`, [newBalance, now, customer.id]);
          await createCustomerLedger({
            id: generateId(), businessId: originalSale.businessId, customerId: customer.id, customerName: customer.name,
            date: now, type: 'sales_return', description: `Sales Return - ${reason}`, referenceId: saleId,
            debit: 0, credit: refundAmount, balance: newBalance, createdAt: now,
          });
        }
      }
    }
  });
}

export async function getSales(businessId: string, limit = 50): Promise<Sale[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM sales WHERE business_id = ? ORDER BY created_at DESC LIMIT ?`, [businessId, limit]
  );
  return rows.map(mapSale);
}

export async function getSalesByDateRange(businessId: string, start: string, end: string): Promise<Sale[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM sales WHERE business_id = ? AND created_at >= ? AND created_at <= ? AND status = 'completed' ORDER BY created_at DESC`,
    [businessId, start, end]
  );
  return rows.map(mapSale);
}

export async function getSaleById(id: string): Promise<Sale | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(`SELECT * FROM sales WHERE id = ?`, [id]);
  if (!row) return null;
  return mapSale(row);
}

export async function getSaleItems(saleId: string): Promise<SaleItem[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(`SELECT * FROM sale_items WHERE sale_id = ?`, [saleId]);
  return rows.map(r => ({
    id: r.id, saleId: r.sale_id, productId: r.product_id, productName: r.product_name,
    quantity: r.quantity, price: r.price, discount: r.discount, taxRate: r.tax_rate,
    taxAmount: r.tax_amount, total: r.total,
  }));
}

export async function searchSales(businessId: string, query: string): Promise<Sale[]> {
  const database = await getDB();
  const searchTerm = `%${query}%`;
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM sales WHERE business_id = ? AND (invoice_number LIKE ? OR customer_name LIKE ?) ORDER BY created_at DESC LIMIT 50`,
    [businessId, searchTerm, searchTerm]
  );
  return rows.map(mapSale);
}

function mapSale(row: any): Sale {
  return {
    id: row.id, businessId: row.business_id, invoiceNumber: row.invoice_number, customerId: row.customer_id,
    customerName: row.customer_name, subtotal: row.subtotal, discount: row.discount, taxAmount: row.tax_amount,
    total: row.total, paid: row.paid, due: row.due, paymentMethod: row.payment_method, status: row.status,
    notes: row.notes, createdAt: row.created_at,
  };
}

// ============== PURCHASES ==============

export async function createPurchase(purchase: Purchase, items: PurchaseItem[], stockMovements: StockMovement[]): Promise<void> {
  const database = await getDB();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO purchases (id, business_id, invoice_number, supplier_id, supplier_name, subtotal, discount,
       tax_amount, total, paid, due, payment_method, status, notes, supplier_invoice_number, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [purchase.id, purchase.businessId, purchase.invoiceNumber, purchase.supplierId, purchase.supplierName,
       purchase.subtotal, purchase.discount, purchase.taxAmount, purchase.total, purchase.paid, purchase.due,
       purchase.paymentMethod, purchase.status, purchase.notes || null, purchase.supplierInvoiceNumber || null,
       purchase.createdAt]
    );

    for (const item of items) {
      await database.runAsync(
        `INSERT INTO purchase_items (id, purchase_id, product_id, product_name, quantity, price, discount,
         tax_rate, tax_amount, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.purchaseId, item.productId || null, item.productName, item.quantity, item.price,
         item.discount, item.taxRate, item.taxAmount, item.total]
      );
    }

    for (const movement of stockMovements) {
      await database.runAsync(
        `INSERT INTO stock_movements (id, business_id, product_id, product_name, previous_qty, change_qty,
         new_qty, type, reason, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [movement.id, movement.businessId, movement.productId, movement.productName, movement.previousQty,
         movement.changeQty, movement.newQty, movement.type, movement.reason || null, movement.referenceId || null,
         movement.createdAt]
      );
      await database.runAsync(`UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?`, [movement.newQty, new Date().toISOString(), movement.productId]);
    }

    if (purchase.supplierId && purchase.due > 0) {
      const supplier = await getSupplierById(purchase.supplierId);
      if (supplier) {
        const newBalance = supplier.balance + purchase.due;
        await database.runAsync(`UPDATE suppliers SET balance = ?, updated_at = ? WHERE id = ?`, [newBalance, new Date().toISOString(), purchase.supplierId]);
        await createSupplierLedger({
          id: generateId(), businessId: purchase.businessId, supplierId: purchase.supplierId, supplierName: supplier.name,
          date: purchase.createdAt, type: 'purchase', description: `Purchase ${purchase.invoiceNumber}`, referenceId: purchase.id,
          debit: purchase.due, credit: 0, balance: newBalance, createdAt: new Date().toISOString(),
        });
      }
    }
  });
}

export async function createPurchaseReturn(purchaseId: string, returnedItems: { productId: string; productName: string; quantity: number; price: number; }[], reason: string): Promise<void> {
  const database = await getDB();
  const originalPurchase = await getPurchaseById(purchaseId);
  if (!originalPurchase) throw new Error('Original purchase not found');
  const now = new Date().toISOString();

  await database.withTransactionAsync(async () => {
    const returnAmount = returnedItems.reduce((s, i) => s + i.quantity * i.price, 0);

    for (const item of returnedItems) {
      const product = await getProductById(item.productId);
      if (product) {
        const newQty = Math.max(0, product.currentStock - item.quantity);
        await database.runAsync(
          `INSERT INTO stock_movements (id, business_id, product_id, product_name, previous_qty, change_qty,
           new_qty, type, reason, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [generateId(), originalPurchase.businessId, item.productId, item.productName, product.currentStock,
           -item.quantity, newQty, 'purchase_return', `Purchase Return - ${reason}`, purchaseId, now]
        );
        await database.runAsync(`UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?`, [newQty, now, item.productId]);
      }
    }

    if (originalPurchase.supplierId) {
      const supplier = await getSupplierById(originalPurchase.supplierId);
      if (supplier) {
        const refundAmount = Math.min(returnAmount, supplier.balance);
        if (refundAmount > 0) {
          const newBalance = supplier.balance - refundAmount;
          await database.runAsync(`UPDATE suppliers SET balance = ?, updated_at = ? WHERE id = ?`, [newBalance, now, supplier.id]);
          await createSupplierLedger({
            id: generateId(), businessId: originalPurchase.businessId, supplierId: supplier.id, supplierName: supplier.name,
            date: now, type: 'purchase_return', description: `Purchase Return - ${reason}`, referenceId: purchaseId,
            debit: 0, credit: refundAmount, balance: newBalance, createdAt: now,
          });
        }
      }
    }
  });
}

export async function getPurchases(businessId: string, limit = 50): Promise<Purchase[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM purchases WHERE business_id = ? ORDER BY created_at DESC LIMIT ?`, [businessId, limit]
  );
  return rows.map(mapPurchase);
}

export async function getPurchaseById(id: string): Promise<Purchase | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(`SELECT * FROM purchases WHERE id = ?`, [id]);
  if (!row) return null;
  return mapPurchase(row);
}

export async function getPurchaseItems(purchaseId: string): Promise<PurchaseItem[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(`SELECT * FROM purchase_items WHERE purchase_id = ?`, [purchaseId]);
  return rows.map(r => ({
    id: r.id, purchaseId: r.purchase_id, productId: r.product_id, productName: r.product_name,
    quantity: r.quantity, price: r.price, discount: r.discount, taxRate: r.tax_rate,
    taxAmount: r.tax_amount, total: r.total,
  }));
}

export async function getPurchasesBySupplier(businessId: string, supplierId: string): Promise<Purchase[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM purchases WHERE business_id = ? AND supplier_id = ? ORDER BY created_at DESC`, [businessId, supplierId]
  );
  return rows.map(mapPurchase);
}

function mapPurchase(row: any): Purchase {
  return {
    id: row.id, businessId: row.business_id, invoiceNumber: row.invoice_number, supplierId: row.supplier_id,
    supplierName: row.supplier_name, subtotal: row.subtotal, discount: row.discount, taxAmount: row.tax_amount,
    total: row.total, paid: row.paid, due: row.due, paymentMethod: row.payment_method, status: row.status,
    notes: row.notes, supplierInvoiceNumber: row.supplier_invoice_number, createdAt: row.created_at,
  };
}

// ============== PAYMENTS ==============

export async function createPayment(payment: Payment): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `INSERT INTO payments (id, business_id, customer_id, supplier_id, sale_id, purchase_id, amount, method, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [payment.id, payment.businessId, payment.customerId || null, payment.supplierId || null,
     payment.saleId || null, payment.purchaseId || null, payment.amount, payment.method,
     payment.notes || null, payment.createdAt]
  );

  if (payment.customerId && !payment.saleId) {
    const customer = await getCustomerById(payment.customerId);
    if (customer) {
      const newBalance = customer.balance - payment.amount;
      await database.runAsync(`UPDATE customers SET balance = ?, updated_at = ? WHERE id = ?`, [newBalance, new Date().toISOString(), payment.customerId]);
      await createCustomerLedger({
        id: generateId(), businessId: payment.businessId, customerId: payment.customerId, customerName: customer.name,
        date: payment.createdAt, type: 'payment_received', description: `Payment Received - ${payment.method.toUpperCase()}`,
        referenceId: payment.id, debit: 0, credit: payment.amount, balance: newBalance, createdAt: payment.createdAt,
      });
    }
  }

  if (payment.supplierId && !payment.purchaseId) {
    const supplier = await getSupplierById(payment.supplierId);
    if (supplier) {
      const newBalance = supplier.balance - payment.amount;
      await database.runAsync(`UPDATE suppliers SET balance = ?, updated_at = ? WHERE id = ?`, [newBalance, new Date().toISOString(), payment.supplierId]);
      await createSupplierLedger({
        id: generateId(), businessId: payment.businessId, supplierId: payment.supplierId, supplierName: supplier.name,
        date: payment.createdAt, type: 'payment', description: `Payment - ${payment.method.toUpperCase()}`,
        referenceId: payment.id, debit: 0, credit: payment.amount, balance: newBalance, createdAt: payment.createdAt,
      });
    }
  }
}

export async function getPayments(businessId: string, limit = 50): Promise<Payment[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM payments WHERE business_id = ? ORDER BY created_at DESC LIMIT ?`, [businessId, limit]
  );
  return rows.map(r => ({
    id: r.id, businessId: r.business_id, customerId: r.customer_id, supplierId: r.supplier_id,
    saleId: r.sale_id, purchaseId: r.purchase_id, amount: r.amount, method: r.method,
    notes: r.notes, createdAt: r.created_at,
  }));
}

export async function getPaymentsForCustomer(businessId: string, customerId: string): Promise<Payment[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM payments WHERE business_id = ? AND customer_id = ? ORDER BY created_at DESC`, [businessId, customerId]
  );
  return rows.map(r => ({
    id: r.id, businessId: r.business_id, customerId: r.customer_id, supplierId: r.supplier_id,
    saleId: r.sale_id, purchaseId: r.purchase_id, amount: r.amount, method: r.method,
    notes: r.notes, createdAt: r.created_at,
  }));
}

// ============== EXPENSES ==============

export async function createExpense(expense: Expense): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `INSERT INTO expenses (id, business_id, title, category, amount, payment_method, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [expense.id, expense.businessId, expense.title, expense.category, expense.amount, expense.paymentMethod,
     expense.description || null, expense.createdAt]
  );
}

export async function getExpenses(businessId: string, limit = 50): Promise<Expense[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM expenses WHERE business_id = ? ORDER BY created_at DESC LIMIT ?`, [businessId, limit]
  );
  return rows.map(r => ({
    id: r.id, businessId: r.business_id, title: r.title, category: r.category, amount: r.amount,
    paymentMethod: r.payment_method, description: r.description, createdAt: r.created_at,
  }));
}

export async function getExpensesByDateRange(businessId: string, start: string, end: string): Promise<Expense[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM expenses WHERE business_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC`,
    [businessId, start, end]
  );
  return rows.map(r => ({
    id: r.id, businessId: r.business_id, title: r.title, category: r.category, amount: r.amount,
    paymentMethod: r.payment_method, description: r.description, createdAt: r.created_at,
  }));
}

export async function getTodayExpenses(businessId: string): Promise<number> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(
    `SELECT SUM(amount) as total FROM expenses WHERE business_id = ? AND created_at >= ? AND created_at <= ?`,
    [businessId, getStartOfDay(), getEndOfDay()]
  );
  return row?.total || 0;
}

export async function getExpenseCategories(businessId: string): Promise<{ category: string; amount: number }[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT category, SUM(amount) as total FROM expenses WHERE business_id = ? AND created_at >= ? AND created_at <= ? GROUP BY category ORDER BY total DESC`,
    [businessId, getStartOfDay(), getEndOfDay()]
  );
  return rows.map(r => ({ category: r.category, amount: r.total || 0 }));
}

export async function getExpenseCategoriesByMonth(businessId: string, monthStart: string, monthEnd: string): Promise<{ category: string; amount: number }[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT category, SUM(amount) as total FROM expenses WHERE business_id = ? AND created_at >= ? AND created_at <= ? GROUP BY category ORDER BY total DESC`,
    [businessId, monthStart, monthEnd]
  );
  return rows.map(r => ({ category: r.category, amount: r.total || 0 }));
}

// ============== INVOICES ==============

export async function getInvoiceHtml(saleId: string): Promise<string | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(`SELECT html_content FROM invoices WHERE sale_id = ?`, [saleId]);
  return row?.html_content || null;
}

// ============== BUSINESS SETTINGS ==============

export async function createBusinessSettings(settings: BusinessSettings): Promise<void> {
  const { error } = await supabase.from('business_settings').insert({
    id: settings.id, business_id: settings.businessId, allow_negative_stock: settings.allowNegativeStock,
    low_stock_alert_enabled: settings.lowStockAlertEnabled, payment_reminder_enabled: settings.paymentReminderEnabled,
    auto_backup_enabled: settings.autoBackupEnabled, backup_interval: settings.backupInterval,
    last_backup_at: settings.lastBackupAt || null, pin_code: settings.pinCode || null, updated_at: settings.updatedAt,
  });
  if (error) throw error;
}

export async function getBusinessSettings(businessId: string): Promise<BusinessSettings | null> {
  const { data: row, error } = await supabase.from('business_settings').select('*').eq('business_id', businessId).maybeSingle();
  if (error) throw error;
  if (!row) return null;
  return {
    id: row.id, businessId: row.business_id, allowNegativeStock: row.allow_negative_stock,
    lowStockAlertEnabled: row.low_stock_alert_enabled, paymentReminderEnabled: row.payment_reminder_enabled,
    autoBackupEnabled: row.auto_backup_enabled === 1, backupInterval: row.backup_interval,
    lastBackupAt: row.last_backup_at, pinCode: row.pin_code, updatedAt: row.updated_at,
  };
}

export async function updateBusinessSettings(settings: BusinessSettings): Promise<void> {
  const { error } = await supabase.from('business_settings').update({
    allow_negative_stock: settings.allowNegativeStock, low_stock_alert_enabled: settings.lowStockAlertEnabled,
    payment_reminder_enabled: settings.paymentReminderEnabled, auto_backup_enabled: settings.autoBackupEnabled,
    backup_interval: settings.backupInterval, last_backup_at: settings.lastBackupAt || null,
    pin_code: settings.pinCode || null, updated_at: settings.updatedAt,
  }).eq('business_id', settings.businessId);
  if (error) throw error;
}

// ============== BACKUP RECORDS ==============

export async function createBackupRecord(record: BackupRecord): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    `INSERT INTO backup_records (id, business_id, type, data_size, created_at, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.businessId, record.type, record.dataSize, record.createdAt, record.status, record.errorMessage || null]
  );
  await database.runAsync(
    `UPDATE business_settings SET last_backup_at = ? WHERE business_id = ?`,
    [record.createdAt, record.businessId]
  );
}

export async function getLastBackupRecord(businessId: string): Promise<BackupRecord | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(
    `SELECT * FROM backup_records WHERE business_id = ? ORDER BY created_at DESC LIMIT 1`, [businessId]
  );
  if (!row) return null;
  return {
    id: row.id, businessId: row.business_id, type: row.type, dataSize: row.data_size,
    createdAt: row.created_at, status: row.status, errorMessage: row.error_message,
  };
}

// ============== DASHBOARD & STATS ==============

export async function getDashboardStats(businessId: string): Promise<DashboardStats> {
  const database = await getDB();
  const todayStart = getStartOfDay();
  const todayEnd = getEndOfDay();

  const salesRow = await database.getFirstAsync<any>(
    `SELECT COUNT(*) as bill_count, SUM(total) as total_sales FROM sales WHERE business_id = ? AND created_at >= ? AND created_at <= ? AND status = 'completed'`,
    [businessId, todayStart, todayEnd]
  );

  const purchasesRow = await database.getFirstAsync<any>(
    `SELECT SUM(total) as total_purchases FROM purchases WHERE business_id = ? AND created_at >= ? AND created_at <= ? AND status = 'completed'`,
    [businessId, todayStart, todayEnd]
  );

  const expensesRow = await database.getFirstAsync<any>(
    `SELECT SUM(amount) as total_expenses FROM expenses WHERE business_id = ? AND created_at >= ? AND created_at <= ?`,
    [businessId, todayStart, todayEnd]
  );

  const cashRow = await database.getFirstAsync<any>(
    `SELECT SUM(paid) as total_cash FROM sales WHERE business_id = ? AND created_at >= ? AND created_at <= ? AND status = 'completed' AND (payment_method = 'cash' OR payment_method = 'mixed')`,
    [businessId, todayStart, todayEnd]
  );

  const receivablesRow = await database.getFirstAsync<any>(
    `SELECT SUM(due) as total_due FROM sales WHERE business_id = ? AND status = 'completed'`, [businessId]
  );

  const customerBalanceRow = await database.getFirstAsync<any>(
    `SELECT SUM(balance) as total_balance FROM customers WHERE business_id = ?`, [businessId]
  );

  const lowStockRow = await database.getFirstAsync<any>(
    `SELECT COUNT(*) as count FROM products WHERE business_id = ? AND is_archived = 0 AND current_stock <= min_stock_level AND current_stock > 0`,
    [businessId]
  );

  const outOfStockRow = await database.getFirstAsync<any>(
    `SELECT COUNT(*) as count FROM products WHERE business_id = ? AND is_archived = 0 AND current_stock <= 0`, [businessId]
  );

  const profitRow = await database.getFirstAsync<any>(
    `SELECT SUM((si.price - p.purchase_price) * si.quantity) as profit FROM sale_items si
     JOIN products p ON si.product_id = p.id
     JOIN sales s ON si.sale_id = s.id
     WHERE s.business_id = ? AND s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'`,
    [businessId, todayStart, todayEnd]
  );

  const totalCash = (cashRow?.total_cash || 0) - (expensesRow?.total_expenses || 0);

  return {
    todaySales: salesRow?.total_sales || 0, todayBills: salesRow?.bill_count || 0,
    todayExpenses: expensesRow?.total_expenses || 0, todayCash: totalCash,
    totalReceivables: receivablesRow?.total_due || 0, lowStockCount: lowStockRow?.count || 0,
    outOfStockCount: outOfStockRow?.count || 0, currentBalance: customerBalanceRow?.total_balance || 0,
    todayPurchases: purchasesRow?.total_purchases || 0, estimatedProfit: profitRow?.profit || 0,
  };
}

export async function getRecentTransactions(businessId: string): Promise<RecentTransaction[]> {
  const database = await getDB();
  const todayStart = getStartOfDay();
  const todayEnd = getEndOfDay();

  const salesRows = await database.getAllAsync<any>(
    `SELECT id, invoice_number, total, created_at FROM sales WHERE business_id = ? AND created_at >= ? AND created_at <= ? AND status = 'completed' ORDER BY created_at DESC LIMIT 5`,
    [businessId, todayStart, todayEnd]
  );

  const paymentRows = await database.getAllAsync<any>(
    `SELECT id, customer_id, amount, created_at FROM payments WHERE business_id = ? AND created_at >= ? AND created_at <= ? AND customer_id IS NOT NULL ORDER BY created_at DESC LIMIT 5`,
    [businessId, todayStart, todayEnd]
  );

  const expenseRows = await database.getAllAsync<any>(
    `SELECT id, title, amount, created_at FROM expenses WHERE business_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC LIMIT 5`,
    [businessId, todayStart, todayEnd]
  );

  const transactions: RecentTransaction[] = [];

  for (const row of salesRows) {
    transactions.push({ id: row.id, type: 'sale', description: `Sale ${row.invoice_number}`, amount: row.total, date: row.created_at });
  }
  for (const row of paymentRows) {
    transactions.push({ id: row.id, type: 'payment', description: 'Payment Received', amount: row.amount, date: row.created_at });
  }
  for (const row of expenseRows) {
    transactions.push({ id: row.id, type: 'expense', description: row.title, amount: row.amount, date: row.created_at });
  }

  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return transactions.slice(0, 10);
}

// ============== UNIFIED TRANSACTIONS ==============

export async function getUnifiedTransactions(businessId: string, limit = 100): Promise<UnifiedTransaction[]> {
  const database = await getDB();
  const transactions: UnifiedTransaction[] = [];

  const salesRows = await database.getAllAsync<any>(
    `SELECT id, invoice_number, total, customer_name, created_at FROM sales WHERE business_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT ?`,
    [businessId, limit]
  );
  for (const row of salesRows) {
    transactions.push({ id: row.id, type: 'sale', description: `Sale ${row.invoice_number}`, amount: row.total, date: row.created_at, referenceId: row.id, entityName: row.customer_name, debit: 0, credit: row.total });
  }

  const purchaseRows = await database.getAllAsync<any>(
    `SELECT id, invoice_number, total, supplier_name, created_at FROM purchases WHERE business_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT ?`,
    [businessId, limit]
  );
  for (const row of purchaseRows) {
    transactions.push({ id: row.id, type: 'purchase', description: `Purchase ${row.invoice_number}`, amount: row.total, date: row.created_at, referenceId: row.id, entityName: row.supplier_name, debit: row.total, credit: 0 });
  }

  const paymentRows = await database.getAllAsync<any>(
    `SELECT id, customer_id, supplier_id, amount, created_at FROM payments WHERE business_id = ? ORDER BY created_at DESC LIMIT ?`,
    [businessId, limit]
  );
  for (const row of paymentRows) {
    if (row.customer_id) {
      transactions.push({ id: row.id, type: 'customer_payment', description: 'Customer Payment', amount: row.amount, date: row.created_at, debit: 0, credit: row.amount });
    } else if (row.supplier_id) {
      transactions.push({ id: row.id, type: 'supplier_payment', description: 'Supplier Payment', amount: row.amount, date: row.created_at, debit: row.amount, credit: 0 });
    }
  }

  const expenseRows = await database.getAllAsync<any>(
    `SELECT id, title, amount, created_at FROM expenses WHERE business_id = ? ORDER BY created_at DESC LIMIT ?`,
    [businessId, limit]
  );
  for (const row of expenseRows) {
    transactions.push({ id: row.id, type: 'expense', description: row.title, amount: row.amount, date: row.created_at, debit: row.amount, credit: 0 });
  }

  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return transactions.slice(0, limit);
}

// ============== REPORTS ==============

export async function getSalesReport(businessId: string, start: string, end: string): Promise<SalesReport> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(
    `SELECT COUNT(*) as bills, SUM(total) as total, SUM(discount) as discount, SUM(tax_amount) as tax,
     SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) as cash,
     SUM(CASE WHEN payment_method = 'upi' THEN total ELSE 0 END) as upi,
     SUM(CASE WHEN payment_method = 'credit' THEN total ELSE 0 END) as credit,
     SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END) as card
     FROM sales WHERE business_id = ? AND created_at >= ? AND created_at <= ? AND status = 'completed'`,
    [businessId, start, end]
  );
  const itemsRow = await database.getFirstAsync<any>(
    `SELECT SUM(quantity) as total_items FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.business_id = ? AND s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'`,
    [businessId, start, end]
  );

  return {
    totalSales: row?.total || 0, totalBills: row?.bills || 0, totalItems: itemsRow?.total_items || 0,
    cashSales: row?.cash || 0, upiSales: row?.upi || 0, creditSales: row?.credit || 0, cardSales: row?.card || 0,
    averageBill: row?.bills > 0 ? (row.total / row.bills) : 0, discountTotal: row?.discount || 0, taxTotal: row?.tax || 0,
    period: `${start} to ${end}`,
  };
}

export async function getProductReport(businessId: string, limit = 50): Promise<ProductReport[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT p.id, p.name, p.current_stock, COALESCE(s.total_sold, 0) as total_sold,
     COALESCE(s.total_revenue, 0) as total_revenue, COALESCE(s.total_profit, 0) as total_profit
     FROM products p
     LEFT JOIN (
       SELECT product_id, SUM(quantity) as total_sold, SUM(total) as total_revenue,
        SUM((price - p2.purchase_price) * quantity) as total_profit
       FROM sale_items si
       JOIN sales s2 ON si.sale_id = s2.id
       JOIN products p2 ON si.product_id = p2.id
       WHERE s2.status = 'completed' AND s2.business_id = ?
       GROUP BY product_id
     ) s ON p.id = s.product_id
     WHERE p.business_id = ? AND p.is_archived = 0
     ORDER BY total_sold DESC LIMIT ?`,
    [businessId, businessId, limit]
  );

  return rows.map((r: any) => {
    const status = r.total_sold > 20 ? 'best_seller' : r.total_sold < 3 && r.current_stock > 0 ? 'slow_moving' : 'normal';
    return { productId: r.id, productName: r.name, totalSold: r.total_sold, totalRevenue: r.total_revenue, totalProfit: r.total_profit, currentStock: r.current_stock, status };
  });
}

export async function getCustomerReport(businessId: string): Promise<CustomerReport[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT c.id, c.name, c.balance, COALESCE(s.total_purchases, 0) as total_purchases, COALESCE(s.purchase_count, 0) as purchase_count
     FROM customers c
     LEFT JOIN (
       SELECT customer_id, SUM(total) as total_purchases, COUNT(*) as purchase_count FROM sales WHERE business_id = ? AND status = 'completed' GROUP BY customer_id
     ) s ON c.id = s.customer_id
     WHERE c.business_id = ? ORDER BY total_purchases DESC`,
    [businessId, businessId]
  );
  const reports: CustomerReport[] = [];
  for (const r of rows) {
    const payments = await database.getFirstAsync<any>(
      `SELECT SUM(amount) as total FROM payments WHERE business_id = ? AND customer_id = ?`, [businessId, r.id]
    );
    reports.push({
      customerId: r.id, customerName: r.name, totalPurchases: r.total_purchases,
      totalPaid: payments?.total || 0, outstanding: r.balance, purchaseCount: r.purchase_count,
    });
  }
  return reports;
}

export async function getExpenseReport(businessId: string, start: string, end: string): Promise<ExpenseReport> {
  const database = await getDB();
  const totalRow = await database.getFirstAsync<any>(
    `SELECT SUM(amount) as total FROM expenses WHERE business_id = ? AND created_at >= ? AND created_at <= ?`,
    [businessId, start, end]
  );
  const total = totalRow?.total || 0;
  const catRows = await database.getAllAsync<any>(
    `SELECT category, SUM(amount) as total FROM expenses WHERE business_id = ? AND created_at >= ? AND created_at <= ? GROUP BY category ORDER BY total DESC`,
    [businessId, start, end]
  );
  return {
    totalExpenses: total,
    categoryBreakdown: catRows.map((r: any) => ({ category: r.category, amount: r.total, percentage: total > 0 ? Math.round((r.total / total) * 100) : 0 })),
    period: `${start} to ${end}`,
  };
}

export async function getBalanceSummary(businessId: string): Promise<{
  cashInHand: number; bankBalance: number; upiBalance: number; totalReceivables: number;
  totalPayables: number; totalStockValue: number; netPosition: number;
}> {
  const database = await getDB();
  const todayEnd = getEndOfDay();

  const salesPayments = await database.getAllAsync<any>(
    `SELECT method, SUM(paid) as total FROM sales WHERE business_id = ? AND status = 'completed' AND created_at <= ? GROUP BY method`,
    [businessId, todayEnd]
  );

  const cashSales = salesPayments.find((r: any) => r.method === 'cash')?.total || 0;
  const upiSales = salesPayments.find((r: any) => r.method === 'upi')?.total || 0;
  const cardSales = salesPayments.find((r: any) => r.method === 'card')?.total || 0;

  const expenses = await database.getFirstAsync<any>(
    `SELECT SUM(amount) as total FROM expenses WHERE business_id = ? AND created_at <= ?`, [businessId, todayEnd]
  );
  const totalExpenses = expenses?.total || 0;

  const cashExpenses = totalExpenses * 0.6;
  const upiExpenses = totalExpenses * 0.2;
  const cardExpenses = totalExpenses * 0.2;

  const receivables = await database.getFirstAsync<any>(
    `SELECT SUM(balance) as total FROM customers WHERE business_id = ?`, [businessId]
  );
  const payables = await database.getFirstAsync<any>(
    `SELECT SUM(balance) as total FROM suppliers WHERE business_id = ?`, [businessId]
  );

  const stockValue = await database.getFirstAsync<any>(
    `SELECT SUM(purchase_price * current_stock) as total FROM products WHERE business_id = ? AND is_archived = 0`, [businessId]
  );

  const cashInHand = cashSales - cashExpenses;
  const upiBalance = upiSales - upiExpenses;
  const bankBalance = cardSales - cardExpenses;
  const totalReceivables = receivables?.total || 0;
  const totalPayables = payables?.total || 0;
  const totalStockValue = stockValue?.total || 0;

  return {
    cashInHand, bankBalance, upiBalance, totalReceivables, totalPayables, totalStockValue,
    netPosition: cashInHand + bankBalance + upiBalance + totalReceivables - totalPayables + totalStockValue,
  };
}

// ============== EXPORT / BACKUP ==============

export async function exportAllData(businessId: string): Promise<any> {
  const database = await getDB();
  const data: any = { businessId, exportedAt: new Date().toISOString() };
  const tables = ['businesses', 'categories', 'suppliers', 'products', 'stock_movements', 'customers',
    'sales', 'sale_items', 'purchases', 'purchase_items', 'payments', 'expenses', 'invoices',
    'customer_ledger', 'supplier_ledger', 'business_settings', 'backup_records'];

  for (const table of tables) {
    const rows = await database.getAllAsync<any>(`SELECT * FROM ${table} WHERE business_id = ?`, [businessId]);
    data[table] = rows;
  }
  return data;
}

export async function importData(data: any): Promise<void> {
  const database = await getDB();
  await database.withTransactionAsync(async () => {
    if (data.businesses) {
      for (const row of data.businesses) {
        await database.runAsync(
          `INSERT OR REPLACE INTO businesses (id, owner_name, store_name, mobile_number, address, gstin, business_type, currency,
           default_tax_rate, invoice_prefix, invoice_next_number, thank_you_message, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.owner_name, row.store_name, row.mobile_number, row.address, row.gstin, row.business_type,
           row.currency, row.default_tax_rate, row.invoice_prefix, row.invoice_next_number, row.thank_you_message,
           row.created_at, row.updated_at]
        );
      }
    }
    if (data.customers) {
      for (const row of data.customers) {
        await database.runAsync(
          `INSERT OR REPLACE INTO customers (id, business_id, name, mobile, email, address, opening_balance, balance, credit_limit, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.business_id, row.name, row.mobile, row.email, row.address, row.opening_balance || 0, row.balance || 0,
           row.credit_limit, row.notes, row.created_at, row.updated_at]
        );
      }
    }
    if (data.suppliers) {
      for (const row of data.suppliers) {
        await database.runAsync(
          `INSERT OR REPLACE INTO suppliers (id, business_id, name, mobile, email, address, gstin, opening_balance, balance, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.business_id, row.name, row.mobile, row.email, row.address, row.gstin, row.opening_balance || 0,
           row.balance || 0, row.notes, row.created_at, row.updated_at]
        );
      }
    }
    if (data.products) {
      for (const row of data.products) {
        await database.runAsync(
          `INSERT OR REPLACE INTO products (id, business_id, name, barcode, sku, category_id, category_name, brand,
           purchase_price, selling_price, mrp, tax_rate, unit, current_stock, min_stock_level, supplier_id,
           supplier_name, image_uri, expiry_date, batch_number, notes, is_archived, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.business_id, row.name, row.barcode, row.sku, row.category_id, row.category_name, row.brand,
           row.purchase_price, row.selling_price, row.mrp, row.tax_rate, row.unit, row.current_stock, row.min_stock_level,
           row.supplier_id, row.supplier_name, row.image_uri, row.expiry_date, row.batch_number, row.notes,
           row.is_archived, row.created_at, row.updated_at]
        );
      }
    }
    if (data.sales) {
      for (const row of data.sales) {
        await database.runAsync(
          `INSERT OR REPLACE INTO sales (id, business_id, invoice_number, customer_id, customer_name, subtotal, discount,
           tax_amount, total, paid, due, payment_method, status, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.business_id, row.invoice_number, row.customer_id, row.customer_name, row.subtotal, row.discount,
           row.tax_amount, row.total, row.paid, row.due, row.payment_method, row.status, row.notes, row.created_at]
        );
      }
    }
    if (data.sale_items) {
      for (const row of data.sale_items) {
        await database.runAsync(
          `INSERT OR REPLACE INTO sale_items (id, sale_id, product_id, product_name, quantity, price, discount, tax_rate, tax_amount, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.sale_id, row.product_id, row.product_name, row.quantity, row.price, row.discount, row.tax_rate, row.tax_amount, row.total]
        );
      }
    }
    if (data.customer_ledger) {
      for (const row of data.customer_ledger) {
        await database.runAsync(
          `INSERT OR REPLACE INTO customer_ledger (id, business_id, customer_id, customer_name, date, type, description, reference_id, debit, credit, balance, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.business_id, row.customer_id, row.customer_name, row.date, row.type, row.description,
           row.reference_id, row.debit, row.credit, row.balance, row.created_at]
        );
      }
    }
    if (data.supplier_ledger) {
      for (const row of data.supplier_ledger) {
        await database.runAsync(
          `INSERT OR REPLACE INTO supplier_ledger (id, business_id, supplier_id, supplier_name, date, type, description, reference_id, debit, credit, balance, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.business_id, row.supplier_id, row.supplier_name, row.date, row.type, row.description,
           row.reference_id, row.debit, row.credit, row.balance, row.created_at]
        );
      }
    }
    if (data.payments) {
      for (const row of data.payments) {
        await database.runAsync(
          `INSERT OR REPLACE INTO payments (id, business_id, customer_id, supplier_id, sale_id, purchase_id, amount, method, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.business_id, row.customer_id, row.supplier_id, row.sale_id, row.purchase_id, row.amount, row.method, row.notes, row.created_at]
        );
      }
    }
    if (data.expenses) {
      for (const row of data.expenses) {
        await database.runAsync(
          `INSERT OR REPLACE INTO expenses (id, business_id, title, category, amount, payment_method, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.business_id, row.title || row.category, row.category, row.amount, row.payment_method || 'cash', row.description, row.created_at]
        );
      }
    }
    if (data.invoices) {
      for (const row of data.invoices) {
        await database.runAsync(
          `INSERT OR REPLACE INTO invoices (id, business_id, sale_id, invoice_number, html_content, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [row.id, row.business_id, row.sale_id, row.invoice_number, row.html_content, row.created_at]
        );
      }
    }
  });
}

export async function clearAllData(): Promise<void> {
  const database = await getDB();
  await database.execAsync(`
    DELETE FROM backup_records;
    DELETE FROM invoices;
    DELETE FROM sale_items;
    DELETE FROM purchase_items;
    DELETE FROM sales;
    DELETE FROM purchases;
    DELETE FROM stock_movements;
    DELETE FROM customer_ledger;
    DELETE FROM supplier_ledger;
    DELETE FROM payments;
    DELETE FROM expenses;
    DELETE FROM products;
    DELETE FROM customers;
    DELETE FROM suppliers;
    DELETE FROM categories;
    DELETE FROM user_businesses;
    DELETE FROM business_settings;
    DELETE FROM businesses;
    DELETE FROM users;
  `);
}

export async function resetDatabase(): Promise<void> {
  const database = await getDB();
  await database.execAsync(`
    DROP TABLE IF EXISTS backup_records;
    DROP TABLE IF EXISTS business_settings;
    DROP TABLE IF EXISTS customer_ledger;
    DROP TABLE IF EXISTS supplier_ledger;
    DROP TABLE IF EXISTS invoices;
    DROP TABLE IF EXISTS sale_items;
    DROP TABLE IF EXISTS purchase_items;
    DROP TABLE IF EXISTS sales;
    DROP TABLE IF EXISTS purchases;
    DROP TABLE IF EXISTS stock_movements;
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS expenses;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS suppliers;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS user_businesses;
    DROP TABLE IF EXISTS businesses;
    DROP TABLE IF EXISTS users;
  `);
  db = null;
}
