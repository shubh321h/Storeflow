import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useBusiness } from '../context/BusinessContext';
import { getProductByBarcode } from '../lib/database';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../lib/theme';

interface BarcodeScannerScreenProps {
  navigation: any;
  route: any;
}

export default function BarcodeScannerScreen({ navigation, route }: BarcodeScannerScreenProps) {
  const { business } = useBusiness();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [processing, setProcessing] = useState(false);
  const fromScreen = route.params?.fromScreen || 'Products';
  const mode = route.params?.mode || 'search';

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);

    if (!business) {
      Alert.alert('Error', 'No business selected');
      setProcessing(false);
      return;
    }

    try {
      const product = await getProductByBarcode(business.id, data);
      if (product) {
        if (fromScreen === 'Billing') {
          navigation.goBack();
          navigation.navigate('Billing', { scannedProduct: product });
        } else {
          navigation.goBack();
          navigation.navigate('Products', { barcode: data, scannedProduct: product });
        }
      } else {
        if (mode === 'add') {
          navigation.goBack();
          navigation.navigate('Products', { barcode: data });
        } else {
          Alert.alert(
            'Product Not Found',
            `No product found with barcode ${data}. Would you like to add it?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) },
              {
                text: 'Add Product', onPress: () => {
                  navigation.goBack();
                  navigation.navigate('Products', { barcode: data });
                }
              },
            ]
          );
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to search for product');
      setScanned(false);
    } finally {
      setProcessing(false);
    }
  }

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-off-outline" size={64} color={COLORS.textTertiary} />
        <Text style={styles.permissionText}>Camera permission is required to scan barcodes.</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.permissionBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        enableTorch={torchOn}
      >
        <View style={styles.overlay}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerText}>Scan Barcode</Text>
            <TouchableOpacity style={styles.backBtn} onPress={() => setTorchOn(!torchOn)}>
              <Ionicons name={torchOn ? 'flash' : 'flash-off'} size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.scanArea}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>

          <View style={styles.footer}>
            {scanned ? (
              <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
                <Text style={styles.rescanText}>Tap to Scan Again</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.hintText}>Point camera at barcode</Text>
            )}
          </View>
        </View>
      </CameraView>

      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.processingText}>Searching product...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    color: '#fff',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 260,
    height: 200,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#fff',
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  footer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  rescanBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  rescanText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  hintText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    opacity: 0.8,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    marginTop: SPACING.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  permissionText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  permissionBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  permissionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
  },
});
