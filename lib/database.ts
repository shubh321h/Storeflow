import {
  User,
  Business,
  Category,
  Supplier,
  Product,
  StockMovement,
  Customer,
  Sale,
  SaleItem,
  Purchase,
  PurchaseItem,
  Payment,
  Expense,
  CustomerLedger,
  SupplierLedger,
  BusinessSettings,
  BackupRecord,
  DashboardStats,
  RecentTransaction,
  UnifiedTransaction,
  SalesReport,
  ProductReport,
  CustomerReport,
  ExpenseReport
} from './types';

import { generateId, getStartOfDay, getEndOfDay } from './utils';
import { supabase } from '../supabase';

type Row = Record<string, any>;

const list = (v: unknown): Row[] => {
  if (Array.isArray(v)) return v as Row[];
  if (v && typeof v === 'object') return [v as Row];
  return [];
};

const n = (v: unknown) =>
  Number.isFinite(Number(v)) ? Number(v) : 0;

const s = (v: unknown, fallback = '') =>
  v == null ? fallback : String(v);

const o = (v: unknown) =>
  v == null || v === '' ? undefined : String(v);

const check = (error: any) => {
  if (error) throw error;
};

/**
 * Supabase can return a one-to-one relationship either as
 * an object or as an array depending on the relationship shape.
 * This helper safely reads inventory.current_stock in both cases.
 */
const getInventoryStock = (inventory: unknown): number => {
  if (Array.isArray(inventory)) {
    return n((inventory[0] as Row | undefined)?.current_stock);
  }

  if (inventory && typeof inventory === 'object') {
    return n((inventory as Row).current_stock);
  }

  return 0;
};

function mapBusiness(r: Row): Business {
  return {
    id: s(r.id),
    ownerName: s(r.owner_name),
    storeName: s(r.store_name),
    mobileNumber: s(r.mobile_number),
    address: o(r.address),
    gstin: o(r.gstin),
    businessType: s(r.business_type),
    currency: s(r.currency, 'INR'),
    defaultTaxRate: n(r.default_tax_rate),
    invoicePrefix: s(r.invoice_prefix, 'INV'),
    invoiceNextNumber: n(r.invoice_next_number) || 1,
    thankYouMessage: s(r.thank_you_message),
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at)
  };
}

function mapSupplier(r: Row): Supplier {
  return {
    id: s(r.id),
    businessId: s(r.business_id),
    name: s(r.name),
    mobile: o(r.mobile),
    email: o(r.email),
    address: o(r.address),
    gstin: o(r.gstin),
    openingBalance: n(r.opening_balance),
    balance: n(r.balance),
    notes: o(r.notes),
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at)
  };
}

function mapCustomer(r: Row): Customer {
  return {
    id: s(r.id),
    businessId: s(r.business_id),
    name: s(r.name),
    mobile: o(r.mobile),
    email: o(r.email),
    address: o(r.address),
    openingBalance: n(r.opening_balance),
    balance: n(r.balance),
    creditLimit:
      r.credit_limit == null ? undefined : n(r.credit_limit),
    notes: o(r.notes),
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at)
  };
}

function mapProduct(r: Row): Product {
  return {
    id: s(r.id),
    businessId: s(r.business_id),
    name: s(r.name),
    barcode: o(r.barcode),
    sku: o(r.sku),
    categoryId: o(r.category_id),
    brand: o(r.brand),
    purchasePrice: n(r.purchase_price),
    sellingPrice: n(r.selling_price),
    mrp: r.mrp == null ? undefined : n(r.mrp),
    taxRate: n(r.tax_rate),
    unit: s(r.unit, 'Piece'),
    currentStock: n(r.current_stock),
    minStockLevel: n(r.min_stock_level),
    supplierId: o(r.supplier_id),
    imageUri: o(r.image_uri),
    expiryDate: o(r.expiry_date),
    batchNumber: o(r.batch_number),
    notes: o(r.notes),
    isArchived:
      r.is_archived === true || r.is_archived === 1 ? 1 : 0,
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at)
  };
}

function mapSale(r: Row): Sale {
  return {
    id: s(r.id),
    businessId: s(r.business_id),
    invoiceNumber: s(r.invoice_number),
    customerId: o(r.customer_id),
    customerName: o(r.customer_name),
    subtotal: n(r.subtotal),
    discount: n(r.discount),
    taxAmount: n(r.tax_amount),
    total: n(r.total),
    paid: n(r.paid),
    due: n(r.due),
    paymentMethod: r.payment_method,
    status: r.status,
    notes: o(r.notes),
    createdAt: s(r.created_at)
  };
}

