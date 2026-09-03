import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../lib/theme';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { Business, Sale, SaleItem } from '../lib/types';

interface InvoicePreviewProps {
  business: Business;
  sale: Sale;
  items: SaleItem[];
}

export default function InvoicePreview({ business, sale, items }: InvoicePreviewProps) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.storeName}>{business.storeName}</Text>
        <Text style={styles.address}>{business.address}</Text>
        <Text style={styles.contact}>Mob: {business.mobileNumber}</Text>
        {business.gstin && <Text style={styles.gstin}>GSTIN: {business.gstin}</Text>}
      </View>

      <View style={styles.divider} />

      <View style={styles.invoiceInfo}>
        <View style={styles.row}>
          <Text style={styles.label}>Invoice No:</Text>
          <Text style={styles.value}>{sale.invoiceNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date:</Text>
          <Text style={styles.value}>{formatDateTime(sale.createdAt)}</Text>
        </View>
        {sale.customerName && (
          <View style={styles.row}>
            <Text style={styles.label}>Customer:</Text>
            <Text style={styles.value}>{sale.customerName}</Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.itemsHeader}>
        <Text style={[styles.headerCell, { flex: 2 }]}>Item</Text>
        <Text style={[styles.headerCell, { flex: 0.8, textAlign: 'center' }]}>Qty</Text>
        <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>Price</Text>
        <Text style={[styles.headerCell, { flex: 1.2, textAlign: 'right' }]}>Amount</Text>
      </View>

      {items.map((item) => (
        <View key={item.id} style={styles.itemRow}>
          <Text style={[styles.itemCell, { flex: 2 }]} numberOfLines={1}>{item.productName}</Text>
          <Text style={[styles.itemCell, { flex: 0.8, textAlign: 'center' }]}>{item.quantity}</Text>
          <Text style={[styles.itemCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(item.price)}</Text>
          <Text style={[styles.itemCell, { flex: 1.2, textAlign: 'right' }]}>{formatCurrency(item.total)}</Text>
        </View>
      ))}

      <View style={styles.divider} />

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatCurrency(sale.subtotal)}</Text>
        </View>
        {sale.discount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount</Text>
            <Text style={[styles.totalValue, { color: COLORS.success }]}>-{formatCurrency(sale.discount)}</Text>
          </View>
        )}
        {sale.taxAmount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>{formatCurrency(sale.taxAmount)}</Text>
          </View>
        )}
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.grandTotalLabel}>Grand Total</Text>
          <Text style={styles.grandTotalValue}>{formatCurrency(sale.total)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Paid ({sale.paymentMethod.toUpperCase()})</Text>
          <Text style={styles.totalValue}>{formatCurrency(sale.paid)}</Text>
        </View>
        {sale.due > 0 && (
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: COLORS.error }]}>Due</Text>
            <Text style={[styles.totalValue, { color: COLORS.error }]}>{formatCurrency(sale.due)}</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.thankYou}>{business.thankYouMessage}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
  },
  storeName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  address: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  contact: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  gstin: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  invoiceInfo: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  itemsHeader: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerCell: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  itemCell: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
  },
  totals: {
    gap: 4,
  },
  totalRow: {
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
  grandTotal: {
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.sm,
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
  footer: {
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  thankYou: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
});
