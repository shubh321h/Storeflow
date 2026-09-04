import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { createBusiness } from '../lib/database';
import { Business } from '../lib/types';
import { generateId, validateMobile } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';

interface BusinessSetupScreenProps {
  onComplete: () => void;
}

export default function BusinessSetupScreen({ onComplete }: BusinessSetupScreenProps) {
  const { user } = useAuth();
  const { selectBusiness } = useBusiness();
  const [ownerName, setOwnerName] = useState(user?.name || '');
  const [storeName, setStoreName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [businessType, setBusinessType] = useState('General Store');
  const [currency, setCurrency] = useState('₹');
  const [taxRate, setTaxRate] = useState('0');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const businessTypes = ['General Store', 'Kirana Store', 'Grocery Store', 'Medical Store', 'Mobile Shop', 'Electronics', 'Clothing', 'Hardware', 'Stationery', 'Other'];
  const currencies = ['₹', '$', '€', '£'];

  async function handleCreate() {
    setError('');
    if (!ownerName.trim() || !storeName.trim() || !mobile.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    if (!validateMobile(mobile)) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!user) {
      setError('Please log in again');
      return;
    }

    setLoading(true);
    try {
      const businessId = generateId();
      const business: Business = {
        id: businessId,
        ownerName: ownerName.trim(),
        storeName: storeName.trim(),
        mobileNumber: mobile.trim(),
        address: address.trim() || undefined,
        gstin: gstin.trim() || undefined,
        businessType,
        currency,
        defaultTaxRate: parseFloat(taxRate) || 0,
        invoicePrefix: 'INV',
        invoiceNextNumber: 1,
        thankYouMessage: 'Thank you for shopping with us!',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await createBusiness(business);
      await selectBusiness(businessId);
      onComplete();
    } catch (e) {
      setError('Failed to create business. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={COMMON_STYLES.screen}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Ionicons name="business-outline" size={40} color={COLORS.primary} />
          <Text style={styles.title}>Set Up Your Business</Text>
          <Text style={styles.subtitle}>Let's get your store ready in minutes</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.form}>
          <Text style={styles.sectionLabel}>Business Owner *</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Owner Name"
              value={ownerName}
              onChangeText={setOwnerName}
              placeholderTextColor={COLORS.textTertiary}
            />
          </View>

          <Text style={styles.sectionLabel}>Store Name *</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Store / Business Name"
              value={storeName}
              onChangeText={setStoreName}
              placeholderTextColor={COLORS.textTertiary}
            />
          </View>

          <Text style={styles.sectionLabel}>Mobile Number *</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="10-digit mobile number"
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
              maxLength={10}
              placeholderTextColor={COLORS.textTertiary}
            />
          </View>

          <Text style={styles.sectionLabel}>Address</Text>
          <View style={[styles.inputContainer, styles.textArea]}>
            <TextInput
              style={[styles.input, styles.textAreaInput]}
              placeholder="Store Address"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              placeholderTextColor={COLORS.textTertiary}
            />
          </View>

          <Text style={styles.sectionLabel}>GSTIN (optional)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="GSTIN Number"
              value={gstin}
              onChangeText={setGstin}
              autoCapitalize="characters"
              placeholderTextColor={COLORS.textTertiary}
            />
          </View>

          <Text style={styles.sectionLabel}>Business Type</Text>
          <TouchableOpacity
            style={styles.inputContainer}
            onPress={() => setShowTypePicker(!showTypePicker)}
          >
            <Text style={styles.input}>{businessType}</Text>
            <Ionicons name={showTypePicker ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          {showTypePicker && (
            <View style={styles.pickerContainer}>
              {businessTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.pickerItem,
                    businessType === type && styles.pickerItemSelected,
                  ]}
                  onPress={() => { setBusinessType(type); setShowTypePicker(false); }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    businessType === type && styles.pickerItemTextSelected,
                  ]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.sectionLabel}>Default Tax Rate (%)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="e.g. 5, 12, 18, 28"
              value={taxRate}
              onChangeText={setTaxRate}
              keyboardType="decimal-pad"
              placeholderTextColor={COLORS.textTertiary}
            />
          </View>

          <Text style={styles.sectionLabel}>Currency</Text>
          <View style={styles.currencyRow}>
            {currencies.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.currencyButton,
                  currency === c && styles.currencyButtonSelected,
                ]}
                onPress={() => setCurrency(c)}
              >
                <Text style={[
                  styles.currencyText,
                  currency === c && styles.currencyTextSelected,
                ]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.createButton, loading && styles.disabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>Create Business</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl * 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  form: {
    gap: SPACING.md,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  inputContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    height: 50,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  textArea: {
    height: 80,
    alignItems: 'flex-start',
    paddingTop: SPACING.md,
  },
  textAreaInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    ...SHADOW.sm,
  },
  pickerItem: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  pickerItemSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  pickerItemText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  pickerItemTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  currencyRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  currencyButton: {
    width: 56,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  currencyButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  currencyText: {
    fontSize: FONT_SIZE.xl,
    color: COLORS.textSecondary,
  },
  currencyTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  createButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  disabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
});