function mapPurchase(r: Row): Purchase {
  return {
    id: s(r.id),
    businessId: s(r.business_id),
    invoiceNumber: s(r.invoice_number),
    supplierId: s(r.supplier_id),
    supplierName: s(r.supplier_name),
    subtotal: n(r.subtotal),
    discount: n(r.discount),
    taxAmount: n(r.tax_amount),
    total: n(r.total),
    paid: n(r.paid),
    due: n(r.due),
    paymentMethod: r.payment_method,
    status: r.status,
    notes: o(r.notes),
    supplierInvoiceNumber: o(r.supplier_invoice_number),
    createdAt: s(r.created_at)
  };
}

function mapLedger(r: Row): CustomerLedger {
  return {
    id: s(r.id),
    businessId: s(r.business_id),
    customerId: s(r.customer_id),
    customerName: s(r.customer_name),
    date: s(r.date),
    type: r.type,
    description: s(r.description),
    referenceId: o(r.reference_id),
    debit: n(r.debit),
    credit: n(r.credit),
    balance: n(r.balance),
    createdAt: s(r.created_at)
  };
}

function mapSLedger(r: Row): SupplierLedger {
  return {
    id: s(r.id),
    businessId: s(r.business_id),
    supplierId: s(r.supplier_id),
    supplierName: s(r.supplier_name),
    date: s(r.date),
    type: r.type,
    description: s(r.description),
    referenceId: o(r.reference_id),
    debit: n(r.debit),
    credit: n(r.credit),
    balance: n(r.balance),
    createdAt: s(r.created_at)
  };
}

function mapPayment(r: Row): Payment {
  return {
    id: s(r.id),
    businessId: s(r.business_id),
    customerId: o(r.customer_id),
    supplierId: o(r.supplier_id),
    saleId: o(r.sale_id),
    purchaseId: o(r.purchase_id),
    amount: n(r.amount),
    method: r.method,
    notes: o(r.notes),
    createdAt: s(r.created_at)
  };
}

function mapExpense(r: Row): Expense {
  return {
    id: s(r.id),
    businessId: s(r.business_id),
    title: s(r.title),
    category: s(r.category),
    amount: n(r.amount),
    paymentMethod: r.payment_method,
    description: o(r.description),
    createdAt: s(r.created_at)
  };
}

function mapItem(r: Row): SaleItem {
  return {
    id: s(r.id),
    saleId: s(r.sale_id),
    productId: s(r.product_id),
    productName: s(r.product_name),
    quantity: n(r.quantity),
    price: n(r.price),
    discount: n(r.discount),
    taxRate: n(r.tax_rate),
    taxAmount: n(r.tax_amount),
    total: n(r.total)
  };
}

/**
 * Load products together with authoritative stock from inventory.
 *
 * IMPORTANT:
 * products.current_stock does NOT exist in the Supabase schema.
 * inventory.current_stock is the source of truth.
 */
async function stockProducts(
  businessId: string,
  includeArchived = false
): Promise<Product[]> {
  let q = supabase
    .from('products')
    .select('*, inventory(current_stock)')
    .eq('business_id', businessId)
    .order('name');

  if (!includeArchived) {
    q = q.eq('is_archived', false);
  }

  const { data, error } = await q;

  check(error);

  return list(data).map((r) =>
    mapProduct({
      ...r,
      current_stock: getInventoryStock(r.inventory)
    })
  );
}

async function setBalance(
  table: 'customers' | 'suppliers',
  id: string,
  value: number
) {
  const { error } = await supabase
    .from(table)
    .update({
      balance: value,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  check(error);
}

async function insertLedger(
  entry: CustomerLedger | SupplierLedger,
  table: 'customer_ledger' | 'supplier_ledger'
) {
  const idColumn =
    table === 'customer_ledger'
      ? 'customer_id'
      : 'supplier_id';

  const id =
    table === 'customer_ledger'
      ? (entry as CustomerLedger).customerId
      : (entry as SupplierLedger).supplierId;

  const { error } = await supabase
    .from(table)
    .insert({
      id: entry.id,
      business_id: entry.businessId,
      [idColumn]: id,
      date: entry.date,
      type: entry.type,
      description: entry.description,
      reference_id: entry.referenceId || null,
      debit: entry.debit,
      credit: entry.credit,
      balance: entry.balance,
      created_at: entry.createdAt
    });

  check(error);
}

export async function createUser(value: User): Promise<void> {
  const { data } = await supabase.auth.getUser();

  if (!data.user || data.user.id !== value.id) {
    throw new Error('Signed-in user does not match profile.');
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: value.id,
      name: value.name,
      email: value.email,
      created_at: value.createdAt,
      updated_at: value.updatedAt
    });

  check(error);
}

export async function getUserByEmail(
  email: string
): Promise<User | null> {
  const { data } = await supabase.auth.getUser();

  if (
    !data.user ||
    data.user.email?.toLowerCase() !== email.toLowerCase()
  ) {
    return null;
  }

  return getUserById(data.user.id);
}

export async function getUserById(
  id: string
): Promise<User | null> {
  const { data: auth } = await supabase.auth.getUser();

  if (auth.user?.id !== id) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  check(error);

  return data
    ? {
        id: s(data.id),
        name: s(data.name),
        email: s(data.email),
        createdAt: s(data.created_at),
        updatedAt: s(data.updated_at)
      }
    : null;
}

export async function createBusiness(
  v: Business
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    throw new Error(
      'You must be signed in to create a business.'
    );
  }

  const { error } = await supabase.rpc(
    'create_business',
    {
      payload: {
        id: v.id,
        ownerName: v.ownerName,
        storeName: v.storeName,
        mobileNumber: v.mobileNumber,
        address: v.address || null,
        gstin: v.gstin || null,
        businessType: v.businessType,
        currency: v.currency,
        defaultTaxRate: v.defaultTaxRate,
        invoicePrefix: v.invoicePrefix,
        invoiceNextNumber: v.invoiceNextNumber,
        thankYouMessage: v.thankYouMessage,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt
      }
    }
  );

  check(error);
}

