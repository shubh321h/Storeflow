import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Switch, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import {
  getBusinessSettings, updateBusinessSettings, createBackupRecord, getLastBackupRecord, importData, exportAllData,
  getBusinessById, updateBusiness, getBusinessesForUser, clearAllData, resetDatabase,
} from '../lib/database';
import { Business, BusinessSettings, BackupRecord } from '../lib/types';
import { generateId, formatDateTime } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import ConfirmationDialog from '../components/ConfirmationDialog';

export default function SettingsScreen({ navigation }: { navigation: any }) {
  const { user, logout } = useAuth();
  const { business, clearBusiness, loadBusinesses } = useBusiness();
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [backupRecord, setBackupRecord] = useState<BackupRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [backupData, setBackupData] = useState('');
  const [restoreData, setRestoreData] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [lastBackupStatus, setLastBackupStatus] = useState<string>('No backup yet');

  async function loadData() {
    if (!business) return;
    try {
      const [s, br] = await Promise.all([
        getBusinessSettings(business.id), getLastBackupRecord(business.id),
      ]);
      setSettings(s);
      setBackupRecord(br);
      if (br) {
        setLastBackupStatus(br.status === 'success' ? `Last backup: ${formatDateTime(br.createdAt)}` : 'Last backup failed');
      }
    } catch (e) { console.error('Settings load error', e); } finally { setLoading(false); }
  }

  useCallback(() => { loadData(); }, [business]);
  React.useEffect(() => { loadData(); }, [business]);

  async function handleBackup() {
    if (!business) return;
    setBackupLoading(true);
    try {
      const data = await exportAllData(business.id);
      const json = JSON.stringify(data);
      setBackupData(json);
      await createBackupRecord({
        id: generateId(), businessId: business.id, type: 'manual', dataSize: json.length,
        createdAt: new Date().toISOString(), status: 'success',
      });
      setBackupRecord({
        id: generateId(), businessId: business.id, type: 'manual', dataSize: json.length,
        createdAt: new Date().toISOString(), status: 'success',
      });
      setLastBackupStatus(`Last backup: ${formatDateTime(new Date().toISOString())}`);
      setShowBackupModal(true);
    } catch (e) {
      Alert.alert('Error', 'Backup failed');
      await createBackupRecord({
        id: generateId(), businessId: business.id, type: 'manual', dataSize: 0,
        createdAt: new Date().toISOString(), status: 'failed', errorMessage: String(e),
      });
    } finally { setBackupLoading(false); }
  }

  async function handleRestore() {
    if (!restoreData.trim()) { Alert.alert('Error', 'Paste backup data first'); return; }
    try {
      const data = JSON.parse(restoreData.trim());
      await importData(data);
      Alert.alert('Success', 'Data restored successfully. Please restart the app.');
      setShowRestoreModal(false);
      setRestoreData('');
    } catch (e) {
      Alert.alert('Error', 'Invalid backup data. Please check and try again.');
    }
  }

  async function updateSetting(key: keyof BusinessSettings, value: any) {
    if (!settings || !business) return;
    const updated = { ...settings, [key]: value, updatedAt: new Date().toISOString() };
    await updateBusinessSettings(updated);
    setSettings(updated);
  }

  async function handleLogout() {
    await clearBusiness();
    await logout();
  }

  async function handleReset() {
    try {
      await clearAllData();
      await clearBusiness();
      await logout();
      Alert.alert('Success', 'All data has been reset');
    } catch (e) { Alert.alert('Error', 'Failed to reset data'); }
  }

  if (loading) return <LoadingState />;

  const settingsSections = [
    { id: 'business', icon: 'business-outline', title: 'Business', subtitle: 'Store details, GSTIN, invoice settings' },
    { id: 'billing', icon: 'receipt-outline', title: 'Billing', subtitle: 'Tax defaults, payment methods' },
    { id: 'inventory', icon: 'cube-outline', title: 'Inventory', subtitle: 'Low stock thresholds, stock behavior' },
    { id: 'notifications', icon: 'notifications-outline', title: 'Notifications', subtitle: 'Alerts and reminders' },
    { id: 'backup', icon: 'cloud-download-outline', title: 'Backup & Restore', subtitle: 'Export, import, status' },
    { id: 'security', icon: 'shield-checkmark-outline', title: 'Security', subtitle: 'PIN, logout, sessions' },
  ];

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader title="Settings" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {settingsSections.map(section => (
          <TouchableOpacity key={section.id} style={styles.menuItem} onPress={() => setActiveSection(activeSection === section.id ? null : section.id)}>
            <View style={styles.menuIcon}><Ionicons name={section.icon as any} size={22} color={COLORS.primary} /></View>
            <View style={styles.menuText}><Text style={styles.menuTitle}>{section.title}</Text><Text style={styles.menuSubtitle}>{section.subtitle}</Text></View>
            <Ionicons name={activeSection === section.id ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ))}

        {activeSection === 'business' && business && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Store Name</Text>
            <TextInput style={styles.input} value={business.storeName} editable={false} />
            <Text style={styles.sectionLabel}>Owner</Text>
            <TextInput style={styles.input} value={business.ownerName} editable={false} />
            <Text style={styles.sectionLabel}>Mobile</Text>
            <TextInput style={styles.input} value={business.mobileNumber} editable={false} />
            <Text style={styles.sectionLabel}>GSTIN</Text>
            <TextInput style={styles.input} value={business.gstin || ''} editable={false} />
            <Text style={styles.sectionLabel}>Invoice Prefix</Text>
            <TextInput style={styles.input} value={business.invoicePrefix} editable={false} />
            <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('BusinessSettings')}>
              <Text style={styles.linkText}>Edit Business Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeSection === 'inventory' && settings && (
          <View style={styles.sectionCard}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Allow Negative Stock</Text>
              <Switch value={settings.allowNegativeStock} onValueChange={(v) => updateSetting('allowNegativeStock', v)} trackColor={{ false: COLORS.border, true: COLORS.primary }} thumbColor={settings.allowNegativeStock ? '#fff' : COLORS.textTertiary} />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Low Stock Alerts</Text>
              <Switch value={settings.lowStockAlertEnabled} onValueChange={(v) => updateSetting('lowStockAlertEnabled', v)} trackColor={{ false: COLORS.border, true: COLORS.primary }} thumbColor={settings.lowStockAlertEnabled ? '#fff' : COLORS.textTertiary} />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Payment Reminders</Text>
              <Switch value={settings.paymentReminderEnabled} onValueChange={(v) => updateSetting('paymentReminderEnabled', v)} trackColor={{ false: COLORS.border, true: COLORS.primary }} thumbColor={settings.paymentReminderEnabled ? '#fff' : COLORS.textTertiary} />
            </View>
          </View>
        )}

        {activeSection === 'backup' && (
          <View style={styles.sectionCard}>
            <Text style={styles.backupStatus}>{lastBackupStatus}</Text>
            <View style={styles.backupActions}>
              <TouchableOpacity style={styles.backupBtn} onPress={handleBackup}>
                <Ionicons name="cloud-download-outline" size={20} color={COLORS.primary} />
                <Text style={styles.backupBtnText}>Backup Data</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backupBtn} onPress={() => setShowRestoreModal(true)}>
                <Ionicons name="cloud-upload-outline" size={20} color={COLORS.secondary} />
                <Text style={styles.backupBtnText}>Restore</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeSection === 'security' && (
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.securityBtn} onPress={() => setShowLogoutConfirm(true)}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
              <Text style={styles.securityBtnText}>Logout</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.securityBtn} onPress={() => setShowResetConfirm(true)}>
              <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              <Text style={styles.securityBtnText}>Reset All Data</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.aboutSection}>
          <Text style={styles.aboutTitle}>About</Text>
          <Text style={styles.aboutItem}>StoreFlow v2.0</Text>
          <Text style={styles.aboutItem}>Secure Shop Management</Text>
          <Text style={styles.aboutItem}>Privacy Policy</Text>
          <Text style={styles.aboutItem}>Terms of Service</Text>
          <Text style={styles.aboutItem}>Help & Support</Text>
        </View>
      </ScrollView>

      <ConfirmationDialog visible={showLogoutConfirm} title="Logout?" message="You will be signed out." confirmText="Logout" onConfirm={handleLogout} onCancel={() => setShowLogoutConfirm(false)} danger />
      <ConfirmationDialog visible={showResetConfirm} title="Reset All Data?" message="This permanently deletes ALL data. Cannot be undone." confirmText="Reset Everything" onConfirm={handleReset} onCancel={() => setShowResetConfirm(false)} danger />

      <Modal visible={showBackupModal} animationType="slide" onRequestClose={() => setShowBackupModal(false)}>
        <View style={COMMON_STYLES.screen}>
          <AppHeader title="Backup Data" onBack={() => setShowBackupModal(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalLabel}>Copy and save this data securely:</Text>
            <View style={styles.backupTextBox}>
              <Text style={styles.backupText} numberOfLines={15} selectable>{backupData}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowBackupModal(false)}>
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showRestoreModal} animationType="slide" onRequestClose={() => setShowRestoreModal(false)}>
        <View style={COMMON_STYLES.screen}>
          <AppHeader title="Restore Data" onBack={() => setShowRestoreModal(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalLabel}>Paste your backup data below:</Text>
            <TextInput style={styles.restoreInput} multiline numberOfLines={8} value={restoreData} onChangeText={setRestoreData} placeholder="Paste JSON backup data here..." placeholderTextColor={COLORS.textTertiary} />
            <PrimaryButton title="Restore" onPress={handleRestore} />
            <Text style={styles.warningText}>Warning: This will overwrite existing data. Make sure you have a current backup.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xxxl * 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, ...SHADOW.sm, marginBottom: SPACING.md },
  menuIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  menuText: { flex: 1 },
  menuTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  menuSubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  sectionCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOW.sm, marginBottom: SPACING.md, marginTop: -8 },
  sectionLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary, marginTop: SPACING.md, marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.surfaceVariant, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.lg, height: 44, fontSize: FONT_SIZE.md, color: COLORS.textPrimary },
  linkBtn: { marginTop: SPACING.lg, alignItems: 'center' },
  linkText: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  toggleLabel: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary },
  backupStatus: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.lg },
  backupActions: { flexDirection: 'row', gap: SPACING.lg, justifyContent: 'center' },
  backupBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  backupBtnText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary },
  securityBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.error, marginBottom: SPACING.md },
  securityBtnText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.error },
  aboutSection: { marginTop: SPACING.lg },
  aboutTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  aboutItem: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  modalContent: { padding: SPACING.lg, flex: 1 },
  modalLabel: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  backupTextBox: { backgroundColor: COLORS.surfaceVariant, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, flex: 1 },
  backupText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontFamily: 'monospace' },
  closeBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.lg },
  closeBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
  restoreInput: { backgroundColor: COLORS.surfaceVariant, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, minHeight: 200, textAlignVertical: 'top' },
  warningText: { fontSize: FONT_SIZE.sm, color: COLORS.error, textAlign: 'center', marginTop: SPACING.lg },
});
