import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBusiness } from '../context/BusinessContext';
import {
  getSalesReport, getProductReport, getCustomerReport, getExpenseReport, getBalanceSummary,
  getSalesByDateRange, getExpensesByDateRange, getDashboardStats,
} from '../lib/database';
import { SalesReport, ProductReport, CustomerReport, ExpenseReport } from '../lib/types';
import { formatCurrency, getStartOfDay, getEndOfDay, getStartOfWeek, getStartOfMonth, getYesterdayStart, getYesterdayEnd, getStartOfYear } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';

export default function ReportsScreen({ navigation }: { navigation: any }) {
  const { business } = useBusiness();
  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'customers' | 'expenses' | 'balance'>('sales');
  const [loading, setLoading] = useState(true);
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [productReports, setProductReports] = useState<ProductReport[]>([]);
  const [customerReports, setCustomerReports] = useState<CustomerReport[]>([]);
  const [expenseReport, setExpenseReport] = useState<ExpenseReport | null>(null);
  const [balanceSummary, setBalanceSummary] = useState<any>(null);
  const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'year'>('today');
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  function getPeriodRange(p: string): { start: string; end: string; label: string } {
    const now = new Date().toISOString();
    switch (p) {
      case 'today': return { start: getStartOfDay(), end: now, label: 'Today' };
      case 'yesterday': return { start: getYesterdayStart(), end: getYesterdayEnd(), label: 'Yesterday' };
      case 'week': return { start: getStartOfWeek(), end: now, label: 'This Week' };
      case 'month': return { start: getStartOfMonth(), end: now, label: 'This Month' };
      case 'year': return { start: getStartOfYear(), end: now, label: 'This Year' };
      default: return { start: getStartOfDay(), end: now, label: 'Today' };
    }
  }

  async function loadData() {
    if (!business) return;
    try {
      const { start, end } = getPeriodRange(period);
      const [sr, pr, cr, er, bs, ds] = await Promise.all([
        getSalesReport(business.id, start, end), getProductReport(business.id, 50),
        getCustomerReport(business.id), getExpenseReport(business.id, start, end),
        getBalanceSummary(business.id), getDashboardStats(business.id),
      ]);
      setSalesReport(sr); setProductReports(pr); setCustomerReports(cr); setExpenseReport(er); setBalanceSummary(bs); setDashboardStats(ds);
    } catch (e) { console.error('Reports load error', e); } finally { setLoading(false); }
  }

  useCallback(() => { loadData(); }, [business, period]);

  React.useEffect(() => { loadData(); }, [business, period]);

  const periodOptions = [
    { label: 'Today', value: 'today' }, { label: 'Yesterday', value: 'yesterday' },
    { label: 'Week', value: 'week' }, { label: 'Month', value: 'month' }, { label: 'Year', value: 'year' },
  ];

  if (loading) return <LoadingState />;

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader title="Reports" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.periodRow}>
          {periodOptions.map(o => (
            <TouchableOpacity key={o.value} style={[styles.periodChip, period === o.value && styles.periodChipActive]} onPress={() => setPeriod(o.value as any)}>
              <Text style={[styles.periodChipText, period === o.value && styles.periodChipTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tabRow}>
          {(['sales', 'products', 'customers', 'expenses', 'balance'] as const).map(tab => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'sales' ? 'Sales' : tab === 'products' ? 'Products' : tab === 'customers' ? 'Customers' : tab === 'expenses' ? 'Expenses' : 'Balance'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'sales' && salesReport && (
          <View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Sales Summary</Text>
              <View style={styles.statRow}><Text style={styles.statLabel}>Total Sales</Text><Text style={styles.statValue}>{formatCurrency(salesReport.totalSales)}</Text></View>
              <View style={styles.statRow}><Text style={styles.statLabel}>Total Bills</Text><Text style={styles.statValue}>{salesReport.totalBills}</Text></View>
              <View style={styles.statRow}><Text style={styles.statLabel}>Items Sold</Text><Text style={styles.statValue}>{salesReport.totalItems}</Text></View>
              <View style={styles.statRow}><Text style={styles.statLabel}>Average Bill</Text><Text style={styles.statValue}>{formatCurrency(salesReport.averageBill)}</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.statRow}><Text style={styles.statLabel}>Cash</Text><Text style={styles.statValue}>{formatCurrency(salesReport.cashSales)}</Text></View>
              <View style={styles.statRow}><Text style={styles.statLabel}>UPI</Text><Text style={styles.statValue}>{formatCurrency(salesReport.upiSales)}</Text></View>
              <View style={styles.statRow}><Text style={styles.statLabel}>Credit</Text><Text style={styles.statValue}>{formatCurrency(salesReport.creditSales)}</Text></View>
              <View style={styles.statRow}><Text style={styles.statLabel}>Card</Text><Text style={styles.statValue}>{formatCurrency(salesReport.cardSales)}</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.statRow}><Text style={styles.statLabel}>Discount</Text><Text style={styles.statValue}>{formatCurrency(salesReport.discountTotal)}</Text></View>
              <View style={styles.statRow}><Text style={styles.statLabel}>Tax</Text><Text style={styles.statValue}>{formatCurrency(salesReport.taxTotal)}</Text></View>
            </View>
          </View>
        )}

        {activeTab === 'products' && (
          <View>
            {productReports.length === 0 ? <EmptyState icon="cube-outline" title="No product data" message="Sales data will appear here" /> : (
              <>
                <Text style={styles.sectionTitle}>Best Sellers</Text>
                {productReports.filter(p => p.status === 'best_seller').slice(0, 5).map(p => (
                  <View key={p.productId} style={styles.productCard}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>{p.productName}</Text>
                      <Text style={styles.productMeta}>Sold: {p.totalSold} | Stock: {p.currentStock}</Text>
                    </View>
                    <Text style={styles.productRevenue}>{formatCurrency(p.totalRevenue)}</Text>
                  </View>
                ))}
                <Text style={styles.sectionTitle}>Slow Moving</Text>
                {productReports.filter(p => p.status === 'slow_moving').slice(0, 5).map(p => (
                  <View key={p.productId} style={styles.productCard}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>{p.productName}</Text>
                      <Text style={styles.productMeta}>Sold: {p.totalSold} | Stock: {p.currentStock}</Text>
                    </View>
                    <Text style={styles.productRevenue}>{formatCurrency(p.totalRevenue)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {activeTab === 'customers' && (
          <View>
            {customerReports.length === 0 ? <EmptyState icon="people-outline" title="No customers" message="Customer data will appear here" /> : (
              <>
                <Text style={styles.sectionTitle}>Top Customers</Text>
                {customerReports.sort((a, b) => b.totalPurchases - a.totalPurchases).slice(0, 10).map(c => (
                  <View key={c.customerId} style={styles.customerCard}>
                    <View style={styles.customerInfo}>
                      <Text style={styles.customerName} numberOfLines={1}>{c.customerName}</Text>
                      <Text style={styles.customerMeta}>{c.purchaseCount} purchases | Paid: {formatCurrency(c.totalPaid)}</Text>
                    </View>
                    <View style={styles.customerAmounts}>
                      <Text style={styles.customerPurchase}>{formatCurrency(c.totalPurchases)}</Text>
                      {c.outstanding > 0 && <Text style={styles.customerDue}>Due: {formatCurrency(c.outstanding)}</Text>}
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {activeTab === 'expenses' && expenseReport && (
          <View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Expense Summary</Text>
              <View style={styles.statRow}><Text style={styles.statLabel}>Total Expenses</Text><Text style={styles.statValue}>{formatCurrency(expenseReport.totalExpenses)}</Text></View>
              <View style={styles.statDivider} />
              {expenseReport.categoryBreakdown.map((cat, i) => (
                <View key={i} style={styles.statRow}>
                  <Text style={styles.statLabel}>{cat.category}</Text>
                  <View style={styles.statRight}>
                    <Text style={styles.statValue}>{formatCurrency(cat.amount)}</Text>
                    <Text style={styles.statPercentage}>{cat.percentage}%</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'balance' && balanceSummary && (
          <View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Balance Sheet</Text>
              <View style={styles.statRow}><Text style={styles.statLabel}>Cash in Hand</Text><Text style={[styles.statValue, { color: balanceSummary.cashInHand >= 0 ? COLORS.success : COLORS.error }]}>{formatCurrency(balanceSummary.cashInHand)}</Text></View>
              <View style={styles.statRow}><Text style={styles.statLabel}>UPI Balance</Text><Text style={styles.statValue}>{formatCurrency(balanceSummary.upiBalance)}</Text></View>
              <View style={styles.statRow}><Text style={styles.statLabel}>Bank (Card)</Text><Text style={styles.statValue}>{formatCurrency(balanceSummary.bankBalance)}</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.statRow}><Text style={styles.statLabel}>Total Receivables</Text><Text style={[styles.statValue, { color: COLORS.warning }]}>{formatCurrency(balanceSummary.totalReceivables)}</Text></View>
              <View style={styles.statRow}><Text style={styles.statLabel}>Total Payables</Text><Text style={[styles.statValue, { color: COLORS.error }]}>{formatCurrency(balanceSummary.totalPayables)}</Text></View>
              <View style={styles.statRow}><Text style={styles.statLabel}>Stock Value</Text><Text style={styles.statValue}>{formatCurrency(balanceSummary.totalStockValue)}</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.statRow}><Text style={[styles.statLabel, { fontWeight: '700' }]}>Net Position</Text><Text style={[styles.statValue, { fontWeight: '700', color: balanceSummary.netPosition >= 0 ? COLORS.success : COLORS.error }]}>{formatCurrency(balanceSummary.netPosition)}</Text></View>
            </View>
            {dashboardStats && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Estimated Gross Profit</Text>
                <Text style={styles.profitValue}>{formatCurrency(dashboardStats.estimatedProfit)}</Text>
                <Text style={styles.profitNote}>Based on selling price minus purchase cost. This is an estimate and does not include all costs.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xxxl * 2 },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  periodChip: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  periodChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodChipText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary },
  periodChipTextActive: { color: '#fff' },
  tabRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: 4, marginBottom: SPACING.lg, ...SHADOW.sm },
  tab: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: BORDER_RADIUS.sm },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },
  summaryCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm, marginBottom: SPACING.lg },
  summaryTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, alignItems: 'center' },
  statLabel: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  statValue: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  statRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statPercentage: { fontSize: FONT_SIZE.sm, color: COLORS.textTertiary, fontWeight: '600' },
  statDivider: { height: 1, backgroundColor: COLORS.divider, marginVertical: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md, marginTop: SPACING.lg },
  productCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm, marginBottom: SPACING.md, flexDirection: 'row', alignItems: 'center' },
  productInfo: { flex: 1 },
  productName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  productMeta: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  productRevenue: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primary, fontVariant: ['tabular-nums'] },
  customerCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm, marginBottom: SPACING.md, flexDirection: 'row', alignItems: 'center' },
  customerInfo: { flex: 1 },
  customerName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  customerMeta: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  customerAmounts: { alignItems: 'flex-end' },
  customerPurchase: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary },
  customerDue: { fontSize: FONT_SIZE.sm, color: COLORS.error, marginTop: 2 },
  profitValue: { fontSize: FONT_SIZE.xxxl, fontWeight: '800', color: COLORS.primary, textAlign: 'center', marginVertical: SPACING.lg, fontVariant: ['tabular-nums'] },
  profitNote: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center', fontStyle: 'italic', lineHeight: 20 },
});
