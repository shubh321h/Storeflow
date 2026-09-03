import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBusiness } from '../context/BusinessContext';
import { getSuppliers, createSupplier, deleteSupplier } from '../lib/database';
import { Supplier } from '../lib/types';
import { generateId, formatCurrency } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import PrimaryButton from '../components/PrimaryButton';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';

interface SuppliersScreenProps {
  navigation: any;
}

export default function SuppliersScreen({ navigation }: SuppliersScreenProps) {
  const { business } = useBusiness();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formOpeningBalance, setFormOpeningBalance] = useState('');
  const [formNotes, setFormNotes] = useState('');

  async function loadData() {
    if (!business) return;
    try {
      const data = await getSuppliers(business.id);
      setSuppliers(data);
    } catch (e) {
      console.error('Suppliers load error', e);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [business])
  );

  async function handleSave() {
    if (!business) return;
    if (!formName.trim()) {
      Alert.alert('Required', 'Supplier name is required');
      return;
    }
    try {
      await createSupplier({
        id: generateId(),
        businessId: business.id,
        name: formName.trim(),
        mobile: formMobile.trim() || undefined,
        address: formAddress.trim() || undefined,
        gstin: formGstin.trim() || undefined,
        openingBalance: parseFloat(formOpeningBalance) || 0,
        balance: parseFloat(formOpeningBalance) || 0,
        notes: formNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setShowModal(false);
      setFormName('');
      setFormMobile('');
      setFormAddress('');
      setFormGstin('');
      setFormOpeningBalance('');
      setFormNotes('');
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to add supplier');
    }
  }

  async function handleDelete(supplier: Supplier) {
    Alert.alert('Delete Supplier', `Are you sure you want to delete ${supplier.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteSupplier(supplier.id);
            loadData();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete supplier');
          }
        }
      },
    ]);
  }

  if (loading) return <LoadingState />;

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader title="Suppliers" onBack={() => navigation.goBack()} rightAction={{ icon: 'add-outline', onPress: () => setShowModal(true) }} />

      {suppliers.length === 0 ? (
        <EmptyState
          icon="business-outline"
          title="No suppliers yet"
          message="Add suppliers to track your product sources"
          actionLabel="Add Supplier"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <FlatList
          data={suppliers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.supplierCard} onPress={() => navigation.navigate('SupplierDetail', { supplierId: item.id })}>
              <View style={styles.supplierIcon}>
                <Ionicons name="business-outline" size={22} color={COLORS.secondary} />
              </View>
              <View style={styles.supplierDetails}>
                <Text style={styles.supplierName}>{item.name}</Text>
                {item.mobile && <Text style={styles.supplierMobile}>{item.mobile}</Text>}
                {item.balance > 0 && <Text style={styles.supplierDue}>Due: {formatCurrency(item.balance)}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Supplier</Text>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Supplier name" placeholderTextColor={COLORS.textTertiary} />
            <Text style={styles.label}>Mobile</Text>
            <TextInput style={styles.input} value={formMobile} onChangeText={setFormMobile} keyboardType="phone-pad" maxLength={10} placeholder="10-digit number" placeholderTextColor={COLORS.textTertiary} />
            <Text style={styles.label}>Address</Text>
            <TextInput style={[styles.input, styles.textArea]} value={formAddress} onChangeText={setFormAddress} multiline numberOfLines={2} placeholder="Supplier address" placeholderTextColor={COLORS.textTertiary} />
            <Text style={styles.label}>GSTIN</Text>
            <TextInput style={styles.input} value={formGstin} onChangeText={setFormGstin} autoCapitalize="characters" placeholder="GSTIN number" placeholderTextColor={COLORS.textTertiary} />
            <Text style={styles.label}>Opening Balance</Text>
            <TextInput style={styles.input} value={formOpeningBalance} onChangeText={setFormOpeningBalance} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.textTertiary} />
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.textArea]} value={formNotes} onChangeText={setFormNotes} multiline numberOfLines={2} placeholder="Optional notes" placeholderTextColor={COLORS.textTertiary} />
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton title="Save Supplier" onPress={handleSave} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl * 2,
  },
  supplierCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.sm,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  supplierIcon: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  supplierDetails: {
    flex: 1,
  },
  supplierName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  supplierMobile: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  supplierDue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    fontWeight: '600',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    height: 48,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  textArea: {
    height: 64,
    textAlignVertical: 'top',
    paddingTop: SPACING.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  cancelBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
