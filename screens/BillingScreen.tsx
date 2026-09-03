import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBusiness } from '../context/BusinessContext';
import {
  getProducts, searchProducts, getCustomers, searchCustomers,
  createSale, incrementInvoiceNumber, getProductById, createPayment,
} from '../lib/database';
import { Product, Customer, CartItem, Sale, SaleItem, Business, StockMovement } from '../lib/types';
import {
  generateId, formatCurrency, generateInvoiceNumber, roundTo2, calculateTax, getStartOfDay, getEndOfDay,
} from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import SearchBar from '../components/SearchBar';
import ProductCard from '../components/ProductCard';
import QuantitySelector from '../components/QuantitySelector';
import CustomerCard from '../components/CustomerCard';
import InvoicePreview from '../components/InvoicePreview';
import PrimaryButton from '../components/PrimaryButton';

const { width } = Dimensions.get('window');

interface BillingScreenProps {
  navigation: any;
  route: any;
}

export default function BillingScreen({ navigation, route }: BillingScreenProps) {
  const { business } = useBusiness();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [preLoadedCustomer, setPreLoadedCustomer] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'credit' | 'card'>('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [saleData, setSaleData] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cartItemEdit, setCartItemEdit] = useState<CartItem | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [showEditCartItem, setShowEditCartItem] = useState(false);
  const [billDiscount, setBillDiscount] = useState('');
  const [showBillDiscount, setShowBillDiscount] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = parseFloat(billDiscount) || 0;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = 0;
  const total = Math.max(0, taxableAmount + taxAmount);
  const paid = parseFloat(paidAmount) || total;
  const due = Math.max(0, total - paid);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.scannedProduct) {
        addToCart(route.params.scannedProduct);
        navigation.setParams({ scannedProduct: undefined });
      }
      if (route.params?.customerId && !preLoadedCustomer) {
        const loadCustomer = async () => {
          const { getCustomerById } = await import('../lib/database');
          const customer = await getCustomerById(route.params.customerId);
          if (customer) { setSelectedCustomer(customer); setPreLoadedCustomer(true); }
        };
        loadCustomer();
      }
    }, [route.params])
  );

  function addToCart(product: Product) {
    if (product.currentStock <= 0) {
      Alert.alert('Out of Stock', `${product.name} is currently out of stock.`);
      return;
    }
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity + 1 > product.currentStock) {
        Alert.alert('Stock Limit', `Only ${product.currentStock} units available.`);
        return;
      }
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        product,
        quantity: 1,
        price: product.sellingPrice,
        discount: 0,
        total: product.sellingPrice,
      }]);
    }
    setShowSearch(false);
  }

  function updateCartItemQuantity(productId: string, quantity: number) {
    const item = cart.find(c => c.product.id === productId);
    if (!item) return;
    if (quantity <= 0) {
      setCart(cart.filter(c => c.product.id !== productId));
      return;
    }
    if (quantity > item.product.currentStock) {
      Alert.alert('Stock Limit', `Only ${item.product.currentStock} units available.`);
      return;
    }
    setCart(cart.map(c =>
      c.product.id === productId
        ? { ...c, quantity, total: quantity * c.price - c.discount }
        : c
    ));
  }

  function openEditCartItem(item: CartItem) {
    setCartItemEdit(item);
    setEditPrice(String(item.price));
    setEditDiscount(String(item.discount));
    setShowEditCartItem(true);
  }

  function saveCartItemEdit() {
    if (!cartItemEdit) return;
    const price = parseFloat(editPrice) || cartItemEdit.price;
    const discount = parseFloat(editDiscount) || 0;
    setCart(cart.map(c =>
      c.product.id === cartItemEdit.product.id
        ? { ...c, price, discount, total: c.quantity * price - discount }
        : c
    ));
    setShowEditCartItem(false);
    setCartItemEdit(null);
  }

  async function handleSearch(text: string) {
    setSearchQuery(text);
    if (!business || !text.trim()) {
      setSearchResults([]);
      return;
    }
    const results = await searchProducts(business.id, text.trim());
    setSearchResults(results);
  }

  async function handleCustomerSearch(text: string) {
    setCustomerSearch(text);
    if (!business || !text.trim()) {
      const all = await getCustomers(business.id);
      setCustomers(all);
      return;
    }
    const results = await searchCustomers(business.id, text.trim());
    setCustomers(results);
  }

  async function openCustomerModal() {
    if (!business) return;
    const all = await getCustomers(business.id);
    setCustomers(all);
    setShowCustomerModal(true);
  }

  function generateInvoiceHtml(business: Business, sale: Sale, items: SaleItem[]): string {
    const itemRows = items.map(item => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${item.productName}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">${item.quantity}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatCurrency(item.price)}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatCurrency(item.total)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .store-name { font-size: 24px; font-weight: bold; color: #1B6B4B; }
        .address { font-size: 14px; color: #666; margin-top: 4px; }
        .contact { font-size: 14px; color: #666; }
        .gstin { font-size: 14px; color: #666; }
        .invoice-info { margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; font-size: 14px; margin: 4px 0; }
        .label { color: #666; }
        .value { font-weight: bold; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
        th { background: #1B6B4B; color: white; padding: 8px; text-align: left; border: 1px solid #ddd; }
        .totals { margin-top: 20px; border-top: 2px solid #ddd; padding-top: 10px; }
        .total-row { display: flex; justify-content: space-between; font-size: 16px; margin: 4px 0; }
        .grand-total { font-size: 20px; font-weight: bold; color: #1B6B4B; margin-top: 8px; border-top: 1px solid #ddd; padding-top: 8px; }
        .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; font-style: italic; }
      </style></head><body>
        <div class="header">
          <div class="store-name">${business.storeName}</div>
          <div class="address">${business.address || ''}</div>
          <div class="contact">Mob: ${business.mobileNumber}</div>
          ${business.gstin ? `<div class="gstin">GSTIN: ${business.gstin}</div>` : ''}
        </div>
        <div class="invoice-info">
          <div class="info-row"><span class="label">Invoice No:</span><span class="value">${sale.invoiceNumber}</span></div>
          <div class="info-row"><span class="label">Date:</span><span class="value">${new Date(sale.createdAt).toLocaleString('en-IN')}</span></div>
          ${sale.customerName ? `<div class="info-row"><span class="label">Customer:</span><span class="value">${sale.customerName}</span></div>` : ''}
        </div>
        <table>
          <tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
          ${itemRows}
        </table>
        <div class="totals">
          <div class="total-row"><span>Subtotal:</span><span>${formatCurrency(sale.subtotal)}</span></div>
          ${sale.discount > 0 ? `<div class="total-row"><span>Discount:</span><span>-${formatCurrency(sale.discount)}</span></div>` : ''}
          ${sale.taxAmount > 0 ? `<div class="total-row"><span>Tax:</span><span>${formatCurrency(sale.taxAmount)}</span></div>` : ''}
          <div class="total-row grand-total"><span>Grand Total:</span><span>${formatCurrency(sale.total)}</span></div>
          <div class="total-row"><span>Paid (${sale.paymentMethod.toUpperCase()}):</span><span>${formatCurrency(sale.paid)}</span></div>
          ${sale.due > 0 ? `<div class="total-row"><span>Due:</span><span style="color:#DC2626">${formatCurrency(sale.due)}</span></div>` : ''}
        </div>
        <div class="footer">${business.thankYouMessage}</div>
      </body></html>
    `;
  }

  async function handleCompleteSale() {
    if (!business || cart.length === 0) return;
    if (due < 0) {
      Alert.alert('Invalid', 'Paid amount cannot exceed total amount');
      return;
    }
    if (paymentMethod === 'credit' && !selectedCustomer) {
      Alert.alert('Customer Required', 'Please select a customer for credit sale');
      return;
    }
    if (paymentMethod === 'credit' && selectedCustomer && due <= 0) {
      Alert.alert('Invalid', 'Credit sale must have a due amount');
      return;
    }

    setProcessing(true);
    try {
      const invoiceNumber = generateInvoiceNumber(business.invoicePrefix, business.invoiceNextNumber);
      const saleId = generateId();
      const now = new Date().toISOString();

      const saleItems: SaleItem[] = cart.map(item => {
        const itemTax = calculateTax(item.price * item.quantity - item.discount, item.product.taxRate);
        return {
          id: generateId(),
          saleId,
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount,
          taxRate: item.product.taxRate,
          taxAmount: itemTax,
          total: item.price * item.quantity - item.discount + itemTax,
        };
      });

      const totalTax = saleItems.reduce((s, i) => s + i.taxAmount, 0);
      const totalAmount = taxableAmount + totalTax;
      const finalPaid = paymentMethod === 'credit' ? paid : totalAmount;
      const finalDue = paymentMethod === 'credit' ? due : 0;

      const sale: Sale = {
        id: saleId,
        businessId: business.id,
        invoiceNumber,
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name,
        subtotal,
        discount: discountAmount,
        taxAmount: totalTax,
        total: totalAmount,
        paid: finalPaid,
        due: finalDue,
        paymentMethod,
        status: 'completed',
        notes: '',
        createdAt: now,
      };

      const stockMovements: StockMovement[] = cart.map(item => ({
        id: generateId(),
        businessId: business.id,
        productId: item.product.id,
        productName: item.product.name,
        previousQty: item.product.currentStock,
        changeQty: -item.quantity,
        newQty: roundTo2(item.product.currentStock - item.quantity),
        type: 'sale',
        reason: `Sale ${invoiceNumber}`,
        referenceId: saleId,
        createdAt: now,
      }));

      const invoiceHtml = generateInvoiceHtml(business, sale, saleItems);

      await createSale(sale, saleItems, stockMovements, invoiceHtml);
      await incrementInvoiceNumber(business.id);

      // Record payment if not credit
      if (paymentMethod !== 'credit' && finalPaid > 0) {
        await createPayment({
          id: generateId(),
          businessId: business.id,
          customerId: selectedCustomer?.id,
          saleId,
          amount: finalPaid,
          method: paymentMethod as any,
          notes: `Payment for ${invoiceNumber}`,
          createdAt: now,
        });
      }

      // Record partial payment if paid > 0 on credit sale
      if (paymentMethod === 'credit' && finalPaid > 0) {
        await createPayment({
          id: generateId(),
          businessId: business.id,
          customerId: selectedCustomer?.id,
          saleId,
          amount: finalPaid,
          method: 'cash',
          notes: `Partial payment for ${invoiceNumber}`,
          createdAt: now,
        });
      }

      setSaleData({ sale, items: saleItems });
      setCart([]);
      setSelectedCustomer(null);
      setPaidAmount('');
      setBillDiscount('');
      setPaymentMethod('cash');
      setShowPaymentModal(false);
      setShowInvoicePreview(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to complete sale. Please check stock and try again.');
      console.error('Sale error', e);
    } finally {
      setProcessing(false);
    }
  }

  function handlePrintShare() {
    if (!saleData) return;
    navigation.navigate('InvoiceShare', { sale: saleData.sale, items: saleData.items });
  }

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <TouchableOpacity style={styles.cartItem} onPress={() => openEditCartItem(item)}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName} numberOfLines={1}>{item.product.name}</Text>
        <Text style={styles.cartItemPrice}>{formatCurrency(item.price)} each</Text>
      </View>
      <QuantitySelector
        quantity={item.quantity}
        onIncrement={() => updateCartItemQuantity(item.product.id, item.quantity + 1)}
        onDecrement={() => updateCartItemQuantity(item.product.id, item.quantity - 1)}
        unit={item.product.unit}
        size="sm"
      />
      <Text style={styles.cartItemTotal}>{formatCurrency(item.total)}</Text>
    </TouchableOpacity>
  );

  if (!business) return (
    <View style={COMMON_STYLES.center}><Text>No business selected</Text></View>
  );

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader
        title="New Bill"
        subtitle={selectedCustomer ? `Customer: ${selectedCustomer.name}` : undefined}
        rightAction={{ icon: 'search-outline', onPress: () => setShowSearch(true) }}
      />

      {cart.length === 0 ? (
        <View style={styles.emptyCart}>
          <Ionicons name="cart-outline" size={80} color={COLORS.textTertiary} />
          <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
          <Text style={styles.emptyCartText}>Search or scan products to add to the bill</Text>
          <View style={styles.emptyCartActions}>
            <TouchableOpacity style={styles.emptyCartBtn} onPress={() => setShowSearch(true)}>
              <Ionicons name="search-outline" size={20} color={COLORS.primary} />
              <Text style={styles.emptyCartBtnText}>Search Products</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emptyCartBtn} onPress={() => navigation.navigate('BarcodeScanner', { fromScreen: 'Billing' })}>
              <Ionicons name="scan-outline" size={20} color={COLORS.primary} />
              <Text style={styles.emptyCartBtnText}>Scan Barcode</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <FlatList
            data={cart}
            keyExtractor={(item) => item.product.id}
            renderItem={renderCartItem}
            contentContainerStyle={styles.cartList}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.cartHeader}>
                <Text style={styles.cartHeaderText}>Cart ({cart.length} items)</Text>
                <TouchableOpacity onPress={() => setCart([])}>
                  <Text style={styles.clearCartText}>Clear</Text>
                </TouchableOpacity>
              </View>
            }
          />

          <View style={styles.totalsContainer}>
            <TouchableOpacity style={styles.discountRow} onPress={() => setShowBillDiscount(!showBillDiscount)}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatCurrency(subtotal, business.currency)}</Text>
            </TouchableOpacity>
            {discountAmount > 0 && (
              <View style={styles.discountRow}>
                <Text style={styles.totalLabel}>Discount</Text>
                <Text style={[styles.totalValue, { color: COLORS.success }]}>-{formatCurrency(discountAmount, business.currency)}</Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(total, business.currency)}</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.customerBtn} onPress={openCustomerModal}>
                <Ionicons name={selectedCustomer ? 'person' : 'person-add-outline'} size={18} color={COLORS.primary} />
                <Text style={styles.customerBtnText} numberOfLines={1}>
                  {selectedCustomer ? selectedCustomer.name : 'Add Customer'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.checkoutBtn} onPress={() => setShowPaymentModal(true)}>
                <Text style={styles.checkoutBtnText}>Checkout</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Product Search Modal */}
      <Modal visible={showSearch} animationType="slide" onRequestClose={() => setShowSearch(false)}>
        <View style={COMMON_STYLES.screen}>
          <AppHeader title="Search Products" onBack={() => setShowSearch(false)} />
          <View style={styles.searchContainer}>
            <SearchBar value={searchQuery} onChangeText={handleSearch} placeholder="Search products..." onClear={() => { setSearchQuery(''); setSearchResults([]); }} autoFocus />
          </View>
          <TouchableOpacity style={styles.scanBtn} onPress={() => { setShowSearch(false); navigation.navigate('BarcodeScanner', { fromScreen: 'Billing' }); }}>
            <Ionicons name="scan-outline" size={20} color={COLORS.primary} />
            <Text style={styles.scanBtnText}>Scan Barcode</Text>
          </TouchableOpacity>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ProductCard product={item} onPress={() => addToCart(item)} />
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              searchQuery.length > 0 ? (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>No products found</Text>
                </View>
              ) : null
            }
          />
        </View>
      </Modal>

      {/* Customer Selection Modal */}
      <Modal visible={showCustomerModal} animationType="slide" onRequestClose={() => setShowCustomerModal(false)}>
        <View style={COMMON_STYLES.screen}>
          <AppHeader title="Select Customer" onBack={() => setShowCustomerModal(false)} />
          <View style={styles.searchContainer}>
            <SearchBar value={customerSearch} onChangeText={handleCustomerSearch} placeholder="Search customers..." onClear={() => { setCustomerSearch(''); handleCustomerSearch(''); }} autoFocus />
          </View>
          <FlatList
            data={customers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CustomerCard
                customer={item}
                onSelect={() => { setSelectedCustomer(item); setShowCustomerModal(false); }}
              />
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No customers found</Text>
                <TouchableOpacity onPress={() => { setShowCustomerModal(false); navigation.navigate('Customers', { addNew: true }); }}>
                  <Text style={styles.addCustomerLink}>Add Customer</Text>
                </TouchableOpacity>
              </View>
            }
          />
          <TouchableOpacity style={styles.noCustomerBtn} onPress={() => { setSelectedCustomer(null); setShowCustomerModal(false); }}>
            <Text style={styles.noCustomerText}>Continue without customer</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Edit Cart Item Modal */}
      <Modal visible={showEditCartItem} transparent animationType="fade" onRequestClose={() => setShowEditCartItem(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.editModalTitle}>{cartItemEdit?.product.name}</Text>
            <Text style={styles.formLabel}>Price per unit</Text>
            <TextInput style={styles.formInput} value={editPrice} onChangeText={setEditPrice} keyboardType="decimal-pad" />
            <Text style={styles.formLabel}>Discount per item</Text>
            <TextInput style={styles.formInput} value={editDiscount} onChangeText={setEditDiscount} keyboardType="decimal-pad" />
            <Text style={styles.editTotal}>Item Total: {formatCurrency((parseFloat(editPrice) || cartItemEdit?.price || 0) * (cartItemEdit?.quantity || 1) - (parseFloat(editDiscount) || 0))}</Text>
            <View style={styles.editModalButtons}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setShowEditCartItem(false)}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editSaveBtn} onPress={saveCartItemEdit}>
                <Text style={styles.editSaveText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} transparent animationType="slide" onRequestClose={() => setShowPaymentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModal}>
            <Text style={styles.paymentTitle}>Payment</Text>
            <Text style={styles.paymentTotal}>{formatCurrency(total, business.currency)}</Text>

            <View style={styles.paymentMethods}>
              {(['cash', 'upi', 'credit', 'card'] as const).map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[styles.paymentMethod, paymentMethod === method && styles.paymentMethodActive]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Ionicons
                    name={method === 'cash' ? 'cash-outline' : method === 'upi' ? 'phone-portrait-outline' : method === 'credit' ? 'time-outline' : 'card-outline'}
                    size={24}
                    color={paymentMethod === method ? COLORS.primary : COLORS.textSecondary}
                  />
                  <Text style={[styles.paymentMethodText, paymentMethod === method && styles.paymentMethodTextActive]}>
                    {method === 'upi' ? 'UPI' : method === 'credit' ? 'Credit' : method.charAt(0).toUpperCase() + method.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {paymentMethod === 'credit' && (
              <Text style={styles.creditWarning}>Customer must be selected for credit sale</Text>
            )}

            <Text style={styles.formLabel}>Amount Paid</Text>
            <TextInput
              style={styles.formInput}
              value={paidAmount}
              onChangeText={setPaidAmount}
              keyboardType="decimal-pad"
              placeholder={String(total)}
              placeholderTextColor={COLORS.textTertiary}
            />

            <Text style={styles.formLabel}>Bill Discount</Text>
            <TextInput
              style={styles.formInput}
              value={billDiscount}
              onChangeText={setBillDiscount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={COLORS.textTertiary}
            />

            {due > 0 && (
              <View style={styles.dueRow}>
                <Text style={styles.dueLabel}>Due Amount</Text>
                <Text style={styles.dueValue}>{formatCurrency(due, business.currency)}</Text>
              </View>
            )}

            {paymentMethod === 'cash' && due < 0 && (
              <View style={styles.changeRow}>
                <Text style={styles.changeLabel}>Change to Return</Text>
                <Text style={styles.changeValue}>{formatCurrency(Math.abs(due), business.currency)}</Text>
              </View>
            )}

            <View style={styles.paymentButtons}>
              <TouchableOpacity style={styles.cancelPaymentBtn} onPress={() => setShowPaymentModal(false)}>
                <Text style={styles.cancelPaymentText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmPaymentBtn} onPress={handleCompleteSale} disabled={processing}>
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmPaymentText}>Complete Sale</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Invoice Preview Modal */}
      <Modal visible={showInvoicePreview} animationType="slide" onRequestClose={() => setShowInvoicePreview(false)}>
        <View style={COMMON_STYLES.screen}>
          <AppHeader
            title="Invoice"
            subtitle={saleData?.sale.invoiceNumber}
            onBack={() => setShowInvoicePreview(false)}
          />
          {saleData && (
            <InvoicePreview business={business} sale={saleData.sale} items={saleData.items} />
          )}
          <View style={styles.invoiceActions}>
            <PrimaryButton title="Share / Print" onPress={handlePrintShare} />
            <PrimaryButton title="New Bill" variant="secondary" onPress={() => setShowInvoicePreview(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  emptyCartTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  emptyCartText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  emptyCartActions: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.xl,
  },
  emptyCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  emptyCartBtnText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  cartList: {
    padding: SPACING.lg,
    paddingBottom: 0,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cartHeaderText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  clearCartText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    fontWeight: '600',
  },
  cartItem: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  cartItemPrice: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cartItemTotal: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
    minWidth: 70,
    textAlign: 'right',
  },
  totalsContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOW.md,
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  totalLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  totalValue: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  grandTotalLabel: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  grandTotalValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  customerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    height: 48,
    paddingHorizontal: SPACING.md,
  },
  customerBtnText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '600',
    flex: 1,
  },
  checkoutBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 48,
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  searchContainer: {
    padding: SPACING.lg,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.primaryLight,
    borderRadius: BORDER_RADIUS.md,
  },
  scanBtnText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  noResults: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  noResultsText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  addCustomerLink: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: SPACING.md,
  },
  noCustomerBtn: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  noCustomerText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  editModal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  editModalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  formInput: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    height: 48,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  editTotal: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  editModalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  editCancelBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  editCancelText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  editSaveBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  editSaveText: {
    fontSize: FONT_SIZE.md,
    color: '#fff',
    fontWeight: '700',
  },
  paymentModal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  paymentTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  paymentTotal: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontVariant: ['tabular-nums'],
  },
  paymentMethods: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  paymentMethod: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  paymentMethodActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  paymentMethodText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontWeight: '600',
  },
  paymentMethodTextActive: {
    color: COLORS.primary,
  },
  creditWarning: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.warning,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  dueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  dueLabel: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.error,
    fontWeight: '700',
  },
  dueValue: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.error,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  changeLabel: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.success,
    fontWeight: '700',
  },
  changeValue: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.success,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  paymentButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  cancelPaymentBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelPaymentText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  confirmPaymentBtn: {
    flex: 2,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  confirmPaymentText: {
    fontSize: FONT_SIZE.md,
    color: '#fff',
    fontWeight: '700',
  },
  invoiceActions: {
    padding: SPACING.lg,
    gap: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
});
