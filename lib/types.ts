export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface Business {
  id: string;
  ownerName: string;
  storeName: string;
  mobileNumber: string;
  address: string;
  gstin?: string;
  businessType: string;
  currency: string;
  defaultTaxRate: number;
  invoicePrefix: string;
  invoiceNextNumber: number;
  thankYouMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserBusiness {
  id: string;
  userId: string;
  businessId: string;
  role: string;
  createdAt: string;
}

export interface Category {
  id: string;
  businessId: string;
  name: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  mobile?: string;
  email?: string;
  address?: string;
  gstin?: string;
  openingBalance: number;
  balance: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  barcode?: string;
  sku?: string;
  categoryId?: string;
  categoryName?: string;
  brand?: string;
  purchasePrice: number;
  sellingPrice: number;
  mrp?: number;
  taxRate: number;
  unit: string;
  currentStock: number;
  minStockLevel: number;
  supplierId?: string;
  supplierName?: string;
  imageUri?: string;
  expiryDate?: string;
  batchNumber?: string;
  notes?: string;
  isArchived: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  businessId: string;
  productId: string;
  productName: string;
  previousQty: number;
  changeQty: number;
  newQty: number;
  type: StockMovementType;
  reason?: string;
  referenceId?: string;
  createdAt: string;
}

export type StockMovementType =
  | 'opening_stock'
  | 'purchase'
  | 'sale'
  | 'sales_return'
  | 'purchase_return'
  | 'damage'
  | 'adjustment'
  | 'correction';

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  mobile?: string;
  email?: string;
  address?: string;
  openingBalance: number;
  balance: number;
  creditLimit?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  id: string;
  businessId: string;
  invoiceNumber: string;
  customerId?: string;
  customerName?: string;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  paid: number;
  due: number;
  paymentMethod: 'cash' | 'upi' | 'credit' | 'card' | 'mixed';
  status: 'completed' | 'pending' | 'cancelled' | 'returned';
  notes?: string;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface Purchase {
  id: string;
  businessId: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  paid: number;
  due: number;
  paymentMethod: 'cash' | 'upi' | 'card' | 'credit';
  status: 'completed' | 'pending' | 'cancelled' | 'returned';
  notes?: string;
  supplierInvoiceNumber?: string;
  createdAt: string;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface Payment {
  id: string;
  businessId: string;
  customerId?: string;
  supplierId?: string;
  saleId?: string;
  purchaseId?: string;
  amount: number;
  method: 'cash' | 'upi' | 'card';
  notes?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  businessId: string;
  title: string;
  category: string;
  amount: number;
  paymentMethod: 'cash' | 'upi' | 'card';
  description?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  businessId: string;
  saleId: string;
  invoiceNumber: string;
  htmlContent: string;
  createdAt: string;
}

export interface CustomerLedger {
  id: string;
  businessId: string;
  customerId: string;
  customerName: string;
  date: string;
  type: 'opening_balance' | 'credit_sale' | 'payment_received' | 'debit_adjustment' | 'credit_adjustment' | 'sales_return';
  description: string;
  referenceId?: string;
  debit: number;
  credit: number;
  balance: number;
  createdAt: string;
}

export interface SupplierLedger {
  id: string;
  businessId: string;
  supplierId: string;
  supplierName: string;
  date: string;
  type: 'opening_balance' | 'purchase' | 'payment' | 'purchase_return' | 'debit_adjustment' | 'credit_adjustment';
  description: string;
  referenceId?: string;
  debit: number;
  credit: number;
  balance: number;
  createdAt: string;
}

export interface BusinessSettings {
  id: string;
  businessId: string;
  allowNegativeStock: boolean;
  lowStockAlertEnabled: boolean;
  paymentReminderEnabled: boolean;
  autoBackupEnabled: boolean;
  backupInterval: number;
  lastBackupAt?: string;
  pinCode?: string;
  updatedAt: string;
}

export interface BackupRecord {
  id: string;
  businessId: string;
  type: 'manual' | 'automatic';
  dataSize: number;
  createdAt: string;
  status: 'success' | 'failed';
  errorMessage?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  price: number;
  discount: number;
  total: number;
}

export interface PurchaseCartItem {
  product: Product;
  quantity: number;
  price: number;
  discount: number;
  total: number;
}

export interface DashboardStats {
  todaySales: number;
  todayBills: number;
  todayExpenses: number;
  todayCash: number;
  totalReceivables: number;
  lowStockCount: number;
  outOfStockCount: number;
  currentBalance: number;
  todayPurchases: number;
  estimatedProfit: number;
}

export interface RecentTransaction {
  id: string;
  type: 'sale' | 'purchase' | 'payment' | 'expense' | 'purchase_payment' | 'return';
  description: string;
  amount: number;
  date: string;
}

export interface UnifiedTransaction {
  id: string;
  type: 'sale' | 'purchase' | 'customer_payment' | 'supplier_payment' | 'expense' | 'sales_return' | 'purchase_return' | 'stock_adjustment' | 'other_income' | 'other_expense';
  description: string;
  amount: number;
  date: string;
  referenceId?: string;
  entityName?: string;
  debit: number;
  credit: number;
}

export interface SalesReport {
  totalSales: number;
  totalBills: number;
  totalItems: number;
  cashSales: number;
  upiSales: number;
  creditSales: number;
  cardSales: number;
  averageBill: number;
  discountTotal: number;
  taxTotal: number;
  period: string;
}

export interface ProductReport {
  productId: string;
  productName: string;
  totalSold: number;
  totalRevenue: number;
  totalProfit: number;
  currentStock: number;
  status: 'best_seller' | 'slow_moving' | 'normal';
}

export interface CustomerReport {
  customerId: string;
  customerName: string;
  totalPurchases: number;
  totalPaid: number;
  outstanding: number;
  purchaseCount: number;
}

export interface ExpenseReport {
  totalExpenses: number;
  categoryBreakdown: { category: string; amount: number; percentage: number }[];
  period: string;
}
