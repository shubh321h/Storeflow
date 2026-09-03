import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { getLastBackupRecord, clearAllData, exportAllData, createBackupRecord } from '../lib/database';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import { generateId, formatDateTime } from '../lib/utils';
import AppHeader from '../components/AppHeader';
import ConfirmationDialog from '../components/ConfirmationDialog';

interface MoreScreenProps {
  navigation: any;
}

export default function MoreScreen({ navigation }: MoreScreenProps) {
  const { user, logout } = useAuth();
  const { business, clearBusiness } = useBusiness();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [backupData, setBackupData] = useState('');
  const [loading, setLoading] = useState(false);

  const menuItems = [
    { icon: 'receipt-outline', title: 'Sales History', subtitle: 'View all past sales', onPress: () => navigation.navigate('SalesHistory') },
    { icon: 'cart-outline', title: 'Purchases', subtitle: 'Manage purchases from suppliers', onPress: () => navigation.navigate('Purchase') },
    { icon: 'wallet-outline', title: 'Expenses', subtitle: 'Track store expenses', onPress: () => navigation.navigate('Expenses') },
    { icon: 'people-outline', title: 'Suppliers', subtitle: 'Manage suppliers', onPress: () => navigation.navigate('Suppliers') },
    { icon: 'time-outline', title: 'Transaction History', subtitle: 'All transactions in one place', onPress: () => navigation.navigate('TransactionHistory') },
    { icon: 'bar-chart-outline', title: 'Reports & Analytics', subtitle: 'Sales, products, customers, expenses', onPress: () => navigation.navigate('Reports') },
    { icon: 'cloud-download-outline', title: 'Backup & Restore', subtitle: 'Export and import your data', onPress: () => handleBackup() },
    { icon: 'settings-outline', title: 'Business Settings', subtitle: 'Edit store details', onPress: () => navigation.navigate('BusinessSettings') },
    { icon: 'cog-outline', title: 'App Settings', subtitle: 'Notifications, security, about', onPress: () => navigation.navigate('Settings') },
  ];

  async function handleBackup() {
    if (!business) return;
    setLoading(true);
    try {
      const data = await exportAllData(business.id);
      setBackupData(JSON.stringify(data, null, 2));
      await createBackupRecord({
        id: generateId(), businessId: business.id, type: 'manual', dataSize: JSON.stringify(data).length,
        createdAt: new Date().toISOString(), status: 'success',
      });
      setShowBackupModal(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to export data');
    } finally { setLoading(false); }
  }

  async function handleReset() {
    try { await clearAllData(); await clearBusiness(); await logout(); Alert.alert('Success', 'All data has been reset'); } catch (e) { Alert.alert('Error', 'Failed to reset data'); }
  }

  async function handleLogout() { await clearBusiness(); await logout(); }

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader title="More" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {business && (
          <View style={styles.businessCard}>
            <Ionicons name="storefront-outline" size={32} color={COLORS.primary} />
            <View style={styles.businessInfo}>
              <Text style={styles.businessName} numberOfLines={1}>{business.storeName}</Text>
              <Text style={styles.businessOwner}>{business.ownerName}</Text>
              <Text style={styles.businessType}>{business.businessType}</Text>
            </View>
          </View>
        )}

        <View style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon as any} size={22} color={COLORS.primary} />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowLogoutConfirm(true)}>
            <View style={[styles.menuIcon, { backgroundColor: COLORS.errorLight }]}>
              <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuTitle, { color: COLORS.error }]}>Logout</Text>
              <Text style={styles.menuSubtitle}>Sign out of your account</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>StoreFlow v2.0</Text>
      </ScrollView>

      <ConfirmationDialog visible={showLogoutConfirm} title="Logout?" message="You will be signed out." confirmText="Logout" onConfirm={handleLogout} onCancel={() => setShowLogoutConfirm(false)} danger />

      <Modal visible={showBackupModal} animationType="slide" onRequestClose={() => setShowBackupModal(false)}>
        <View style={COMMON_STYLES.screen}>
          <AppHeader title="Backup Data" onBack={() => setShowBackupModal(false)} />
          <View style={styles.backupContent}>
            {loading ? <ActivityIndicator size="large" color={COLORS.primary} /> : (
              <>
                <Text style={styles.backupInfo}>Copy and save this data securely:</Text>
                <View style={styles.backupTextContainer}>
                  <Text style={styles.backupText} numberOfLines={10} selectable>{backupData}</Text>
                </View>
                <TouchableOpacity style={styles.copyBtn} onPress={() => setShowBackupModal(false)}>
                  <Text style={styles.copyBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <ConfirmationDialog visible={showResetModal} title="Reset All Data?" message="This will permanently delete all data. Cannot be undone." confirmText="Reset Everything" onConfirm={handleReset} onCancel={() => setShowResetModal(false)} danger />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xxxl * 2 },
  businessCard: { backgroundColor: COLORS.primaryLight, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  businessInfo: { marginLeft: SPACING.md, flex: 1 },
  businessName: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.primaryDark },
  businessOwner: { fontSize: FONT_SIZE.md, color: COLORS.primaryDark, opacity: 0.8, marginTop: 2 },
  businessType: { fontSize: FONT_SIZE.sm, color: COLORS.primaryDark, opacity: 0.6, marginTop: 2 },
  menuCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, ...SHADOW.sm, marginBottom: SPACING.lg },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  menuIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  menuText: { flex: 1 },
  menuTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  menuSubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  version: { fontSize: FONT_SIZE.sm, color: COLORS.textTertiary, textAlign: 'center', marginTop: SPACING.xl },
  backupContent: { padding: SPACING.lg, flex: 1 },
  backupInfo: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  backupTextContainer: { backgroundColor: COLORS.surfaceVariant, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, flex: 1 },
  backupText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontFamily: 'monospace' },
  copyBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.lg },
  copyBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
});
