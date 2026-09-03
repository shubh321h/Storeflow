import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBusiness } from '../context/BusinessContext';
import {
  getDashboardStats, getRecentTransactions, getLowStockProducts, getOutOfStockProducts,
} from '../lib/database';
import { DashboardStats, RecentTransaction, Product } from '../lib/types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import { formatCurrency } from '../lib/utils';
import StatCard from '../components/StatCard';
import TransactionRow from '../components/TransactionRow';
import LoadingState from '../components/LoadingState';

const { width } = Dimensions.get('window');

interface HomeScreenProps {
  navigation: any;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { business } = useBusiness();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [outOfStock, setOutOfStock] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    if (!business) return;
    try {
      const [s, t, ls, os] = await Promise.all([
        getDashboardStats(business.id), getRecentTransactions(business.id),
        getLowStockProducts(business.id), getOutOfStockProducts(business.id),
      ]);
      setStats(s); setTransactions(t); setLowStock(ls); setOutOfStock(os);
    } catch (e) { console.error('Home load error', e); } finally { setLoading(false); setRefreshing(false); }
  }

  useFocusEffect(useCallback(() => { loadData(); }, [business]));
  function onRefresh() { setRefreshing(true); loadData(); }

  if (loading) return <LoadingState />;
  if (!business) return <View style={COMMON_STYLES.center}><Text>No business selected</Text></View>;

  const quickActions = [
    { icon: 'receipt-outline', label: 'New Bill', color: '#1B6B4B', screen: 'Billing', params: { newBill: true } },
    { icon: 'cube-outline', label: 'Add Product', color: '#2563EB', screen: 'Products', params: { addNew: true } },
    { icon: 'scan-outline', label: 'Scan', color: '#7C3AED', screen: 'BarcodeScanner', params: {} },
    { icon: 'person-add-outline', label: 'Add Customer', color: '#EA580C', screen: 'Customers', params: { addNew: true } },
    { icon: 'cash-outline', label: 'Add Expense', color: '#DC2626', screen: 'Expenses', params: { addNew: true } },
    { icon: 'card-outline', label: 'Collect', color: '#0891B2', screen: 'CollectPayment', params: {} },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.welcomeBanner}>
        <View>
          <Text style={styles.welcomeText}>Hello, {business.ownerName}</Text>
          <Text style={styles.storeName}>{business.storeName}</Text>
          <Text style={styles.dateText}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <View style={styles.welcomeIcon}>
          <Ionicons name="storefront-outline" size={32} color={COLORS.primary} />
        </View>
      </View>

      {stats && (
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard icon="trending-up-outline" iconColor={COLORS.primary} iconBgColor={COLORS.primaryLight} title="Today's Sales" value={formatCurrency(stats.todaySales, business.currency)} subtitle={`${stats.todayBills} bills`} />
            <StatCard icon="cash-outline" iconColor={COLORS.success} iconBgColor={COLORS.successLight} title="Cash Position" value={formatCurrency(stats.todayCash, business.currency)} subtitle="Net after expenses" />
          </View>
          <View style={styles.statsRow}>
            <StatCard icon="time-outline" iconColor={COLORS.warning} iconBgColor={COLORS.warningLight} title="Total Receivables" value={formatCurrency(stats.totalReceivables, business.currency)} subtitle="Credit/Udhaar" />
            <StatCard icon="alert-circle-outline" iconColor={COLORS.error} iconBgColor={COLORS.errorLight} title="Stock Alert" value={`${stats.lowStockCount + stats.outOfStockCount}`} subtitle={`${stats.outOfStockCount} out of stock`} />
          </View>
          <View style={styles.statsRow}>
            <StatCard icon="cart-outline" iconColor={COLORS.secondary} iconBgColor={COLORS.secondaryLight} title="Est. Profit" value={formatCurrency(stats.estimatedProfit, business.currency)} subtitle="Gross (est)" />
            <StatCard icon="wallet-outline" iconColor={COLORS.error} iconBgColor={COLORS.errorLight} title="Expenses" value={formatCurrency(stats.todayExpenses, business.currency)} subtitle="Today" />
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        {quickActions.map((action, index) => (
          <TouchableOpacity key={index} style={styles.quickActionButton} onPress={() => navigation.navigate(action.screen, action.params)}>
            <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}15` }]}>
              <Ionicons name={action.icon as any} size={24} color={action.color} />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {transactions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <View style={styles.transactionsCard}>
            {transactions.map((t) => <TransactionRow key={t.id} transaction={t} />)}
          </View>
        </>
      )}

      {(lowStock.length > 0 || outOfStock.length > 0) && (
        <>
          <Text style={styles.sectionTitle}>Stock Alerts</Text>
          <View style={styles.alertsCard}>
            {outOfStock.slice(0, 3).map((p) => (
              <View key={p.id} style={styles.alertRow}>
                <Ionicons name="close-circle" size={18} color={COLORS.error} />
                <Text style={styles.alertText} numberOfLines={1}>{p.name} - <Text style={styles.alertOut}>Out of stock</Text></Text>
              </View>
            ))}
            {lowStock.slice(0, 3).map((p) => (
              <View key={p.id} style={styles.alertRow}>
                <Ionicons name="warning" size={18} color={COLORS.warning} />
                <Text style={styles.alertText} numberOfLines={1}>{p.name} - <Text style={styles.alertLow}>Only {p.currentStock} {p.unit} left</Text></Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xxxl * 2 },
  welcomeBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg },
  welcomeText: { fontSize: FONT_SIZE.sm, color: COLORS.primaryDark, fontWeight: '600' },
  storeName: { fontSize: FONT_SIZE.xxl, fontWeight: '700', color: COLORS.primaryDark, marginTop: 2 },
  dateText: { fontSize: FONT_SIZE.sm, color: COLORS.primaryDark, opacity: 0.7, marginTop: 2 },
  welcomeIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', ...SHADOW.sm },
  statsGrid: { gap: SPACING.md, marginBottom: SPACING.lg },
  statsRow: { flexDirection: 'row', gap: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md, marginTop: SPACING.md },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
  quickActionButton: { width: (width - SPACING.lg * 2 - SPACING.md * 2) / 3, alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, ...SHADOW.sm },
  quickActionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  quickActionLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, fontWeight: '600', textAlign: 'center' },
  transactionsCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm },
  alertsCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  alertText: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, flex: 1 },
  alertOut: { color: COLORS.error, fontWeight: '700' },
  alertLow: { color: COLORS.warning, fontWeight: '700' },
});
