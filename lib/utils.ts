import { format } from 'date-fns';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function formatCurrency(amount: number, currency = '₹'): string {
  return `${currency}${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd MMM yyyy');
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd MMM yyyy, hh:mm a');
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'hh:mm a');
}

export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function getStartOfDay(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function getEndOfDay(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function getStartOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function getStartOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function getStartOfYear(): string {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function getYesterdayStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function getYesterdayEnd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function validateMobile(mobile: string): boolean {
  return /^[6-9]\d{9}$/.test(mobile);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateGstin(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
}

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function calculateTax(amount: number, taxRate: number): number {
  return Math.round((amount * taxRate) / 100 * 100) / 100;
}

export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function generateInvoiceNumber(prefix: string, nextNumber: number): string {
  return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export const STOCK_MOVEMENT_TYPES = [
  { value: 'opening_stock', label: 'Opening Stock' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'sale', label: 'Sale' },
  { value: 'sales_return', label: 'Sales Return' },
  { value: 'purchase_return', label: 'Purchase Return' },
  { value: 'damage', label: 'Damage' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'correction', label: 'Correction' },
];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: 'cash-outline' },
  { value: 'upi', label: 'UPI', icon: 'phone-portrait-outline' },
  { value: 'credit', label: 'Credit/Udhaar', icon: 'time-outline' },
  { value: 'card', label: 'Card', icon: 'card-outline' },
];

export const EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity',
  'Staff Salary',
  'Transport',
  'Maintenance',
  'Marketing',
  'Packaging',
  'Other',
];

export const UNITS = [
  'Piece', 'Kg', 'Gram', 'Litre', 'Ml', 'Dozen', 'Box', 'Pack', 'Bundle', 'Meter', 'Pair',
];

export const BUSINESS_TYPES = [
  'General Store', 'Kirana Store', 'Grocery Store', 'Medical Store', 'Mobile Shop',
  'Electronics', 'Clothing', 'Hardware', 'Stationery', 'Other',
];

export const CUSTOMER_LEDGER_TYPES = [
  { value: 'opening_balance', label: 'Opening Balance' },
  { value: 'credit_sale', label: 'Credit Sale' },
  { value: 'payment_received', label: 'Payment Received' },
  { value: 'debit_adjustment', label: 'Debit Adjustment' },
  { value: 'credit_adjustment', label: 'Credit Adjustment' },
  { value: 'sales_return', label: 'Sales Return' },
];

export const SUPPLIER_LEDGER_TYPES = [
  { value: 'opening_balance', label: 'Opening Balance' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'payment', label: 'Payment' },
  { value: 'purchase_return', label: 'Purchase Return' },
  { value: 'debit_adjustment', label: 'Debit Adjustment' },
  { value: 'credit_adjustment', label: 'Credit Adjustment' },
];

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  customer_payment: 'Customer Payment',
  supplier_payment: 'Supplier Payment',
  expense: 'Expense',
  sales_return: 'Sales Return',
  purchase_return: 'Purchase Return',
  stock_adjustment: 'Stock Adjustment',
  other_income: 'Other Income',
  other_expense: 'Other Expense',
};

export const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  sale: '#1B6B4B',
  purchase: '#2563EB',
  customer_payment: '#16A34A',
  supplier_payment: '#EAB308',
  expense: '#DC2626',
  sales_return: '#7C3AED',
  purchase_return: '#0891B2',
  stock_adjustment: '#64748B',
  other_income: '#1B6B4B',
  other_expense: '#DC2626',
};
