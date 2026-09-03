import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useBusiness } from '../context/BusinessContext';
import { getInvoiceHtml } from '../lib/database';
import { Sale, SaleItem } from '../lib/types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';

interface InvoiceShareScreenProps {
  navigation: any;
  route: any;
}

export default function InvoiceShareScreen({ navigation, route }: InvoiceShareScreenProps) {
  const { business } = useBusiness();
  const { sale } = route.params;
  const [loading, setLoading] = useState(false);

  async function generatePdf() {
    if (!business || !sale) return null;
    try {
      const html = await getInvoiceHtml(sale.id);
      if (!html) return null;
      const { uri } = await Print.printToFileAsync({ html });
      return uri;
    } catch (e) {
      console.error('PDF generation error', e);
      return null;
    }
  }

  async function handleShare() {
    setLoading(true);
    try {
      const uri = await generatePdf();
      if (uri) {
        await Sharing.shareAsync(uri, {
          dialogTitle: `Invoice ${sale.invoiceNumber}`,
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Error', 'Could not generate PDF');
      }
    } catch (e) {
      console.error('Share error', e);
      Alert.alert('Error', 'Could not share invoice');
    } finally {
      setLoading(false);
    }
  }

  async function handlePrint() {
    setLoading(true);
    try {
      const html = await getInvoiceHtml(sale.id);
      if (html) {
        await Print.printAsync({ html });
      } else {
        Alert.alert('Error', 'Could not load invoice');
      }
    } catch (e) {
      console.error('Print error', e);
    } finally {
      setLoading(false);
    }
  }

  if (!sale) return (
    <View style={COMMON_STYLES.center}><Text>No sale data</Text></View>
  );

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader title="Share Invoice" onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="receipt-outline" size={64} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Invoice {sale.invoiceNumber}</Text>
        <Text style={styles.amount}>₹{sale.total.toFixed(2)}</Text>
        <Text style={styles.customer}>{sale.customerName || 'Walk-in Customer'}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <>
                <Ionicons name="share-social-outline" size={28} color={COLORS.primary} />
                <Text style={styles.actionLabel}>Share</Text>
                <Text style={styles.actionSub}>WhatsApp / PDF / Email</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handlePrint} disabled={loading}>
            <Ionicons name="print-outline" size={28} color={COLORS.secondary} />
            <Text style={[styles.actionLabel, { color: COLORS.secondary }]}>Print</Text>
            <Text style={styles.actionSub}>Connect to printer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  amount: {
    fontSize: FONT_SIZE.display,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: SPACING.sm,
    fontVariant: ['tabular-nums'],
  },
  customer: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.xxl,
  },
  actionBtn: {
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    minWidth: 140,
  },
  actionLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  actionSub: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
});
