import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, TextInput, Alert,
  ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useBusiness } from '../context/BusinessContext';
import { getCustomers } from '../lib/database';
import {
  getUploadedBills, createUploadedBill, markUploadedBillPaid, getUploadedBillUrl,
} from '../lib/uploadedBills';
import { UploadedBill, Customer } from '../lib/types';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';

interface Props { navigation: any }

type Picked = { uri: string; mimeType: string };

export default function UploadedBillsScreen({ navigation }: Props) {
  const { business } = useBusiness();
  const [bills, setBills] = useState<UploadedBill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [billType, setBillType] = useState<'handwritten' | 'digital'>('handwritten');
  const [status, setStatus] = useState<'paid' | 'credit'>('paid');
  const [amount, setAmount] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  async function load() {
    if (!business) return;
    try {
      const [b, c] = await Promise.all([getUploadedBills(business.id), getCustomers(business.id)]);
      setBills(b);
      setCustomers(c);
    } catch (e) {
      console.error('Uploaded bills load error', e);
    } finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { load(); }, [business]));

  function resetForm() {
    setPicked(null); setBillType('handwritten'); setStatus('paid'); setAmount(''); setCustomerId(undefined);
  }

  function handleResult(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setPicked({ uri: a.uri, mimeType: a.mimeType || 'image/jpeg' });
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Camera permission is required to take a photo.'); return; }
    handleResult(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 }));
  }

  async function pickPhoto() {
    handleResult(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 }));
  }

  async function handleSave() {
    if (!business || saving) return;
    const value = Number(amount);
    if (!picked) { Alert.alert('Missing photo', 'Add a photo of the bill.'); return; }
    if (!Number.isFinite(value) || value <= 0) { Alert.alert('Invalid amount', 'Enter an amount greater than 0.'); return; }
    if (status === 'credit' && !customerId) { Alert.alert('Customer required', 'Select a customer for a credit bill.'); return; }
    setSaving(true);
    try {
      await createUploadedBill({
        businessId: business.id, customerId, billType,
        amount: value, paymentStatus: status,
        media: { uri: picked.uri, mimeType: picked.mimeType },
      });
      setShowForm(false); resetForm(); await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to upload bill');
    } finally { setSaving(false); }
  }

  function handleMarkPaid(bill: UploadedBill) {
    Alert.alert('Mark as paid?', `${formatCurrency(bill.amount)} will be settled and the bill will be deleted 7 days from now.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Paid', onPress: async () => {
        if (!business) return;
        try { await markUploadedBillPaid(business.id, bill.id); await load(); }
        catch (e: any) { Alert.alert('Error', e?.message || 'Failed to mark paid'); }
      } },
    ]);
  }

  async function openImage(bill: UploadedBill) {
    setViewLoading(true); setViewUrl('');
    try { setViewUrl(await getUploadedBillUrl(bill.mediaPath)); }
    catch { setViewUrl(null); Alert.alert('Error', 'Could not load the bill image'); }
    finally { setViewLoading(false); }
  }

  function renderBill({ item }: { item: UploadedBill }) {
    const credit = item.paymentStatus === 'credit';
    return (
      <View style={styles.card}>
        <View style={styles.rowTop}>
          <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
          <View style={[styles.badge, { backgroundColor: credit ? COLORS.warningLight : COLORS.successLight }]}>
            <Text style={[styles.badgeText, { color: credit ? '#854D0E' : COLORS.success }]}>{credit ? 'Credit' : 'Paid'}</Text>
          </View>
        </View>
        <Text style={styles.meta}>{item.customerName || 'No customer'} · {item.billType === 'handwritten' ? 'Handwritten' : 'Digital'}</Text>
        <Text style={styles.meta}>Uploaded {formatDateTime(item.uploadedAt)}</Text>
        {item.deleteAfter && <Text style={styles.metaWarn}>Auto-deletes {formatDateTime(item.deleteAfter)}</Text>}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openImage(item)}>
            <Ionicons name="image-outline" size={18} color={COLORS.primary} /><Text style={styles.actionText}>View</Text>
          </TouchableOpacity>
          {credit && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleMarkPaid(item)}>
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.primary} /><Text style={styles.actionText}>Mark Paid</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (loading) return <LoadingState />;

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader title="Uploaded Bills" onBack={() => navigation.goBack()} />
      <FlatList
        data={bills}
        keyExtractor={b => b.id}
        renderItem={renderBill}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon="image-outline" title="No uploaded bills" message="Tap + to upload a bill photo" />}
      />
      <TouchableOpacity style={styles.fab} onPress={() => { resetForm(); setShowForm(true); }}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={COMMON_STYLES.screen}>
          <AppHeader title="Upload Bill" onBack={() => setShowForm(false)} />
          <ScrollView contentContainerStyle={styles.form}>
            {picked ? <Image source={{ uri: picked.uri }} style={styles.preview} resizeMode="contain" /> : null}
            <View style={styles.row}>
              <TouchableOpacity style={styles.pickBtn} onPress={takePhoto}><Ionicons name="camera-outline" size={20} color={COLORS.primary} /><Text style={styles.actionText}>Camera</Text></TouchableOpacity>
              <TouchableOpacity style={styles.pickBtn} onPress={pickPhoto}><Ionicons name="images-outline" size={20} color={COLORS.primary} /><Text style={styles.actionText}>Gallery</Text></TouchableOpacity>
            </View>

            <Text style={styles.label}>Bill type</Text>
            <View style={styles.row}>
              {(['handwritten', 'digital'] as const).map(t => (
                <TouchableOpacity key={t} style={[styles.chip, billType === t && styles.chipOn]} onPress={() => setBillType(t)}>
                  <Text style={[styles.chipText, billType === t && styles.chipTextOn]}>{t === 'handwritten' ? 'Handwritten' : 'Digital'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Amount</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />

            <Text style={styles.label}>Status</Text>
            <View style={styles.row}>
              {(['paid', 'credit'] as const).map(t => (
                <TouchableOpacity key={t} style={[styles.chip, status === t && styles.chipOn]} onPress={() => setStatus(t)}>
                  <Text style={[styles.chipText, status === t && styles.chipTextOn]}>{t === 'paid' ? 'Paid' : 'Credit'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Customer{status === 'credit' ? ' (required)' : ' (optional)'}</Text>
            <View style={styles.custList}>
              {customers.map(c => (
                <TouchableOpacity key={c.id} style={[styles.custItem, customerId === c.id && styles.chipOn]} onPress={() => setCustomerId(customerId === c.id ? undefined : c.id)}>
                  <Text style={[styles.chipText, customerId === c.id && styles.chipTextOn]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Upload Bill</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={viewUrl !== null} animationType="fade" onRequestClose={() => setViewUrl(null)}>
        <View style={styles.viewer}>
          {viewLoading || !viewUrl ? <ActivityIndicator size="large" color="#fff" /> : <Image source={{ uri: viewUrl }} style={styles.viewerImg} resizeMode="contain" />}
          <TouchableOpacity style={styles.close} onPress={() => setViewUrl(null)}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: SPACING.lg, paddingBottom: 100, flexGrow: 1 },
  card: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOW.sm },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary },
  badge: { paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.md },
  badgeText: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  meta: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4 },
  metaWarn: { fontSize: FONT_SIZE.sm, color: COLORS.error, marginTop: 4 },
  actions: { flexDirection: 'row', marginTop: SPACING.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: SPACING.lg },
  actionText: { color: COLORS.primary, fontWeight: '600', marginLeft: 4 },
  fab: { position: 'absolute', right: SPACING.xl, bottom: SPACING.xl, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', ...SHADOW.sm },
  form: { padding: SPACING.lg, paddingBottom: SPACING.xxl * 2 },
  preview: { width: '100%', height: 220, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.surfaceVariant, marginBottom: SPACING.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.md },
  pickBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginRight: SPACING.md },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.sm },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: FONT_SIZE.md, marginBottom: SPACING.md },
  chip: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginRight: SPACING.sm },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textPrimary, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  custList: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.lg },
  custItem: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginRight: SPACING.sm, marginBottom: SPACING.sm },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
  viewer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  viewerImg: { width: '100%', height: '100%' },
  close: { position: 'absolute', top: 48, right: 20 },
});
