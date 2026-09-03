import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBusiness } from '../context/BusinessContext';
import {
  getSupplierById, getSupplierLedger, getPurchasesBySupplier, updateSupplier, createPayment, recalculateSupplierBalance,
  createSupplierLedger,
} from '../lib/database';
import { Supplier, SupplierLedger, Purchase } from '../lib/types';
import { generateId, formatCurrency, formatDate, formatDateTime } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';

interface SupplierDetailScreenProps {
  navigation: any;
  route: any;
}

export default function SupplierDetailScreen({ navigation, route }: SupplierDetailScreenProps) {
  const { business } = useBusiness();
  const supplierId = route.params?.supplierId;
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [ledger, setLedger] = useState<SupplierLedger[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
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
  const [editGstin, setEditGstin] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjType, setAdjType] = useState<'debit_adjustment' | 'credit_adjustment'>('debit_adjustment');
  const [adjNotes, setAdjNotes] = useState('');

  async function loadData() {
    if (!business || !supplierId) return;
    try {
      const [s, l, p] = await Promise.all([
        getSupplierById(supplierId), getSupplierLedger(supplierId), getPurchasesBySupplier(business.id, supplierId),
      ]);
      if (s) { setSupplier(s); setEditName(s.name); setEditMobile(s.mobile || ''); setEditAddress(s.address || ''); setEditGstin(s.gstin || ''); setEditNotes(s.notes || ''); }
      setLedger(l); setPurchases(p);
    } catch (e) { console.error('Supplier detail error', e); } finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { loadData(); }, [business, supplierId]));

  async function handlePayment() {
    if (!business || !supplier) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) { Alert.alert('Invalid', 'Enter valid amount'); return; }
    if (amount > supplier.balance) { Alert.alert('Invalid', 'Cannot exceed due'); return; }
    try {
      await createPayment({
        id: generateId(), businessId: business.id, supplierId: supplier.id, amount, method: paymentMethod,
        notes: paymentNotes || undefined, createdAt: new Date().toISOString(),
      });
      setShowPaymentModal(false); setPaymentAmount(''); setPaymentNotes(''); loadData();
      Alert.alert('Success', `₹${amount.toFixed(2)} paid`);
    } catch (e) { Alert.alert('Error', 'Failed to record payment'); }
  }

  async function handleSaveEdit() {
    if (!supplier || !business) return;
    if (!editName.trim()) { Alert.alert('Required', 'Name required'); return; }
    try {
      await updateSupplier({
        ...supplier, name: editName.trim(), mobile: editMobile.trim() || undefined,
        address: editAddress.trim() || undefined, gstin: editGstin.trim() || undefined,
        notes: editNotes.trim() || undefined, updatedAt: new Date().toISOString(),
      });
      setShowEditModal(false); loadData();
    } catch (e) { Alert.alert('Error', 'Failed to update'); }
  }

  async function handleAdjustment() {
    if (!supplier || !business) return;
    const amount = parseFloat(adjAmount);
    if (!amount || amount <= 0) { Alert.alert('Invalid', 'Enter valid amount'); return; }
    try {
      const newBalance = adjType === 'debit_adjustment' ? supplier.balance + amount : supplier.balance - amount;
      await createSupplierLedger({
        id: generateId(), businessId: business.id, supplierId: supplier.id, supplierName: supplier.name,
        date: new Date().toISOString(), type: adjType,
        description: adjNotes || (adjType === 'debit_adjustment' ? 'Debit Adjustment' : 'Credit Adjustment'),
        referenceId: undefined, debit: adjType === 'debit_adjustment' ? amount : 0,
        credit: adjType === 'credit_adjustment' ? amount : 0, balance: newBalance, createdAt: new Date().toISOString(),
      });
      await recalculateSupplierBalance(supplier.id);
      setShowAdjustmentModal(false); setAdjAmount(''); setAdjNotes(''); loadData();
    } catch (e) { Alert.alert('Error', 'Failed'); }
  }

  if (loading) return <LoadingState />;
  if (!supplier) return <View style={COMMON_STYLES.center}><Text>Supplier not found</Text></View>;

  const outstanding = supplier.balance > 0 ? supplier.balance : 0;

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader title="Supplier Profile" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          <Ionicons name="business-outline" size={56} color={COLORS.secondary} />
          <Text style={styles.name}>{supplier.name}</Text>
          {supplier.mobile && <Text style={styles.mobile}>{supplier.mobile}</Text>}
          {supplier.gstin && <Text style={styles.gstin}>GSTIN: {supplier.gstin}</Text>}
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(outstanding)}</Text>
            <Text style={styles.statLabel}>Outstanding</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{purchases.length}</Text>
            <Text style={styles.statLabel}>Purchases</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Purchase', { supplierId: supplier.id })}>
            <Ionicons name="cart-outline" size={20} color={COLORS.primary} />
            <Text style={styles.actionText}>Purchase</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowPaymentModal(true)}>
            <Ionicons name="cash-outline" size={20} color={COLORS.success} />
            <Text style={styles.actionText}>Payment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowEditModal(true)}>
            <Ionicons name="create-outline" size={20} color={COLORS.secondary} />
            <Text style={styles.actionText}>Edit</Text>
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
            {supplier.openingBalance !== 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Opening Balance</Text>
                <Text style={styles.detailValue}>{formatCurrency(supplier.openingBalance)}</Text>
              </View>
            )}
            {supplier.address && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address</Text>
                <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>{supplier.address}</Text>
              </View>
            )}
            {supplier.notes && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>{supplier.notes}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.adjustBtn} onPress={() => setShowAdjustmentModal(true)}>
              <Text style={styles.adjustBtnText}>Adjust Balance</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'ledger' && (
          <View>
            {ledger.length === 0 ? <EmptyState icon="book-outline" title="No ledger entries" message="Transactions will appear here" /> : (
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
            {purchases.length === 0 ? <EmptyState icon="cart-outline" title="No purchases" message="Purchase from this supplier" /> : (
              purchases.map(p => (
                <TouchableOpacity key={p.id} style={styles.purchaseCard}>
                  <View style={styles.purchaseRow}>
                    <Text style={styles.purchaseInvoice}>{p.invoiceNumber}</Text>
                    <Text style={styles.purchaseAmount}>{formatCurrency(p.total)}</Text>
                  </View>
                  <Text style={styles.purchaseDate}>{formatDateTime(p.createdAt)}</Text>
                  {p.due > 0 && <Text style={styles.purchaseDue}>Due: {formatCurrency(p.due)}</Text>}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={showPaymentModal} transparent animationType="slide" onRequestClose={() => setShowPaymentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pay Supplier</Text>
            <Text style={styles.modalSubtitle}>{supplier.name}</Text>
            <Text style={styles.dueDisplay}>Due: {formatCurrency(supplier.balance)}</Text>
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
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPaymentModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handlePayment}><Text style={styles.confirmBtnText}>Pay</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Supplier</Text>
            <Text style={styles.label}>Name</Text><TextInput style={styles.input} value={editName} onChangeText={setEditName} />
            <Text style={styles.label}>Mobile</Text><TextInput style={styles.input} value={editMobile} onChangeText={setEditMobile} keyboardType="phone-pad" maxLength={10} />
            <Text style={styles.label}>Address</Text><TextInput style={[styles.input, styles.textArea]} value={editAddress} onChangeText={setEditAddress} multiline />
            <Text style={styles.label}>GSTIN</Text><TextInput style={styles.input} value={editGstin} onChangeText={setEditGstin} autoCapitalize="characters" />
            <Text style={styles.label}>Notes</Text><TextInput style={[styles.input, styles.textArea]} value={editNotes} onChangeText={setEditNotes} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveEdit}><Text style={styles.confirmBtnText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
            <Text style={styles.label}>Amount</Text><TextInput style={styles.input} value={adjAmount} onChangeText={setAdjAmount} keyboardType="decimal-pad" />
            <Text style={styles.label}>Reason</Text><TextInput style={[styles.input, styles.textArea]} value={adjNotes} onChangeText={setAdjNotes} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdjustmentModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleAdjustment}><Text style={styles.confirmBtnText}>Adjust</Text></TouchableOpacity>
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
  name: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.md },
  mobile: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: 2 },
  gstin: { fontSize: FONT_SIZE.sm, color: COLORS.textTertiary, marginTop: 2 },
  statsGrid: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  statCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, flex: 1, alignItems: 'center', ...SHADOW.sm },
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
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary },
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
