import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBusiness } from '../context/BusinessContext';
import { updateBusiness } from '../lib/database';
import { Business } from '../lib/types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import PrimaryButton from '../components/PrimaryButton';

interface BusinessSettingsScreenProps {
  navigation: any;
}

export default function BusinessSettingsScreen({ navigation }: BusinessSettingsScreenProps) {
  const { business, selectBusiness } = useBusiness();
  const [loading, setLoading] = useState(false);

  if (!business) return (
    <View style={COMMON_STYLES.center}><Text>No business selected</Text></View>
  );

  const [formName, setFormName] = useState(business.storeName);
  const [formOwner, setFormOwner] = useState(business.ownerName);
  const [formMobile, setFormMobile] = useState(business.mobileNumber);
  const [formAddress, setFormAddress] = useState(business.address || '');
  const [formGstin, setFormGstin] = useState(business.gstin || '');
  const [formTaxRate, setFormTaxRate] = useState(String(business.defaultTaxRate));
  const [formPrefix, setFormPrefix] = useState(business.invoicePrefix);
  const [formThankYou, setFormThankYou] = useState(business.thankYouMessage);

  async function handleSave() {
    if (!formName.trim() || !formOwner.trim() || !formMobile.trim()) {
      Alert.alert('Required', 'Store name, owner name, and mobile are required');
      return;
    }
    setLoading(true);
    try {
      const updated: Business = {
        ...business,
        storeName: formName.trim(),
        ownerName: formOwner.trim(),
        mobileNumber: formMobile.trim(),
        address: formAddress.trim() || undefined,
        gstin: formGstin.trim() || undefined,
        defaultTaxRate: parseFloat(formTaxRate) || 0,
        invoicePrefix: formPrefix.trim() || 'INV',
        thankYouMessage: formThankYou.trim() || 'Thank you for shopping with us!',
        updatedAt: new Date().toISOString(),
      };
      await updateBusiness(updated);
      await selectBusiness(updated.id);
      Alert.alert('Success', 'Business settings updated');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader title="Business Settings" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store Information</Text>
          <Text style={styles.label}>Store Name</Text>
          <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Store name" placeholderTextColor={COLORS.textTertiary} />

          <Text style={styles.label}>Owner Name</Text>
          <TextInput style={styles.input} value={formOwner} onChangeText={setFormOwner} placeholder="Owner name" placeholderTextColor={COLORS.textTertiary} />

          <Text style={styles.label}>Mobile Number</Text>
          <TextInput style={styles.input} value={formMobile} onChangeText={setFormMobile} keyboardType="phone-pad" maxLength={10} placeholder="10-digit number" placeholderTextColor={COLORS.textTertiary} />

          <Text style={styles.label}>Address</Text>
          <TextInput style={[styles.input, styles.textArea]} value={formAddress} onChangeText={setFormAddress} multiline numberOfLines={3} placeholder="Store address" placeholderTextColor={COLORS.textTertiary} />

          <Text style={styles.label}>GSTIN (optional)</Text>
          <TextInput style={styles.input} value={formGstin} onChangeText={setFormGstin} autoCapitalize="characters" placeholder="GSTIN Number" placeholderTextColor={COLORS.textTertiary} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Settings</Text>
          <Text style={styles.label}>Default Tax Rate (%)</Text>
          <TextInput style={styles.input} value={formTaxRate} onChangeText={setFormTaxRate} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.textTertiary} />

          <Text style={styles.label}>Invoice Prefix</Text>
          <TextInput style={styles.input} value={formPrefix} onChangeText={setFormPrefix} placeholder="e.g. INV" placeholderTextColor={COLORS.textTertiary} />

          <Text style={styles.label}>Thank You Message</Text>
          <TextInput style={styles.input} value={formThankYou} onChangeText={setFormThankYou} placeholder="Thank you message on invoice" placeholderTextColor={COLORS.textTertiary} />
        </View>

        <PrimaryButton title="Save Settings" onPress={handleSave} loading={loading} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl * 2,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.sm,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
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
    height: 80,
    textAlignVertical: 'top',
    paddingTop: SPACING.md,
  },
});
