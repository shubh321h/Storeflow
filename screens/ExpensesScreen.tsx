import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBusiness } from '../context/BusinessContext';
import { getExpenses, createExpense } from '../lib/database';
import { Expense } from '../lib/types';
import { generateId } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import PrimaryButton from '../components/PrimaryButton';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';

interface ExpensesScreenProps {
  navigation: any;
  route: any;
}

export default function ExpensesScreen({ navigation, route }: ExpensesScreenProps) {
  const { business } = useBusiness();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [description, setDescription] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const categories = ['Rent', 'Electricity', 'Staff Salary', 'Transport', 'Maintenance', 'Marketing', 'Packaging', 'Other'];

  async function loadData() {
    if (!business) return;
    try {
      const data = await getExpenses(business.id);
      setExpenses(data);
    } catch (e) {
      console.error('Expenses load error', e);
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
        setShowModal(true);
        navigation.setParams({ addNew: undefined });
      }
    }, [route.params])
  );

  async function handleSave() {
    if (!business) return;
    if (!title.trim() || !category || !amount.trim()) {
      Alert.alert('Required', 'Please enter a title, select a category and enter an amount');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Invalid', 'Please enter a valid amount');
      return;
    }

    try {
      await createExpense({
        id: generateId(),
        businessId: business.id,
        title: title.trim(),
        category,
        amount: numAmount,
        paymentMethod,
        description: description.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
      setShowModal(false);
      setTitle('');
      setCategory('');
      setAmount('');
      setPaymentMethod('cash');
      setDescription('');
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to add expense');
    }
  }

  if (loading) return <LoadingState />;

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader
        title="Expenses"
        rightAction={{ icon: 'add-outline', onPress: () => setShowModal(true) }}
      />

      {expenses.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title="No expenses yet"
          message="Track your store expenses to monitor profitability"
          actionLabel="Add Expense"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.expenseCard}>
              <View style={styles.expenseIcon}>
                <Ionicons name="wallet-outline" size={22} color={COLORS.error} />
              </View>
              <View style={styles.expenseDetails}>
                <Text style={styles.expenseCategory}>{item.title}</Text>
                <Text style={styles.expenseCategorySub}>{item.category} • {item.paymentMethod.toUpperCase()}</Text>
                {item.description && <Text style={styles.expenseDesc} numberOfLines={1}>{item.description}</Text>}
                <Text style={styles.expenseDate}>{new Date(item.createdAt).toLocaleDateString('en-IN')}</Text>
              </View>
              <Text style={styles.expenseAmount}>-₹{item.amount.toFixed(2)}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add Expense Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Expense</Text>

            <Text style={styles.label}>Title *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. July Rent" placeholderTextColor={COLORS.textTertiary} />

            <Text style={styles.label}>Category</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
              <Text style={category ? styles.inputText : styles.inputPlaceholder}>{category || 'Select category'}</Text>
            </TouchableOpacity>
            {showCategoryPicker && (
              <View style={styles.picker}>
                {categories.map(c => (
                  <TouchableOpacity key={c} style={styles.pickerItem} onPress={() => { setCategory(c); setShowCategoryPicker(false); }}>
                    <Text style={styles.pickerItemText}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Amount</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.textTertiary} />

            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.methodRow}>
              {(['cash', 'upi', 'card'] as const).map(m => (
                <TouchableOpacity key={m} style={[styles.methodBtn, paymentMethod === m && styles.methodBtnActive]} onPress={() => setPaymentMethod(m)}>
                  <Text style={[styles.methodBtnText, paymentMethod === m && styles.methodBtnTextActive]}>{m.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline numberOfLines={2} placeholder="Optional notes" placeholderTextColor={COLORS.textTertiary} />

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton title="Save Expense" onPress={handleSave} />
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
  expenseCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.sm,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseIcon: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseCategory: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  expenseCategorySub: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize' as const,
  },
  expenseDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  expenseDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.error,
    fontVariant: ['tabular-nums'],
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
    justifyContent: 'center',
  },
  inputText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  inputPlaceholder: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textTertiary,
  },
  textArea: {
    height: 64,
    textAlignVertical: 'top',
    paddingTop: SPACING.md,
  },
  picker: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 2,
    ...SHADOW.sm,
  },
  pickerItem: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  pickerItemText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  methodRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  methodBtn: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  methodBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  methodBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  methodBtnTextActive: {
    color: COLORS.primary,
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
