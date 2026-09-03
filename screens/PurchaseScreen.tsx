import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBusiness } from '../context/BusinessContext';
import {
  getSuppliers, getProducts, createPurchase, incrementInvoiceNumber, createSupplierLedger, updateSupplierBalance,
} from '../lib/database';
import { Supplier, Product, PurchaseCartItem, Purchase, PurchaseItem, StockMovement } from '../lib/types';
import {
  generateId, formatCurrency, generateInvoiceNumber, roundTo2, calculateTax, getStartOfDay, getEndOfDay,
} from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import SearchBar from '../components/SearchBar';
import ProductCard from '../components/ProductCard';
import QuantitySelector from '../components/QuantitySelector';
import PrimaryButton from '../components/PrimaryButton';

interface PurchaseScreenProps {
  navigation: any;
  route: any;
}

export default function PurchaseScreen({ navigation, route }: PurchaseScreenProps) {
  const { business } = useBusiness();
  const [cart, setCart] = useState<PurchaseCartItem[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'credit' | 'card'>('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [billDiscount, setBillDiscount] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showEditCartItem, setShowEditCartItem] = useState(false);
  const [cartItemEdit, setCartItemEdit] = useState<PurchaseCartItem | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editDiscount, setEditDiscount] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = parseFloat(billDiscount) || 0;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = 0;
  const total = Math.max(0, taxableAmount + taxAmount);
  const paid = parseFloat(paidAmount) || total;
  const due = Math.max(0, total - paid);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.supplierId) {
        getSuppliers(business?.id || '').then(sups => {
          const sup = sups.find(s => s.id === route.params.supplierId);
          if (sup) setSelectedSupplier(sup);
        });
        navigation.setParams({ supplierId: undefined });
      }
    }, [route.params, business])
  );

  async function loadSuppliers() {
    if (!business) return;
    const data = await getSuppliers(business.id);
    setSuppliers(data);
  }

  async function handleSearch(text: string) {
    setSearchQuery(text);
    if (!business || !text.trim()) { setSearchResults([]); return; }
    const results = await getProducts(business.id);
    setSearchResults(results.filter(p => p.name.toLowerCase().includes(text.toLowerCase())));
  }

  async function handleSupplierSearch(text: string) {
    setSupplierSearch(text);
    if (!business || !text.trim()) { loadSuppliers(); return; }
    const all = await getSuppliers(business.id);
    setSuppliers(all.filter(s => s.name.toLowerCase().includes(text.toLowerCase())));
  }

  function addToCart(product: Product) {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1, price: product.purchasePrice, discount: 0, total: product.purchasePrice }]);
    }
    setShowSearch(false);
  }

  function updateCartItemQuantity(productId: string, quantity: number) {
    const item = cart.find(c => c.product.id === productId);
    if (!item) return;
    if (quantity <= 0) { setCart(cart.filter(c => c.product.id !== productId)); return; }
    setCart(cart.map(c => c.product.id === productId ? { ...c, quantity, total: quantity * c.price - c.discount } : c));
  }

  function openEditCartItem(item: PurchaseCartItem) {
    setCartItemEdit(item);
    setEditPrice(String(item.price));
    setEditDiscount(String(item.discount));
    setShowEditCartItem(true);
  }

  function saveCartItemEdit() {
    if (!cartItemEdit) return;
    const price = parseFloat(editPrice) || cartItemEdit.price;
    const discount = parseFloat(editDiscount) || 0;
    setCart(cart.map(c => c.product.id === cartItemEdit.product.id ? { ...c, price, discount, total: c.quantity * price - discount } : c));
    setShowEditCartItem(false); setCartItemEdit(null);
  }

  async function handleCompletePurchase() {
    if (!business || cart.length === 0 || !selectedSupplier) return;
    if (due < 0) { Alert.alert('Invalid', 'Paid cannot exceed total'); return; }
    if (paymentMethod === 'credit' && due <= 0) { Alert.alert('Invalid', 'Credit purchase must have due'); return; }
    setProcessing(true);
    try {
      const invoiceNumber = generateInvoiceNumber('PUR', business.invoiceNextNumber);
      const purchaseId = generateId();
      const now = new Date().toISOString();

      const purchaseItems: PurchaseItem[] = cart.map(item => ({
        id: generateId(), purchaseId, productId: item.product.id, productName: item.product.name,
        quantity: item.quantity, price: item.price, discount: item.discount, taxRate: 0, taxAmount: 0,
        total: item.price * item.quantity - item.discount,
      }));
      const totalAmount = taxableAmount;
      const finalPaid = paymentMethod === 'credit' ? paid : totalAmount;
      const finalDue = paymentMethod === 'credit' ? due : 0;

      const purchase: Purchase = {
        id: purchaseId, businessId: business.id, invoiceNumber, supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name, subtotal, discount: discountAmount, taxAmount: 0, total: totalAmount,
        paid: finalPaid, due: finalDue, paymentMethod, status: 'completed', notes: '', supplierInvoiceNumber,
        createdAt: now,
      };

      const stockMovements: StockMovement[] = [];
      for (const item of cart) {
        const product = await getProductById(item.product.id);
        if (product) {
          const newQty = roundTo2(product.currentStock + item.quantity);
          stockMovements.push({
            id: generateId(), businessId: business.id, productId: item.product.id, productName: item.product.name,
            previousQty: product.currentStock, changeQty: item.quantity, newQty, type: 'purchase',
            reason: `Purchase ${invoiceNumber}`, referenceId: purchaseId, createdAt: now,
          });
        }
      }

      await createPurchase(purchase, purchaseItems, stockMovements);
      await incrementInvoiceNumber(business.id);
      setCart([]); setSelectedSupplier(null); setPaidAmount(''); setBillDiscount(''); setSupplierInvoiceNumber('');
      setPaymentMethod('cash'); setShowPaymentModal(false);
      Alert.alert('Success', `Purchase ${invoiceNumber} recorded successfully`);
    } catch (e) {
      Alert.alert('Error', 'Failed to complete purchase');
      console.error('Purchase error', e);
    } finally { setProcessing(false); }
  }

  async function getProductById(id: string): Promise<any> {
    const { getProductById } = await import('../lib/database');
    return await getProductById(id);
  }

  if (!business) return <View style={COMMON_STYLES.center}><Text>No business selected</Text></View>;

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader title="New Purchase" subtitle={selectedSupplier ? selectedSupplier.name : 'Select Supplier'} onBack={() => navigation.goBack()} rightAction={{ icon: 'search-outline', onPress: () => setShowSearch(true) }} />
      {cart.length === 0 ? (
        <View style={styles.emptyCart}>
          <Ionicons name="cart-outline" size={80} color={COLORS.textTertiary} />
          <Text style={styles.emptyCartTitle}>Cart is empty</Text>
          <Text style={styles.emptyCartText}>Search products and select a supplier</Text>
          <View style={styles.emptyCartActions}>
            <TouchableOpacity style={styles.emptyCartBtn} onPress={() => { loadSuppliers(); setShowSupplierModal(true); }}>
              <Ionicons name="business-outline" size={20} color={COLORS.primary} /><Text style={styles.emptyCartBtnText}>Select Supplier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emptyCartBtn} onPress={() => setShowSearch(true)}>
              <Ionicons name="search-outline" size={20} color={COLORS.primary} /><Text style={styles.emptyCartBtnText}>Search Products</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <FlatList data={cart} keyExtractor={item => item.product.id} renderItem={({ item }) => (
            <TouchableOpacity style={styles.cartItem} onPress={() => openEditCartItem(item)}>
              <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName} numberOfLines={1}>{item.product.name}</Text>
                <Text style={styles.cartItemPrice}>{formatCurrency(item.price)} each</Text>
              </View>
              <QuantitySelector quantity={item.quantity} onIncrement={() => updateCartItemQuantity(item.product.id, item.quantity + 1)} onDecrement={() => updateCartItemQuantity(item.product.id, item.quantity - 1)} unit={item.product.unit} size="sm" />
              <Text style={styles.cartItemTotal}>{formatCurrency(item.total)}</Text>
            </TouchableOpacity>
          )} contentContainerStyle={styles.cartList} showsVerticalScrollIndicator={false} ListHeaderComponent={
            <View style={styles.cartHeader}><Text style={styles.cartHeaderText}>Cart ({cart.length})</Text><TouchableOpacity onPress={() => setCart([])}><Text style={styles.clearCartText}>Clear</Text></TouchableOpacity></View>
          } />
          <View style={styles.totalsContainer}>
            <TouchableOpacity style={styles.discountRow} onPress={() => { }}>
              <Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
            </TouchableOpacity>
            {discountAmount > 0 && <View style={styles.discountRow}><Text style={styles.totalLabel}>Discount</Text><Text style={[styles.totalValue, { color: COLORS.success }]}>-{formatCurrency(discountAmount)}</Text></View>}
            <View style={styles.grandTotalRow}><Text style={styles.grandTotalLabel}>Grand Total</Text><Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text></View>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.supplierBtn} onPress={() => { loadSuppliers(); setShowSupplierModal(true); }}>
                <Ionicons name={selectedSupplier ? 'business' : 'business-outline'} size={18} color={COLORS.primary} />
                <Text style={styles.supplierBtnText} numberOfLines={1}>{selectedSupplier ? selectedSupplier.name : 'Select Supplier'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.checkoutBtn} onPress={() => setShowPaymentModal(true)}>
                <Text style={styles.checkoutBtnText}>Complete</Text><Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      <Modal visible={showSupplierModal} animationType="slide" onRequestClose={() => setShowSupplierModal(false)}>
        <View style={COMMON_STYLES.screen}>
          <AppHeader title="Select Supplier" onBack={() => setShowSupplierModal(false)} />
          <View style={styles.searchContainer}>
            <SearchBar value={supplierSearch} onChangeText={handleSupplierSearch} placeholder="Search suppliers..." onClear={() => { setSupplierSearch(''); loadSuppliers(); }} autoFocus />
          </View>
          <FlatList data={suppliers} keyExtractor={item => item.id} renderItem={({ item }) => (
            <TouchableOpacity style={styles.supplierCard} onPress={() => { setSelectedSupplier(item); setShowSupplierModal(false); }}>
              <View style={styles.supplierIcon}><Ionicons name="business-outline" size={22} color={COLORS.secondary} /></View>
              <View style={styles.supplierDetails}><Text style={styles.supplierName}>{item.name}</Text>{item.mobile && <Text style={styles.supplierMobile}>{item.mobile}</Text>}</View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )} contentContainerStyle={styles.listContent} ListEmptyComponent={<View style={styles.noResults}><Text style={styles.noResultsText}>No suppliers found</Text><TouchableOpacity onPress={() => { setShowSupplierModal(false); navigation.navigate('Suppliers', { addNew: true }); }}><Text style={styles.addLink}>Add Supplier</Text></TouchableOpacity></View>} />
        </View>
      </Modal>

      <Modal visible={showSearch} animationType="slide" onRequestClose={() => setShowSearch(false)}>
        <View style={COMMON_STYLES.screen}>
          <AppHeader title="Search Products" onBack={() => setShowSearch(false)} />
          <View style={styles.searchContainer}><SearchBar value={searchQuery} onChangeText={handleSearch} placeholder="Search products..." onClear={() => { setSearchQuery(''); setSearchResults([]); }} autoFocus /></View>
          <FlatList data={searchResults} keyExtractor={item => item.id} renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => addToCart(item)} />
          )} contentContainerStyle={styles.listContent} ListEmptyComponent={searchQuery.length > 0 ? <View style={styles.noResults}><Text style={styles.noResultsText}>No products found</Text></View> : null} />
        </View>
      </Modal>

      <Modal visible={showEditCartItem} transparent animationType="fade" onRequestClose={() => setShowEditCartItem(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.editModalTitle}>{cartItemEdit?.product.name}</Text>
            <Text style={styles.formLabel}>Price per unit</Text><TextInput style={styles.formInput} value={editPrice} onChangeText={setEditPrice} keyboardType="decimal-pad" />
            <Text style={styles.formLabel}>Discount</Text><TextInput style={styles.formInput} value={editDiscount} onChangeText={setEditDiscount} keyboardType="decimal-pad" />
            <View style={styles.editModalButtons}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setShowEditCartItem(false)}><Text style={styles.editCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.editSaveBtn} onPress={saveCartItemEdit}><Text style={styles.editSaveText}>Update</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPaymentModal} transparent animationType="slide" onRequestClose={() => setShowPaymentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModal}>
            <Text style={styles.paymentTitle}>Purchase Payment</Text><Text style={styles.paymentTotal}>{formatCurrency(total)}</Text>
            <View style={styles.paymentMethods}>
              {(['cash', 'upi', 'credit', 'card'] as const).map(method => (
                <TouchableOpacity key={method} style={[styles.paymentMethod, paymentMethod === method && styles.paymentMethodActive]} onPress={() => setPaymentMethod(method)}>
                  <Ionicons name={method === 'cash' ? 'cash-outline' : method === 'upi' ? 'phone-portrait-outline' : method === 'credit' ? 'time-outline' : 'card-outline'} size={24} color={paymentMethod === method ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={[styles.paymentMethodText, paymentMethod === method && styles.paymentMethodTextActive]}>{method === 'upi' ? 'UPI' : method === 'credit' ? 'Credit' : method.charAt(0).toUpperCase() + method.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.formLabel}>Amount Paid</Text><TextInput style={styles.formInput} value={paidAmount} onChangeText={setPaidAmount} keyboardType="decimal-pad" placeholder={String(total)} />
            <Text style={styles.formLabel}>Bill Discount</Text><TextInput style={styles.formInput} value={billDiscount} onChangeText={setBillDiscount} keyboardType="decimal-pad" placeholder="0" />
            <Text style={styles.formLabel}>Supplier Invoice #</Text><TextInput style={styles.formInput} value={supplierInvoiceNumber} onChangeText={setSupplierInvoiceNumber} placeholder="Supplier invoice number" />
            {due > 0 && <View style={styles.dueRow}><Text style={styles.dueLabel}>Due</Text><Text style={styles.dueValue}>{formatCurrency(due)}</Text></View>}
            <View style={styles.paymentButtons}>
              <TouchableOpacity style={styles.cancelPaymentBtn} onPress={() => setShowPaymentModal(false)}><Text style={styles.cancelPaymentText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmPaymentBtn} onPress={handleCompletePurchase} disabled={processing}>
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmPaymentText}>Complete Purchase</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCart: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl },
  emptyCartTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.lg },
  emptyCartText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING.sm, textAlign: 'center' },
  emptyCartActions: { flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.xl },
  emptyCartBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  emptyCartBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: FONT_SIZE.md },
  cartList: { padding: SPACING.lg, paddingBottom: 0 },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  cartHeaderText: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary },
  clearCartText: { fontSize: FONT_SIZE.sm, color: COLORS.error, fontWeight: '600' },
  cartItem: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.sm, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  cartItemPrice: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  cartItemTotal: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary, fontVariant: ['tabular-nums'], minWidth: 70, textAlign: 'right' },
  totalsContainer: { backgroundColor: COLORS.surface, padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border, ...SHADOW.md },
  discountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalLabel: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  totalValue: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, fontWeight: '600', fontVariant: ['tabular-nums'] },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: SPACING.sm, marginTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.divider },
  grandTotalLabel: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary },
  grandTotalValue: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.primary, fontVariant: ['tabular-nums'] },
  actionRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
  supplierBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, height: 48, paddingHorizontal: SPACING.md },
  supplierBtnText: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600', flex: 1 },
  checkoutBtn: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, height: 48 },
  checkoutBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
  searchContainer: { padding: SPACING.lg },
  listContent: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  noResults: { alignItems: 'center', padding: SPACING.xl },
  noResultsText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  addLink: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600', marginTop: SPACING.md },
  supplierCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm, marginBottom: SPACING.md, flexDirection: 'row', alignItems: 'center' },
  supplierIcon: { width: 44, height: 44, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.secondaryLight, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  supplierDetails: { flex: 1 },
  supplierName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  supplierMobile: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  editModal: { backgroundColor: COLORS.surface, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: SPACING.xxxl },
  editModalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.lg },
  formLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary, marginTop: SPACING.md },
  formInput: { backgroundColor: COLORS.surfaceVariant, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.lg, height: 48, fontSize: FONT_SIZE.md, color: COLORS.textPrimary, marginTop: SPACING.xs },
  editModalButtons: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
  editCancelBtn: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  editCancelText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, fontWeight: '600' },
  editSaveBtn: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  editSaveText: { fontSize: FONT_SIZE.md, color: '#fff', fontWeight: '700' },
  paymentModal: { backgroundColor: COLORS.surface, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: SPACING.xxxl },
  paymentTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  paymentTotal: { fontSize: FONT_SIZE.xxxl, fontWeight: '700', color: COLORS.primary, textAlign: 'center', marginTop: SPACING.sm, fontVariant: ['tabular-nums'] },
  paymentMethods: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
  paymentMethod: { flex: 1, alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  paymentMethodActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  paymentMethodText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs, fontWeight: '600' },
  paymentMethodTextActive: { color: COLORS.primary },
  dueRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.lg, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.divider },
  dueLabel: { fontSize: FONT_SIZE.lg, color: COLORS.error, fontWeight: '700' },
  dueValue: { fontSize: FONT_SIZE.lg, color: COLORS.error, fontWeight: '700', fontVariant: ['tabular-nums'] },
  paymentButtons: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl },
  cancelPaymentBtn: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelPaymentText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, fontWeight: '600' },
  confirmPaymentBtn: { flex: 2, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  confirmPaymentText: { fontSize: FONT_SIZE.md, color: '#fff', fontWeight: '700' },
});