export async function getBusinessById(
  id: string
) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  check(error);

  return data ? mapBusiness(data) : null;
}

export async function getBusinessesForUser(
  userId: string
): Promise<Business[]> {
  const { data, error } = await supabase
    .from('business_members')
    .select('businesses(*)')
    .eq('user_id', userId);

  check(error);

  return list(data).flatMap((r) =>
    r.businesses && !Array.isArray(r.businesses)
      ? [mapBusiness(r.businesses)]
      : list(r.businesses).map(mapBusiness)
  );
}

export async function updateBusiness(
  v: Business
): Promise<void> {
  const { error } = await supabase
    .from('businesses')
    .update({
      owner_name: v.ownerName,
      store_name: v.storeName,
      mobile_number: v.mobileNumber,
      address: v.address || null,
      gstin: v.gstin || null,
      business_type: v.businessType,
      currency: v.currency,
      default_tax_rate: v.defaultTaxRate,
      invoice_prefix: v.invoicePrefix,
      invoice_next_number: v.invoiceNextNumber,
      thank_you_message: v.thankYouMessage,
      updated_at: v.updatedAt
    })
    .eq('id', v.id);

  check(error);
}

export async function incrementInvoiceNumber(
  businessId: string
): Promise<void> {
  const { error } = await supabase.rpc(
    'increment_invoice_number',
    {
      target_business_id: businessId
    }
  );

  check(error);
}

export async function createUserBusiness(
  v: {
    id: string;
    userId: string;
    businessId: string;
    role: string;
    createdAt: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('business_members')
    .insert({
      id: v.id,
      user_id: v.userId,
      business_id: v.businessId,
      role: v.role,
      created_at: v.createdAt
    });

  check(error);
}

export async function createCategory(
  v: Category
): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .insert({
      id: v.id,
      business_id: v.businessId,
      name: v.name,
      created_at: v.createdAt
    });

  check(error);
}

export async function getCategories(
  businessId: string
): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('business_id', businessId)
    .order('name');

  check(error);

  return list(data).map((r) => ({
    id: s(r.id),
    businessId: s(r.business_id),
    name: s(r.name),
    createdAt: s(r.created_at)
  }));
}

export async function deleteCategory(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  check(error);
}

export async function createSupplier(
  v: Supplier
): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .insert({
      id: v.id,
      business_id: v.businessId,
      name: v.name,
      mobile: v.mobile || null,
      email: v.email || null,
      address: v.address || null,
      gstin: v.gstin || null,
      opening_balance: v.openingBalance,
      balance: v.balance,
      notes: v.notes || null,
      created_at: v.createdAt,
      updated_at: v.updatedAt
    });

  check(error);

  if (v.openingBalance) {
    await createSupplierLedger({
      id: generateId(),
      businessId: v.businessId,
      supplierId: v.id,
      supplierName: v.name,
      date: v.createdAt,
      type: 'opening_balance',
      description: 'Opening Balance',
      debit: Math.max(v.openingBalance, 0),
      credit: Math.max(-v.openingBalance, 0),
      balance: v.openingBalance,
      createdAt: v.createdAt
    });
  }
}

export async function updateSupplier(
  v: Supplier
): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .update({
      name: v.name,
      mobile: v.mobile || null,
      email: v.email || null,
      address: v.address || null,
      gstin: v.gstin || null,
      balance: v.balance,
      notes: v.notes || null,
      updated_at: v.updatedAt
    })
    .eq('id', v.id);

  check(error);
}

export async function getSuppliers(
  businessId: string
): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('business_id', businessId)
    .order('name');

  check(error);

  return list(data).map(mapSupplier);
}

