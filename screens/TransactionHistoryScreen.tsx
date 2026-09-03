import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBusiness } from '../context/BusinessContext';
import { getUnifiedTransactions } from '../lib/database';
import { UnifiedTransaction } from '../lib/types';
import { formatCurrency, formatDateTime, TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import SearchBar from '../components/SearchBar';

interface TransactionHistoryScreenProps {
  navigation: any;
  route: any;
}

export default function TransactionHistoryScreen({ navigation, route }: TransactionHistoryScreenProps) {
  const { business } = useBusiness();
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [filtered, setFiltered] = useState<UnifiedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<UnifiedTransaction | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  async function loadData() {
    if (!business) return;
    try {
      const data = await getUnifiedTransactions(business.id, 200);
      setTransactions(data);
      setFiltered(data);
    } catch (e) { console.error('Transaction history error', e); } finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { loadData(); }, [business]));

  function handleSearch(text: string) {
    setSearchQuery(text);
    let results = transactions;
    if (text.trim()) {
      const q = text.toLowerCase();
      results = results.filter(t => t.description.toLowerCase().includes(q) || t.entityName?.toLowerCase().includes(q));
    }
    if (activeFilter) {
      results = results.filter(t => t.type === activeFilter);
    }
    setFiltered(results);
  }

  function filterByType(type: string | null) {
    setActiveFilter(type);
    let results = transactions;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(t => t.description.toLowerCase().includes(q) || t.entityName?.toLowerCase().includes(q));
    }
    if (type) results = results.filter(t => t.type === type);
    setFiltered(results);
  }

  function getTypeIcon(type: string): string {
    const map: Record<string, string> = { sale: 'receipt', purchase: 'cart', customer_payment: 'cash', supplier_payment: 'card', expense: 'wallet', sales_return: 'return-down-back', purchase_return: 'return-up-back', stock_adjustment: 'swap-vertical', other_income: 'add-circle', other_expense: 'remove-circle' };
    return map[type] || 'document';
  }

  const filters = [
    { label: 'All', value: null }, { label: 'Sales', value: 'sale' }, { label: 'Purchases', value: 'purchase' },
    { label: 'Payments', value: 'customer_payment' }, { label: 'Expenses', value: 'expense' },
  ];

  if (loading) return <LoadingState />;

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader title="Transaction History" onBack={() => navigation.goBack()} />
      <View style={styles.searchContainer}>
        <SearchBar value={searchQuery} onChangeText={handleSearch} placeholder="Search transactions..." onClear={() => { setSearchQuery(''); filterByType(activeFilter); }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filters.map(f => (
          <TouchableOpacity key={f.label} style={[styles.filterChip, activeFilter === f.value && styles.filterChipActive]} onPress={() => filterByType(f.value)}>
            <Text style={[styles.filterChipText, activeFilter === f.value && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {filtered.length === 0 ? (
        <EmptyState icon="time-outline" title="No transactions" message="Your transactions will appear here" />
      ) : (
        <FlatList data={filtered} keyExtractor={item => item.id + item.type} renderItem={({ item }) => (
          <TouchableOpacity style={styles.transactionCard} onPress={() => { setSelectedTransaction(item); setShowDetail(true); }}>
            <View style={[styles.typeIcon, { backgroundColor: `${TRANSACTION_TYPE_COLORS[item.type]}15` }]}>
              <Ionicons name={getTypeIcon(item.type) as any} size={20} color={TRANSACTION_TYPE_COLORS[item.type]} />
            </View>
            <View style={styles.transactionDetails}>
              <Text style={styles.transactionDesc} numberOfLines={1}>{TRANSACTION_TYPE_LABELS[item.type] || item.type}</Text>
              <Text style={styles.transactionEntity} numberOfLines={1}>{item.description}</Text>
              <Text style={styles.transactionDate}>{formatDateTime(item.date)}</Text>
            </View>
            <View style={styles.transactionAmount}>
              <Text style={[styles.amountText, { color: item.debit > 0 ? COLORS.error : COLORS.success }]}>
                {item.debit > 0 ? '-' : '+'}{formatCurrency(Math.abs(item.debit > 0 ? item.debit : item.credit))}
              </Text>
            </View>
          </TouchableOpacity>
        )} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} />
      )}

      <Modal visible={showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.detailIcon, { backgroundColor: `${TRANSACTION_TYPE_COLORS[selectedTransaction?.type || 'sale']}15` }]}>
                <Ionicons name={getTypeIcon(selectedTransaction?.type || 'sale') as any} size={28} color={TRANSACTION_TYPE_COLORS[selectedTransaction?.type || 'sale']} />
              </View>
              <Text style={styles.modalTitle}>{TRANSACTION_TYPE_LABELS[selectedTransaction?.type || 'sale']}</Text>
            </View>
            <Text style={styles.detailDesc}>{selectedTransaction?.description}</Text>
            {selectedTransaction?.entityName && <Text style={styles.detailEntity}>{selectedTransaction.entityName}</Text>}
            <Text style={styles.detailDate}>{selectedTransaction && formatDateTime(selectedTransaction.date)}</Text>
            <View style={styles.detailDivider} />
            <View style={styles.detailAmountRow}>
              <Text style={styles.detailAmountLabel}>Amount</Text>
              <Text style={styles.detailAmount}>
              {selectedTransaction && (selectedTransaction.debit > 0 ? '-' : '+')}
{selectedTransaction &&
  formatCurrency(
    Math.abs(
      selectedTransaction.debit > 0
        ? selectedTransaction.debit
        : selectedTransaction.credit || 0
    )
  )}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDetail(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: { padding: SPACING.lg, paddingBottom: 0 },
  filterRow: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.sm },
  filterChip: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary },
  filterChipTextActive: { color: '#fff' },
  listContent: { padding: SPACING.lg, paddingBottom: SPACING.xxxl * 2 },
  transactionCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm, marginBottom: SPACING.md, flexDirection: 'row', alignItems: 'center' },
  typeIcon: { width: 44, height: 44, borderRadius: BORDER_RADIUS.md, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  transactionDetails: { flex: 1 },
  transactionDesc: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  transactionEntity: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  transactionDate: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary, marginTop: 2 },
  transactionAmount: { alignItems: 'flex-end', marginLeft: SPACING.sm },
  amountText: { fontSize: FONT_SIZE.md, fontWeight: '700', fontVariant: ['tabular-nums'] },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: SPACING.xxxl },
  modalHeader: { alignItems: 'center', marginBottom: SPACING.lg },
  detailIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '700', color: COLORS.textPrimary },
  detailDesc: { fontSize: FONT_SIZE.lg, color: COLORS.textPrimary, textAlign: 'center', fontWeight: '600' },
  detailEntity: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.xs },
  detailDate: { fontSize: FONT_SIZE.sm, color: COLORS.textTertiary, textAlign: 'center', marginTop: SPACING.xs },
  detailDivider: { height: 1, backgroundColor: COLORS.divider, marginVertical: SPACING.lg },
  detailAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailAmountLabel: { fontSize: FONT_SIZE.lg, color: COLORS.textSecondary },
  detailAmount: { fontSize: FONT_SIZE.xxxl, fontWeight: '700', color: COLORS.primary, fontVariant: ['tabular-nums'] },
  closeBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.xl },
  closeBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
});
