
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useBusiness } from '../context/BusinessContext';
import { getProductByBarcode } from '../lib/database';
import { lookupBarcodeMetadata } from '../lib/barcodeMetadata';
import { normalizeBarcode } from '../lib/utils';
import {
  getFoodProductByBarcode,
  FoodProductMetadata,
} from '../lib/openFoodFacts';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  BORDER_RADIUS,
} from '../lib/theme';

interface BarcodeScannerScreenProps {
  navigation: any;
  route: any;
}

export default function BarcodeScannerScreen({
  navigation,
  route,
}: BarcodeScannerScreenProps) {
  const { business } = useBusiness();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fromScreen = route.params?.fromScreen || 'Products';
  const mode = route.params?.mode || 'search';

  useEffect(() => {
    let mounted = true;

    const requestPermission = async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();

        if (mounted) {
          setHasPermission(status === 'granted');
        }
      } catch (error) {
        console.error('Camera permission error:', error);

        if (mounted) {
          setHasPermission(false);
        }
      }
    };

    requestPermission();

    return () => {
      mounted = false;
    };
  }, []);

async function handleBarcodeScanned({ data }: { data: string }) {
  if (scanned || processing) return;

  setScanned(true);
  setProcessing(true);

  const barcode = normalizeBarcode(String(data));

  if (!business) {
    Alert.alert('Error', 'No business selected');
    setProcessing(false);
    setScanned(false);
    return;
  }

  try {
    console.log('BARCODE SCANNED:', barcode);

    // =====================================================
    // 1. EXISTING STOREFLOW DATABASE LOOKUP
    // =====================================================
    const product = await getProductByBarcode(
      business.id,
      barcode
    );

    console.log(
      'STOREFLOW PRODUCT RESULT:',
      product
    );

    if (product) {
      console.log(
        'PRODUCT FOUND IN STOREFLOW:',
        barcode
      );

      if (fromScreen === 'Billing') {
        navigation.navigate('MainTabs', {
          screen: 'Billing',
          params: {
            scannedProduct: product,
          },
        });
      } else {
        navigation.navigate('MainTabs', {
          screen: 'Products',
          params: {
            barcode,
            scannedProduct: product,
          },
        });
      }

      return;
    }

    // =====================================================
    // 2. OPEN FOOD FACTS LOOKUP
    // =====================================================
    console.log(
      'NOT FOUND LOCALLY. CHECKING OPEN FOOD FACTS:',
      barcode
    );

    const externalMetadata =
      await getFoodProductByBarcode(barcode);

    console.log(
      'OPEN FOOD FACTS RESULT:',
      externalMetadata
    );

    if (externalMetadata) {
      console.log(
        'PRODUCT FOUND IN OPEN FOOD FACTS:',
        barcode
      );

      /*
       * Send metadata to Products.
       *
       * We DO NOT automatically create stock.
       * User can review/edit product information first.
       */
      navigation.navigate('MainTabs', {
        screen: 'Products',
        params: {
          barcode,
          externalProductMetadata: externalMetadata,
        },
      });

      return;
    }

    // =====================================================
    // 3. EXISTING OTHER METADATA METHOD
    // =====================================================
    console.log(
      'OPEN FOOD FACTS DID NOT FIND PRODUCT.'
    );

    const metadata =
      await lookupBarcodeMetadata(barcode);

    console.log(
      'SECOND METADATA RESULT:',
      metadata
    );

    if (metadata) {
      navigation.navigate('MainTabs', {
        screen: 'Products',
        params: {
          scannedBarcode: barcode,
          barcodeMetadata: metadata,
        },
      });

      return;
    }

    // =====================================================
    // 4. NOTHING FOUND
    // =====================================================

    if (mode === 'add') {
      navigation.navigate('MainTabs', {
        screen: 'Products',
        params: {
          barcode,
        },
      });

      return;
    }

    Alert.alert(
      'Product Not Found',
      `No product metadata was found for barcode ${barcode}. Would you like to add it manually?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            setScanned(false);
            setProcessing(false);
          },
        },
        {
          text: 'Add Product',
          onPress: () => {
            navigation.navigate('MainTabs', {
              screen: 'Products',
              params: {
                barcode,
              },
            });
          },
        },
      ]
    );
  } catch (error: any) {
    console.error(
      'BARCODE LOOKUP ERROR:',
      error
    );

    Alert.alert(
      'Barcode Lookup Error',
      error?.message ||
        'Failed to search for product.',
      [
        {
          text: 'OK',
          onPress: () => {
            setScanned(false);
            setProcessing(false);
          },
        },
      ]
    );
  } finally {
    setProcessing(false);
  }
}

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <Text style={styles.permissionText}>
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Ionicons
          name="camera-outline"
          size={64}
          color={COLORS.textTertiary}
        />

        <Text style={styles.permissionText}>
          Camera permission is required to scan barcodes.
        </Text>

        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.permissionBtnText}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13',
            'ean8',
            'upc_a',
            'upc_e',
            'code128',
            'code39',
          ],
        }}
        onBarcodeScanned={
          scanned ? undefined : handleBarcodeScanned
        }
        enableTorch={torchOn}
      >
        <View style={styles.overlay}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color="#fff"
              />
            </TouchableOpacity>

            <Text style={styles.headerText}>
              Scan Barcode
            </Text>

            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setTorchOn((value) => !value)}
            >
              <Ionicons
                name={torchOn ? 'flash' : 'flash-off'}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.scanArea}>
            <View style={styles.scanFrame}>
              <View
                style={[styles.corner, styles.cornerTL]}
              />
              <View
                style={[styles.corner, styles.cornerTR]}
              />
              <View
                style={[styles.corner, styles.cornerBL]}
              />
              <View
                style={[styles.corner, styles.cornerBR]}
              />
            </View>
          </View>

          <View style={styles.footer}>
            {scanned ? (
              <TouchableOpacity
                style={styles.rescanBtn}
                onPress={() => {
                  setScanned(false);
                  setProcessing(false);
                }}
              >
                <Text style={styles.rescanText}>
                  Tap to Scan Again
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.hintText}>
                Point camera at barcode
              </Text>
            )}
          </View>
        </View>
      </CameraView>

      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator
            size="large"
            color="#fff"
          />

          <Text style={styles.processingText}>
            Searching product...
          </Text>
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
    ...StyleSheet.absoluteFill,
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