export async function getSupplierById(
  id: string
): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  check(error);

  return data ? mapSupplier(data) : null;
}

export async function deleteSupplier(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id);

  check(error);
}

export async function updateSupplierBalance(
  id: string,
  value: number
): Promise<void> {
  await setBalance('suppliers', id, value);
}

/* =========================
   PRODUCTS / INVENTORY
   ========================= */

export async function createProduct(
  v: Product
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .insert({
      id: v.id,
      business_id: v.businessId,
      name: v.name,
      barcode: v.barcode || null,
      sku: v.sku || null,
      category_id: v.categoryId || null,
      brand: v.brand || null,
      purchase_price: v.purchasePrice,
      selling_price: v.sellingPrice,
      mrp: v.mrp ?? null,
      tax_rate: v.taxRate,
      unit: v.unit,
      min_stock_level: v.minStockLevel,
      supplier_id: v.supplierId || null,
      image_uri: v.imageUri || null,
      expiry_date: v.expiryDate || null,
      batch_number: v.batchNumber || null,
      notes: v.notes || null,
      is_archived: v.isArchived === 1,
      created_at: v.createdAt,
      updated_at: v.updatedAt
    });

  check(error);

  const result = await supabase
    .from('inventory')
    .insert({
      product_id: v.id,
      business_id: v.businessId,
      current_stock: v.currentStock
    });

  check(result.error);
}

export async function updateProduct(
  v: Product
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({
      name: v.name,
      barcode: v.barcode || null,
      sku: v.sku || null,
      category_id: v.categoryId || null,
      brand: v.brand || null,
      purchase_price: v.purchasePrice,
      selling_price: v.sellingPrice,
      mrp: v.mrp ?? null,
      tax_rate: v.taxRate,
      unit: v.unit,
      min_stock_level: v.minStockLevel,
      supplier_id: v.supplierId || null,
      image_uri: v.imageUri || null,
      expiry_date: v.expiryDate || null,
      batch_number: v.batchNumber || null,
      notes: v.notes || null,
      is_archived: v.isArchived === 1,
      updated_at: v.updatedAt
    })
    .eq('id', v.id)
    .eq('business_id', v.businessId);

  check(error);

  await updateProductStock(
    v.id,
    v.businessId,
    v.currentStock
  );
}

export async function getProducts(
  businessId: string,
  includeArchived = false
): Promise<Product[]> {
  return stockProducts(businessId, includeArchived);
}

export async function searchProducts(
  businessId: string,
  query: string
): Promise<Product[]> {
  const term = query.toLowerCase();

  return (await stockProducts(businessId))
    .filter((p) =>
      [p.name, p.barcode, p.sku].some((v) =>
        v?.toLowerCase().includes(term)
      )
    )
    .slice(0, 50);
}

export async function getProductById(
  id: string
): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, inventory(current_stock)')
    .eq('id', id)
    .maybeSingle();

  check(error);

  if (!data) {
    return null;
  }

  return mapProduct({
    ...data,
    current_stock: getInventoryStock(data.inventory)
  });
}

/**
 * Barcode functionality preserved.
 */
export async function getProductByBarcode(
  businessId: string,
  barcode: string
): Promise<Product | null> {
  return (
    (await stockProducts(businessId)).find(
      (p) => p.barcode === barcode
    ) || null
  );
}

export async function getLowStockProducts(
  businessId: string
): Promise<Product[]> {
  return (await stockProducts(businessId)).filter(
    (p) =>
      p.currentStock <= p.minStockLevel &&
      p.currentStock > 0
  );
}

export async function getOutOfStockProducts(
  businessId: string
): Promise<Product[]> {
  return (await stockProducts(businessId)).filter(
    (p) => p.currentStock <= 0
  );
}

export async function updateProductStock(
  id: string,
  businessId: string,
  value: number
): Promise<void> {
  const { error } = await supabase
    .from('inventory')
    .upsert(
      {
        product_id: id,
        business_id: businessId,
        current_stock: value,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: 'product_id'
      }
    );

  check(error);
}

export async function createStockMovement(
  v: StockMovement
): Promise<void> {
  const { error } = await supabase
    .from('stock_movements')
    .insert({
      id: v.id,
      business_id: v.businessId,
      product_id: v.productId,
      previous_qty: v.previousQty,
      change_qty: v.changeQty,
      new_qty: v.newQty,
      type: v.type,
      reason: v.reason || null,
      reference_id: v.referenceId || null,
      created_at: v.createdAt
    });

  check(error);
}

export async function getStockMovements(
  productId: string
): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, products(name)')
    .eq('product_id', productId)
    .order('created_at', {
      ascending: false
    });

    if (error) {
    console.error('Error fetching stock movements:', error);
    throw error;
  }

  return (data ?? []) as StockMovement[];
}
