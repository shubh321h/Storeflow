import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBusiness } from '../context/BusinessContext';
import { getCustomers, searchCustomers, createPayment, getCustomerStats } from '../lib/database';
import { Customer } from '../lib/types';
import { generateId, formatCurrency } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import SearchBar from '../components/SearchBar';
import CustomerCard from '../components/CustomerCard';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';

interface CollectPaymentScreenProps {
  navigation: any;
}

export default function CollectPaymentScreen({ navigation }: CollectPaymentScreenProps) {
  const { business } = useBusiness();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [customerStats, setCustomerStats] = useState<any>(null);

  async function loadData() {
    if (!business) return;
    try {
      const data = await getCustomers(business.id);
      const withDues = data.filter(c => c.balance > 0);
      setCustomers(withDues);
    } catch (e) { console.error('Collect payment load error', e); } finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { loadData(); }, [business]));

  async function handleSearch(text: string) {
    setSearchQuery(text);
    if (!business || !text.trim()) { loadData(); return; }
    const results = await searchCustomers(business.id, text.trim());
    setCustomers(results.filter(c => c.balance > 0));
  }

  function clearSearch() { setSearchQuery(''); loadData(); }

  async function openPaymentModal(customer: Customer) {
    setSelectedCustomer(customer);
    setPaymentAmount(String(customer.balance));
    setPaymentMethod('cash');
    setPaymentNotes('');
    if (business) {
      const stats = await getCustomerStats(business.id, customer.id);
      setCustomerStats(stats);
    }
    setShowPaymentModal(true);
  }

  async function handleCollectPayment() {
    if (!business || !selectedCustomer) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) { Alert.alert('Invalid', 'Please enter a valid amount'); return; }
    if (amount > selectedCustomer.balance) { Alert.alert('Invalid', 'Amount cannot exceed due balance'); return; }

    setProcessing(true);
    try {
      await createPayment({
        id: generateId(), businessId: business.id, customerId: selectedCustomer.id,
        amount, method: paymentMethod, notes: paymentNotes || undefined, createdAt: new Date().toISOString(),
      });
      setShowPaymentModal(false); setSelectedCustomer(null); loadData();
      Alert.alert('Success', `${formatCurrency(amount)} collected successfully`);
    } catch (e) { Alert.alert('Error', 'Failed to record payment'); } finally { setProcessing(false); }
  }

  if (loading) return <LoadingState />;

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader title="Collect Payment" onBack={() => navigation.goBack()} />
      <View style={styles.searchContainer}>
        <SearchBar value={searchQuery} onChangeText={handleSearch} placeholder="Search customers with dues..." onClear={clearSearch} />
      </View>

      {customers.length === 0 ? <EmptyState icon="checkmark-circle-outline" title="No outstanding dues" message="All customers have paid their dues. Great job!" /> : (
        <FlatList data={customers} keyExtractor={item => item.id} renderItem={({ item }) => (
          <TouchableOpacity style={styles.customerRow} onPress={() => openPaymentModal(item)}>
            <CustomerCard customer={item} onPress={() => openPaymentModal(item)} />
          </TouchableOpacity>
        )} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} />
      )}

      <Modal visible={showPaymentModal} transparent animationType="slide" onRequestClose={() => setShowPaymentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModal}>
            <Text style={styles.paymentTitle}>Collect Payment</Text>
            <Text style={styles.customerName}>{selectedCustomer?.name}</Text>
            <Text style={styles.dueAmount}>Due: {formatCurrency(selectedCustomer?.balance || 0)}</Text>

            {customerStats && (
              <View style={styles.statsSummary}>
                <Text style={styles.statsSummaryText}>Total Purchases: {formatCurrency(customerStats.totalPurchases)}</Text>
                <Text style={styles.statsSummaryText}>Total Paid: {formatCurrency(customerStats.totalPaid)}</Text>
              </View>
            )}

            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.methodRow}>
              {(['cash', 'upi', 'card'] as const).map((m) => (
                <TouchableOpacity key={m} style={[styles.methodBtn, paymentMethod === m && styles.methodBtnActive]} onPress={() => setPaymentMethod(m)}>
                  <Ionicons name={m === 'cash' ? 'cash-outline' : m === 'upi' ? 'phone-portrait-outline' : 'card-outline'} size={22} color={paymentMethod === m ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={[styles.methodText, paymentMethod === m && styles.methodTextActive]}>{m.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Amount</Text>
            <TextInput style={styles.input} value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" placeholder="Enter amount" placeholderTextColor={COLORS.textTertiary} />

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput style={[styles.input, styles.textArea]} value={paymentNotes} onChangeText={setPaymentNotes} multiline numberOfLines={2} placeholder="Payment notes" placeholderTextColor={COLORS.textTertiary} />

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPaymentModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.collectBtn} onPress={handleCollectPayment} disabled={processing}>
                {processing ? <Text style={styles.collectBtnText}>Processing...</Text> : <Text style={styles.collectBtnText}>Collect</Text>}
              </TouchableOpacity>
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
  customerRow: { marginBottom: SPACING.md },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  paymentModal: { backgroundColor: COLORS.surface, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: SPACING.xxxl },
  paymentTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  customerName: { fontSize: FONT_SIZE.lg, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.xs },
  dueAmount: { fontSize: FONT_SIZE.xxxl, fontWeight: '700', color: COLORS.error, textAlign: 'center', marginTop: SPACING.sm, fontVariant: ['tabular-nums'] },
  statsSummary: { backgroundColor: COLORS.surfaceVariant, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, marginVertical: SPACING.lg },
  statsSummaryText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginVertical: 2 },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary, marginTop: SPACING.lg, marginBottom: SPACING.xs },
  methodRow: { flexDirection: 'row', gap: SPACING.md },
  methodBtn: { flex: 1, alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  methodBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  methodText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs, fontWeight: '600' },
  methodTextActive: { color: COLORS.primary },
  input: { backgroundColor: COLORS.surfaceVariant, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.lg, height: 48, fontSize: FONT_SIZE.md, color: COLORS.textPrimary },
  textArea: { height: 64, textAlignVertical: 'top', paddingTop: SPACING.md },
  buttonRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl },
  cancelBtn: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, fontWeight: '600' },
  collectBtn: { flex: 2, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  collectBtnText: { fontSize: FONT_SIZE.md, color: '#fff', fontWeight: '700' },
});
