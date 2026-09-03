import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBusiness } from '../context/BusinessContext';
import { getCustomers, createCustomer, updateCustomer, searchCustomers } from '../lib/database';
import { Customer } from '../lib/types';
import { generateId, validateMobile } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import SearchBar from '../components/SearchBar';
import CustomerCard from '../components/CustomerCard';
import PrimaryButton from '../components/PrimaryButton';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ConfirmationDialog from '../components/ConfirmationDialog';

interface CustomersScreenProps {
  navigation: any;
  route: any;
}

export default function CustomersScreen({ navigation, route }: CustomersScreenProps) {
  const { business } = useBusiness();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [formName, setFormName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formOpeningBalance, setFormOpeningBalance] = useState('');
  const [formCreditLimit, setFormCreditLimit] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function loadData() {
    if (!business) return;
    try {
      const data = await getCustomers(business.id);
      setCustomers(data);
    } catch (e) {
      console.error('Customers load error', e);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [business])
  );

  useFocusEffect(
    useCallback(() => {
      if (route.params?.addNew) {
        openModal();
        navigation.setParams({ addNew: undefined });
      }
    }, [route.params])
  );

  async function handleSearch(text: string) {
    setSearchQuery(text);
    if (!business || !text.trim()) {
      loadData();
      return;
    }
    const results = await searchCustomers(business.id, text.trim());
    setCustomers(results);
  }

  function openModal(customer?: Customer) {
    if (customer) {
      setEditingCustomer(customer);
      setFormName(customer.name);
      setFormMobile(customer.mobile || '');
      setFormAddress(customer.address || '');
      setFormCreditLimit(customer.creditLimit ? String(customer.creditLimit) : '');
      setFormNotes(customer.notes || '');
      setFormOpeningBalance('');
    } else {
      setEditingCustomer(null);
      resetForm();
    }
    setShowModal(true);
  }

  function resetForm() {
    setFormName('');
    setFormMobile('');
    setFormAddress('');
    setFormOpeningBalance('');
    setFormCreditLimit('');
    setFormNotes('');
  }

  async function handleSave() {
    if (!business) return;
    if (!formName.trim()) {
      Alert.alert('Required', 'Customer name is required');
      return;
    }
    if (formMobile && !validateMobile(formMobile)) {
      Alert.alert('Invalid', 'Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      if (editingCustomer) {
        await updateCustomer({
          ...editingCustomer,
          name: formName.trim(),
          mobile: formMobile.trim() || undefined,
          address: formAddress.trim() || undefined,
          creditLimit: formCreditLimit ? parseFloat(formCreditLimit) : undefined,
          notes: formNotes.trim() || undefined,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const openingBal = parseFloat(formOpeningBalance) || 0;
        await createCustomer({
          id: generateId(),
          businessId: business.id,
          name: formName.trim(),
          mobile: formMobile.trim() || undefined,
          address: formAddress.trim() || undefined,
          openingBalance: openingBal,
          balance: openingBal,
          creditLimit: formCreditLimit ? parseFloat(formCreditLimit) : undefined,
          notes: formNotes.trim() || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to save customer');
    }
  }

  function clearSearch() {
    setSearchQuery('');
    loadData();
  }

  if (loading) return <LoadingState />;

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader
        title="Customers"
        rightAction={{ icon: 'add-outline', onPress: () => openModal() }}
      />

      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="Search customers..."
          onClear={clearSearch}
        />
      </View>

      {customers.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No customers yet"
          message="Add your first customer to track credit and receivables"
          actionLabel="Add Customer"
          onAction={() => openModal()}
        />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CustomerCard
              customer={item}
              onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Customer Modal */}
      <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalContainer}>
          <AppHeader
            title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
            onBack={() => setShowModal(false)}
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Customer Name *</Text>
              <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Full name" placeholderTextColor={COLORS.textTertiary} />

              <Text style={styles.label}>Mobile Number</Text>
              <TextInput style={styles.input} value={formMobile} onChangeText={setFormMobile} keyboardType="phone-pad" maxLength={10} placeholder="10-digit number" placeholderTextColor={COLORS.textTertiary} />

              <Text style={styles.label}>Address</Text>
              <TextInput style={[styles.input, styles.textArea]} value={formAddress} onChangeText={setFormAddress} multiline numberOfLines={3} placeholder="Customer address" placeholderTextColor={COLORS.textTertiary} />

              {!editingCustomer && (
                <>
                  <Text style={styles.label}>Opening Balance (optional)</Text>
                  <TextInput style={styles.input} value={formOpeningBalance} onChangeText={setFormOpeningBalance} keyboardType="decimal-pad" placeholder="0.00 (due if positive)" placeholderTextColor={COLORS.textTertiary} />
                </>
              )}

              <Text style={styles.label}>Credit Limit (optional)</Text>
              <TextInput style={styles.input} value={formCreditLimit} onChangeText={setFormCreditLimit} keyboardType="decimal-pad" placeholder="Max credit amount" placeholderTextColor={COLORS.textTertiary} />

              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput style={[styles.input, styles.textArea]} value={formNotes} onChangeText={setFormNotes} multiline numberOfLines={3} placeholder="Any notes about this customer" placeholderTextColor={COLORS.textTertiary} />

              {editingCustomer && (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Current Balance</Text>
                  <Text style={[
                    styles.infoValue,
                    { color: editingCustomer.balance > 0 ? COLORS.error : COLORS.success }
                  ]}>
                    {editingCustomer.balance > 0 ? '₹' + editingCustomer.balance.toFixed(2) + ' Due' : 'No outstanding dues'}
                  </Text>
                </View>
              )}

              <PrimaryButton title={editingCustomer ? 'Update Customer' : 'Save Customer'} onPress={handleSave} />

              {editingCustomer && (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => setShowDeleteConfirm(true)}>
                  <Text style={styles.deleteBtnText}>Delete Customer</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ConfirmationDialog
        visible={showDeleteConfirm}
        title="Delete Customer?"
        message="This action cannot be undone. Historical transactions will still be linked."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={async () => {
          if (editingCustomer) {
            try {
              await updateCustomer({ ...editingCustomer, name: editingCustomer.name + ' (Deleted)', updatedAt: new Date().toISOString() });
              setShowDeleteConfirm(false);
              setShowModal(false);
              loadData();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete customer');
            }
          }
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        danger
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    padding: SPACING.lg,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl * 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalScroll: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl * 2,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    height: 48,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: SPACING.md,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginVertical: SPACING.lg,
    ...SHADOW.sm,
  },
  infoLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  infoValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
  },
  deleteBtn: {
    marginTop: SPACING.lg,
    alignItems: 'center',
    padding: SPACING.md,
  },
  deleteBtnText: {
    color: COLORS.error,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
});
