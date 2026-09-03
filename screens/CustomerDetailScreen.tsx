import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBusiness } from '../context/BusinessContext';
import {
  getCustomerById, getCustomerLedger, getCustomerStats, updateCustomer, createPayment, recalculateCustomerBalance,
  getSales, createCustomerLedger, getProducts,
} from '../lib/database';
import { Customer, CustomerLedger, Sale } from '../lib/types';
import { generateId, formatCurrency, formatDate, formatDateTime, validateMobile } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import PrimaryButton from '../components/PrimaryButton';
import MoneyDisplay from '../components/MoneyDisplay';

interface CustomerDetailScreenProps {
  navigation: any;
  route: any;
}

export default function CustomerDetailScreen({ navigation, route }: CustomerDetailScreenProps) {
  const { business } = useBusiness();
  const customerId = route.params?.customerId;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<CustomerLedger[]>([]);
  const [stats, setStats] = useState({ totalPurchases: 0, totalPaid: 0, purchaseCount: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'ledger' | 'purchases'>('details');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState('');
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjType, setAdjType] = useState<'debit_adjustment' | 'credit_adjustment'>('debit_adjustment');
  const [adjNotes, setAdjNotes] = useState('');
  const [purchases, setPurchases] = useState<Sale[]>([]);

  async function loadData() {
    if (!business || !customerId) return;
    try {
      const [c, l, s, p] = await Promise.all([
        getCustomerById(customerId),
        getCustomerLedger(customerId),
        getCustomerStats(business.id, customerId),
        getSales(business.id, 50),
      ]);
      if (c) {
        setCustomer(c);
        setEditName(c.name);
        setEditMobile(c.mobile || '');
        setEditAddress(c.address || '');
        setEditNotes(c.notes || '');
        setEditCreditLimit(c.creditLimit ? String(c.creditLimit) : '');
      }
      setLedger(l);
      setStats(s);
      setPurchases(p.filter(sale => sale.customerId === customerId));
    } catch (e) {
      console.error('Customer detail load error', e);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => { loadData(); }, [business, customerId])
  );

  async function handlePayment() {
    if (!business || !customer) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid', 'Please enter a valid amount'); return;
    }
    if (amount > customer.balance) {
      Alert.alert('Invalid', 'Payment cannot exceed due amount'); return;
    }
    try {
      await createPayment({
        id: generateId(), businessId: business.id, customerId: customer.id, amount,
        method: paymentMethod, notes: paymentNotes || undefined, createdAt: new Date().toISOString(),
      });
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNotes('');
      loadData();
      Alert.alert('Success', `₹${amount.toFixed(2)} collected successfully`);
    } catch (e) {
      Alert.alert('Error', 'Failed to record payment');
    }
  }

  async function handleSaveEdit() {
    if (!customer || !business) return;
    if (!editName.trim()) { Alert.alert('Required', 'Name is required'); return; }
    if (editMobile && !validateMobile(editMobile)) { Alert.alert('Invalid', 'Invalid mobile number'); return; }
    try {
      await updateCustomer({
        ...customer, name: editName.trim(), mobile: editMobile.trim() || undefined,
        address: editAddress.trim() || undefined, notes: editNotes.trim() || undefined,
        creditLimit: editCreditLimit ? parseFloat(editCreditLimit) : undefined,
        updatedAt: new Date().toISOString(),
      });
      setShowEditModal(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to update customer');
    }
  }

  async function handleAdjustment() {
    if (!customer || !business) return;
    const amount = parseFloat(adjAmount);
    if (!amount || amount <= 0) { Alert.alert('Invalid', 'Please enter a valid amount'); return; }
    try {
      const newBalance = adjType === 'debit_adjustment' ? customer.balance + amount : customer.balance - amount;
      await createCustomerLedger({
        id: generateId(), businessId: business.id, customerId: customer.id, customerName: customer.name,
        date: new Date().toISOString(), type: adjType,
        description: adjNotes || (adjType === 'debit_adjustment' ? 'Debit Adjustment' : 'Credit Adjustment'),
        referenceId: undefined, debit: adjType === 'debit_adjustment' ? amount : 0,
        credit: adjType === 'credit_adjustment' ? amount : 0, balance: newBalance,
        createdAt: new Date().toISOString(),
      });
      await recalculateCustomerBalance(customer.id);
      setShowAdjustmentModal(false);
      setAdjAmount(''); setAdjNotes('');
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to record adjustment');
    }
  }

  async function handleWhatsAppShare() {
    if (!customer || !business) return;
    const message = `Hi ${customer.name},\n\n` +
      `Your outstanding balance at ${business.storeName} is ${formatCurrency(customer.balance)}.\n\n` +
      `Please clear your dues at the earliest convenience.\n\nThank you!`;
    try {
      const { shareAsync } = await import('expo-sharing');
      const { printToFileAsync } = await import('expo-print');
      const html = `<html><body><pre>${message}</pre></body></html>`;
      const { uri } = await printToFileAsync({ html });
      await shareAsync(uri, { dialogTitle: 'Share via WhatsApp' });
    } catch (e) {
      Alert.alert('Coming Soon', 'WhatsApp sharing requires native modules');
    }
  }

  if (loading) return <LoadingState />;
  if (!customer) return (
    <View style={COMMON_STYLES.center}><Text>Customer not found</Text></View>
  );

  const outstanding = customer.balance > 0 ? customer.balance : 0;
  const credit = customer.balance < 0 ? Math.abs(customer.balance) : 0;

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader title="Customer Profile" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={64} color={COLORS.primary} />
          </View>
          <Text style={styles.name}>{customer.name}</Text>
          {customer.mobile && <Text style={styles.mobile}>{customer.mobile}</Text>}
          {customer.address && <Text style={styles.address}>{customer.address}</Text>}
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(stats.totalPurchases)}</Text>
            <Text style={styles.statLabel}>Total Purchases</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(stats.totalPaid)}</Text>
            <Text style={styles.statLabel}>Total Paid</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: outstanding > 0 ? COLORS.error : COLORS.success }]}>
              {outstanding > 0 ? formatCurrency(outstanding) : credit > 0 ? formatCurrency(credit) : '₹0.00'}
            </Text>
            <Text style={styles.statLabel}>{outstanding > 0 ? 'Due' : credit > 0 ? 'Credit' : 'Balance'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.purchaseCount}</Text>
            <Text style={styles.statLabel}>Bills</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Billing', { customerId: customer.id, customerName: customer.name })}>
            <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
            <Text style={styles.actionText}>New Bill</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowPaymentModal(true)}>
            <Ionicons name="cash-outline" size={20} color={COLORS.success} />
            <Text style={styles.actionText}>Payment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowEditModal(true)}>
            <Ionicons name="create-outline" size={20} color={COLORS.secondary} />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleWhatsAppShare}>
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {(['details', 'ledger', 'purchases'] as const).map(tab => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'details' ? 'Details' : tab === 'ledger' ? 'Ledger' : 'Purchases'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'details' && (
          <View style={styles.detailsCard}>
            {customer.openingBalance !== 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Opening Balance</Text>
                <Text style={styles.detailValue}>{formatCurrency(customer.openingBalance)}</Text>
              </View>
            )}
            {customer.creditLimit && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Credit Limit</Text>
                <Text style={styles.detailValue}>{formatCurrency(customer.creditLimit)}</Text>
              </View>
            )}
            {customer.notes && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>{customer.notes}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.adjustBtn} onPress={() => setShowAdjustmentModal(true)}>
              <Text style={styles.adjustBtnText}>Adjust Balance</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'ledger' && (
          <View>
            {ledger.length === 0 ? (
              <EmptyState icon="book-outline" title="No ledger entries" message="Transactions will appear here" />
            ) : (
              ledger.map(entry => (
                <View key={entry.id} style={styles.ledgerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ledgerDate}>{formatDate(entry.date)}</Text>
                    <Text style={styles.ledgerDesc}>{entry.description}</Text>
                  </View>
                  <View style={styles.ledgerAmounts}>
                    {entry.debit > 0 && <Text style={styles.ledgerDebit}>+{formatCurrency(entry.debit)}</Text>}
                    {entry.credit > 0 && <Text style={styles.ledgerCredit}>-{formatCurrency(entry.credit)}</Text>}
                    <Text style={styles.ledgerBalance}>{formatCurrency(entry.balance)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'purchases' && (
          <View>
            {purchases.length === 0 ? (
              <EmptyState icon="receipt-outline" title="No purchases yet" message="This customer has no recorded purchases" />
            ) : (
              purchases.map(sale => (
                <TouchableOpacity key={sale.id} style={styles.purchaseCard} onPress={() => navigation.navigate('SalesHistory', { saleId: sale.id })}>
                  <View style={styles.purchaseRow}>
                    <Text style={styles.purchaseInvoice}>{sale.invoiceNumber}</Text>
                    <Text style={styles.purchaseAmount}>{formatCurrency(sale.total)}</Text>
                  </View>
                  <Text style={styles.purchaseDate}>{formatDateTime(sale.createdAt)}</Text>
                  {sale.due > 0 && <Text style={styles.purchaseDue}>Due: {formatCurrency(sale.due)}</Text>}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} transparent animationType="slide" onRequestClose={() => setShowPaymentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Collect Payment</Text>
            <Text style={styles.modalSubtitle}>{customer.name}</Text>
            <Text style={styles.dueDisplay}>Due: {formatCurrency(customer.balance)}</Text>

            <Text style={styles.label}>Amount</Text>
            <TextInput style={styles.input} value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" placeholder="0.00" />

            <Text style={styles.label}>Method</Text>
            <View style={styles.methodRow}>
              {(['cash', 'upi', 'card'] as const).map(m => (
                <TouchableOpacity key={m} style={[styles.methodBtn, paymentMethod === m && styles.methodBtnActive]} onPress={() => setPaymentMethod(m)}>
                  <Text style={[styles.methodBtnText, paymentMethod === m && styles.methodBtnTextActive]}>{m.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.textArea]} value={paymentNotes} onChangeText={setPaymentNotes} multiline placeholder="Optional" />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPaymentModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handlePayment}>
                <Text style={styles.confirmBtnText}>Save Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Customer</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} />
            <Text style={styles.label}>Mobile</Text>
            <TextInput style={styles.input} value={editMobile} onChangeText={setEditMobile} keyboardType="phone-pad" maxLength={10} />
            <Text style={styles.label}>Address</Text>
            <TextInput style={[styles.input, styles.textArea]} value={editAddress} onChangeText={setEditAddress} multiline />
            <Text style={styles.label}>Credit Limit</Text>
            <TextInput style={styles.input} value={editCreditLimit} onChangeText={setEditCreditLimit} keyboardType="decimal-pad" placeholder="0" />
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.textArea]} value={editNotes} onChangeText={setEditNotes} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveEdit}>
                <Text style={styles.confirmBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Adjustment Modal */}
      <Modal visible={showAdjustmentModal} transparent animationType="slide" onRequestClose={() => setShowAdjustmentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Balance Adjustment</Text>
            <Text style={styles.label}>Type</Text>
            <View style={styles.methodRow}>
              <TouchableOpacity style={[styles.methodBtn, adjType === 'debit_adjustment' && styles.methodBtnActive]} onPress={() => setAdjType('debit_adjustment')}>
                <Text style={[styles.methodBtnText, adjType === 'debit_adjustment' && styles.methodBtnTextActive]}>Add Due</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.methodBtn, adjType === 'credit_adjustment' && styles.methodBtnActive]} onPress={() => setAdjType('credit_adjustment')}>
                <Text style={[styles.methodBtnText, adjType === 'credit_adjustment' && styles.methodBtnTextActive]}>Reduce Due</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Amount</Text>
            <TextInput style={styles.input} value={adjAmount} onChangeText={setAdjAmount} keyboardType="decimal-pad" />
            <Text style={styles.label}>Reason</Text>
            <TextInput style={[styles.input, styles.textArea]} value={adjNotes} onChangeText={setAdjNotes} multiline placeholder="Reason for adjustment" />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdjustmentModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleAdjustment}>
                <Text style={styles.confirmBtnText}>Adjust</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xxxl * 2 },
  profileCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, alignItems: 'center', ...SHADOW.sm, marginBottom: SPACING.lg },
  avatarContainer: { marginBottom: SPACING.md },
  name: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary },
  mobile: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: 2 },
  address: { fontSize: FONT_SIZE.sm, color: COLORS.textTertiary, marginTop: 2, textAlign: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
  statCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, flex: 1, minWidth: 140, alignItems: 'center', ...SHADOW.sm },
  statValue: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  actionBtn: { flex: 1, backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm },
  actionText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textPrimary, marginTop: 4 },
  tabRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: 4, marginBottom: SPACING.lg, ...SHADOW.sm },
  tab: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: BORDER_RADIUS.sm },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },
  detailsCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  detailLabel: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  detailValue: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  adjustBtn: { marginTop: SPACING.lg, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.warning, alignItems: 'center' },
  adjustBtnText: { color: COLORS.warning, fontWeight: '600' },
  ledgerRow: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOW.sm, flexDirection: 'row', alignItems: 'center' },
  ledgerDate: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  ledgerDesc: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, fontWeight: '600', marginTop: 2 },
  ledgerAmounts: { alignItems: 'flex-end', marginLeft: SPACING.md },
  ledgerDebit: { fontSize: FONT_SIZE.md, color: COLORS.error, fontWeight: '700' },
  ledgerCredit: { fontSize: FONT_SIZE.md, color: COLORS.success, fontWeight: '700' },
  ledgerBalance: { fontSize: FONT_SIZE.sm, color: COLORS.textTertiary, marginTop: 2 },
  purchaseCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOW.sm },
  purchaseRow: { flexDirection: 'row', justifyContent: 'space-between' },
  purchaseInvoice: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primary },
  purchaseAmount: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary },
  purchaseDate: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  purchaseDue: { fontSize: FONT_SIZE.sm, color: COLORS.error, fontWeight: '600', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: SPACING.xxxl },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  modalSubtitle: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  dueDisplay: { fontSize: FONT_SIZE.xxxl, fontWeight: '700', color: COLORS.error, textAlign: 'center', marginVertical: SPACING.lg },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary, marginTop: SPACING.lg, marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.surfaceVariant, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.lg, height: 48, fontSize: FONT_SIZE.md, color: COLORS.textPrimary },
  textArea: { height: 64, textAlignVertical: 'top', paddingTop: SPACING.md },
  methodRow: { flexDirection: 'row', gap: SPACING.md },
  methodBtn: { flex: 1, alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  methodBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  methodBtnText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textSecondary },
  methodBtnTextActive: { color: COLORS.primary },
  modalButtons: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl },
  cancelBtn: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textSecondary },
  confirmBtn: { flex: 2, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  confirmBtnText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#fff' },
});
