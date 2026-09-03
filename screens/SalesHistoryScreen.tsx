import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, Alert, ScrollView, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBusiness } from '../context/BusinessContext';
import { getSales, searchSales, getSaleItems, createSalesReturn, getSaleById } from '../lib/database';
import { Sale, SaleItem } from '../lib/types';
import { formatCurrency, formatDateTime, formatDate } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import SearchBar from '../components/SearchBar';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import InvoicePreview from '../components/InvoicePreview';
import ConfirmationDialog from '../components/ConfirmationDialog';

interface SalesHistoryScreenProps {
  navigation: any;
  route: any;
}

export default function SalesHistoryScreen({ navigation, route }: SalesHistoryScreenProps) {
  const { business } = useBusiness();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSaleDetail, setShowSaleDetail] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItems, setReturnItems] = useState<{ itemId: string; productName: string; quantity: number; maxQty: number; price: number; selected: boolean }[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const preSelectedSaleId = route.params?.saleId;

  async function loadData() {
    if (!business) return;
    try {
      const data = await getSales(business.id, 100);
      setSales(data);
      if (preSelectedSaleId) {
        const sale = await getSaleById(preSelectedSaleId);
        if (sale) openSaleDetail(sale);
      }
    } catch (e) { console.error('Sales history load error', e); } finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { loadData(); }, [business]));

  async function handleSearch(text: string) {
    setSearchQuery(text);
    if (!business || !text.trim()) { loadData(); return; }
    const results = await searchSales(business.id, text.trim());
    setSales(results);
  }

  function clearSearch() { setSearchQuery(''); loadData(); }

  async function openSaleDetail(sale: Sale) {
    try {
      const items = await getSaleItems(sale.id);
      setSaleItems(items);
      setSelectedSale(sale);
      setShowSaleDetail(true);
      setReturnItems(items.map(i => ({ itemId: i.id, productName: i.productName, quantity: 0, maxQty: i.quantity, price: i.price, selected: false })));
    } catch (e) { Alert.alert('Error', 'Failed to load sale details'); }
  }

  function handleReturnItemToggle(itemId: string, selected: boolean) {
    setReturnItems(prev => prev.map(r => r.itemId === itemId ? { ...r, selected, quantity: selected ? 1 : 0 } : r));
  }

  function handleReturnQtyChange(itemId: string, qty: number) {
    setReturnItems(prev => prev.map(r => r.itemId === itemId ? { ...r, quantity: Math.max(0, Math.min(qty, r.maxQty)) } : r));
  }

  async function handleSubmitReturn() {
    if (!selectedSale || !business) return;
    const itemsToReturn = returnItems.filter(r => r.selected && r.quantity > 0);
    if (itemsToReturn.length === 0) { Alert.alert('Invalid', 'Select at least one item to return'); return; }
    if (!returnReason.trim()) { Alert.alert('Required', 'Please enter a return reason'); return; }

    try {
      await createSalesReturn(selectedSale.id, itemsToReturn.map(r => ({
        productId: r.itemId, productName: r.productName, quantity: r.quantity, price: r.price,
      })), returnReason);
      setShowReturnModal(false);
      setReturnReason('');
      loadData();
      Alert.alert('Success', 'Sales return recorded successfully');
    } catch (e) {
      Alert.alert('Error', 'Failed to process return');
    }
  }

  function renderSaleItem({ item }: { item: Sale }) {
    return (
      <TouchableOpacity style={styles.saleCard} onPress={() => openSaleDetail(item)}>
        <View style={styles.saleRow}>
          <View>
            <Text style={styles.saleInvoice}>{item.invoiceNumber}</Text>
            <Text style={styles.saleDate}>{formatDate(item.createdAt)}</Text>
            {item.customerName && <Text style={styles.saleCustomer}>{item.customerName}</Text>}
          </View>
          <View style={styles.saleAmountCol}>
            <Text style={styles.saleAmount}>{formatCurrency(item.total)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: item.status === 'returned' ? COLORS.errorLight : item.paymentMethod === 'credit' ? COLORS.warningLight : COLORS.successLight }]}>
              <Text style={[styles.statusText, { color: item.status === 'returned' ? COLORS.error : item.paymentMethod === 'credit' ? COLORS.warning : COLORS.success }]}>
                {item.status === 'returned' ? 'RETURNED' : item.paymentMethod === 'credit' ? 'CREDIT' : 'PAID'}
              </Text>
            </View>
          </View>
        </View>
        {item.due > 0 && item.status === 'completed' && <Text style={styles.dueText}>Due: {formatCurrency(item.due)}</Text>}
      </TouchableOpacity>
    );
  }

  if (loading) return <LoadingState />;

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader title="Sales History" onBack={() => navigation.goBack()} />
      <View style={styles.searchContainer}>
        <SearchBar value={searchQuery} onChangeText={handleSearch} placeholder="Search by invoice or customer..." onClear={clearSearch} />
      </View>
      {sales.length === 0 ? <EmptyState icon="receipt-outline" title="No sales yet" message="Your sales will appear here once you create bills" /> : (
        <FlatList data={sales} keyExtractor={item => item.id} renderItem={renderSaleItem} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} />
      )}

      <Modal visible={showSaleDetail} animationType="slide" onRequestClose={() => setShowSaleDetail(false)}>
        <View style={COMMON_STYLES.screen}>
          <AppHeader title={selectedSale?.invoiceNumber || 'Sale Detail'} onBack={() => setShowSaleDetail(false)} rightAction={{ icon: 'return-down-back', onPress: () => { if (selectedSale && selectedSale.status !== 'returned') { setShowReturnModal(true); } } }} />
          {selectedSale && business && (
            <>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.detailScroll}>
                <InvoicePreview business={business} sale={selectedSale} items={saleItems} />
              </ScrollView>
              <View style={styles.detailActions}>
                <TouchableOpacity style={styles.shareBtn} onPress={() => navigation.navigate('InvoiceShare', { sale: selectedSale })}>
                  <Ionicons name="share-outline" size={20} color={COLORS.primary} /><Text style={styles.shareBtnText}>Share Invoice</Text>
                </TouchableOpacity>
                {selectedSale.status !== 'returned' && (
                  <TouchableOpacity style={styles.returnBtn} onPress={() => setShowReturnModal(true)}>
                    <Ionicons name="return-down-back" size={20} color={COLORS.error} /><Text style={styles.returnBtnText}>Return</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </Modal>

      <Modal visible={showReturnModal} transparent animationType="slide" onRequestClose={() => setShowReturnModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sales Return</Text>
            <Text style={styles.modalSubtitle}>Select items to return</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {returnItems.map(item => (
                <View key={item.itemId} style={styles.returnItem}>
                  <TouchableOpacity style={styles.checkbox} onPress={() => handleReturnItemToggle(item.itemId, !item.selected)}>
                    <Ionicons name={item.selected ? 'checkbox' : 'square-outline'} size={24} color={item.selected ? COLORS.primary : COLORS.textTertiary} />
                  </TouchableOpacity>
                  <View style={styles.returnItemInfo}>
                    <Text style={styles.returnItemName}>{item.productName}</Text>
                    <Text style={styles.returnItemMax}>Max: {item.maxQty}</Text>
                  </View>
                  {item.selected && (
                    <View style={styles.returnQty}>
                      <TouchableOpacity onPress={() => handleReturnQtyChange(item.itemId, item.quantity - 1)}><Ionicons name="remove" size={18} color={COLORS.primary} /></TouchableOpacity>
                      <Text style={styles.returnQtyText}>{item.quantity}</Text>
                      <TouchableOpacity onPress={() => handleReturnQtyChange(item.itemId, item.quantity + 1)}><Ionicons name="add" size={18} color={COLORS.primary} /></TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
            <Text style={styles.label}>Reason</Text>
            <TextInput style={styles.input} value={returnReason} onChangeText={setReturnReason} placeholder="Reason for return" />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowReturnModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmitReturn}><Text style={styles.confirmBtnText}>Process Return</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: { padding: SPACING.lg },
  listContent: { padding: SPACING.lg, paddingBottom: SPACING.xxxl * 2 },
  saleCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm, marginBottom: SPACING.md },
  saleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  saleInvoice: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primary },
  saleDate: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  saleCustomer: { fontSize: FONT_SIZE.sm, color: COLORS.textTertiary, marginTop: 2 },
  saleAmountCol: { alignItems: 'flex-end' },
  saleAmount: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  dueText: { fontSize: FONT_SIZE.sm, color: COLORS.error, fontWeight: '600', marginTop: SPACING.sm },
  detailScroll: { padding: SPACING.lg },
  detailActions: { flexDirection: 'row', padding: SPACING.lg, gap: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, padding: SPACING.md },
  shareBtnText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary },
  returnBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.error, borderRadius: BORDER_RADIUS.md, padding: SPACING.md },
  returnBtnText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.error },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: SPACING.xxxl },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary },
  modalSubtitle: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  returnItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  checkbox: { marginRight: SPACING.md },
  returnItemInfo: { flex: 1 },
  returnItemName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  returnItemMax: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  returnQty: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  returnQtyText: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary, minWidth: 30, textAlign: 'center' },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary, marginTop: SPACING.lg, marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.surfaceVariant, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.lg, height: 48, fontSize: FONT_SIZE.md, color: COLORS.textPrimary },
  modalButtons: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl },
  cancelBtn: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textSecondary },
  confirmBtn: { flex: 2, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.error, alignItems: 'center' },
  confirmBtnText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#fff' },
});
