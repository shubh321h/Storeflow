import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBusiness } from '../context/BusinessContext';
import {
  getProducts, searchProducts, createProduct, updateProduct, getCategories, getSuppliers, createCategory, createStockMovement, updateProductStock, getStockMovements,
} from '../lib/database';
import { Product, Category, Supplier, StockMovement } from '../lib/types';
import { generateId, debounce, roundTo2 } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW, COMMON_STYLES } from '../lib/theme';
import AppHeader from '../components/AppHeader';
import SearchBar from '../components/SearchBar';
import ProductCard from '../components/ProductCard';
import PrimaryButton from '../components/PrimaryButton';
import QuantitySelector from '../components/QuantitySelector';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ConfirmationDialog from '../components/ConfirmationDialog';

interface ProductsScreenProps {
  navigation: any;
  route: any;
}

export default function ProductsScreen({ navigation, route }: ProductsScreenProps) {
  const { business } = useBusiness();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockHistory, setStockHistory] = useState<StockMovement[]>([]);
  const [showStockHistory, setShowStockHistory] = useState(false);

  // Product form state
  const [formName, setFormName] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formPurchasePrice, setFormPurchasePrice] = useState('');
  const [formSellingPrice, setFormSellingPrice] = useState('');
  const [formMrp, setFormMrp] = useState('');
  const [formTaxRate, setFormTaxRate] = useState('');
  const [formUnit, setFormUnit] = useState('Piece');
  const [formStock, setFormStock] = useState('');
  const [formMinStock, setFormMinStock] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Stock adjustment state
  const [stockAdjustmentQty, setStockAdjustmentQty] = useState(0);
  const [stockAdjustmentReason, setStockAdjustmentReason] = useState('');
  const [stockAdjustmentType, setStockAdjustmentType] = useState('adjustment');
  const [showStockTypePicker, setShowStockTypePicker] = useState(false);

  const units = ['Piece', 'Kg', 'Gram', 'Litre', 'Ml', 'Dozen', 'Box', 'Pack', 'Bundle', 'Meter', 'Pair'];
  const stockTypes = [
    { value: 'opening_stock', label: 'Opening Stock' },
    { value: 'purchase', label: 'Purchase' },
    { value: 'adjustment', label: 'Adjustment' },
    { value: 'damage', label: 'Damage' },
    { value: 'correction', label: 'Correction' },
  ];

  const handleBarcodeScanned = useCallback((barcode: string) => {
    if (barcode) {
      setFormBarcode(barcode);
      setShowAddModal(true);
    }
  }, []);

  React.useEffect(() => {
    if (route.params?.newBill) {
      navigation.navigate('Billing', { newBill: true });
    }
    if (route.params?.barcode) {
      handleBarcodeScanned(route.params.barcode);
    }
  }, [route.params]);

  async function loadData() {
    if (!business) return;
    try {
      const [prods, cats, supps] = await Promise.all([
        getProducts(business.id),
        getCategories(business.id),
        getSuppliers(business.id),
      ]);
      setProducts(prods);
      setCategories(cats);
      setSuppliers(supps);
    } catch (e) {
      console.error('Products load error', e);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [business])
  );

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!business) return;
      if (query.trim()) {
        const results = await searchProducts(business.id, query.trim());
        setProducts(results);
      } else {
        const all = await getProducts(business.id);
        setProducts(all);
      }
    }, 300),
    [business]
  );

  function handleSearch(text: string) {
    setSearchQuery(text);
    debouncedSearch(text);
  }

  function clearSearch() {
    setSearchQuery('');
    loadData();
  }

  function openAddModal(product?: Product | null) {
    if (product) {
      setEditingProduct(product);
      setFormName(product.name);
      setFormBarcode(product.barcode || '');
      setFormSku(product.sku || '');
      setFormCategory(product.categoryName || '');
      setFormBrand(product.brand || '');
      setFormPurchasePrice(String(product.purchasePrice));
      setFormSellingPrice(String(product.sellingPrice));
      setFormMrp(product.mrp ? String(product.mrp) : '');
      setFormTaxRate(String(product.taxRate));
      setFormUnit(product.unit);
      setFormStock(String(product.currentStock));
      setFormMinStock(String(product.minStockLevel));
      setFormSupplier(product.supplierName || '');
      setFormNotes(product.notes || '');
    } else {
      setEditingProduct(null);
      resetForm();
    }
    setShowAddModal(true);
  }

  function resetForm() {
    setFormName('');
    setFormBarcode('');
    setFormSku('');
    setFormCategory('');
    setFormBrand('');
    setFormPurchasePrice('');
    setFormSellingPrice('');
    setFormMrp('');
    setFormTaxRate(String(business?.defaultTaxRate || 0));
    setFormUnit('Piece');
    setFormStock('0');
    setFormMinStock('5');
    setFormSupplier('');
    setFormNotes('');
  }

  async function handleSaveProduct() {
    if (!business) return;
    if (!formName.trim() || !formSellingPrice.trim()) {
      Alert.alert('Required', 'Product name and selling price are required');
      return;
    }

    const sellingPrice = parseFloat(formSellingPrice) || 0;
    const purchasePrice = parseFloat(formPurchasePrice) || 0;
    const mrp = formMrp ? parseFloat(formMrp) : undefined;
    const taxRate = parseFloat(formTaxRate) || 0;
    const stock = parseFloat(formStock) || 0;
    const minStock = parseFloat(formMinStock) || 0;

    const categoryObj = categories.find(c => c.name === formCategory);
    const supplierObj = suppliers.find(s => s.name === formSupplier);

    try {
      if (editingProduct) {
        const updated: Product = {
          ...editingProduct,
          name: formName.trim(),
          barcode: formBarcode.trim() || undefined,
          sku: formSku.trim() || undefined,
          categoryId: categoryObj?.id,
          categoryName: formCategory.trim() || undefined,
          brand: formBrand.trim() || undefined,
          purchasePrice: purchasePrice,
          sellingPrice: sellingPrice,
          mrp: mrp,
          taxRate: taxRate,
          unit: formUnit,
          currentStock: stock,
          minStockLevel: minStock,
          supplierId: supplierObj?.id,
          supplierName: formSupplier.trim() || undefined,
          notes: formNotes.trim() || undefined,
          updatedAt: new Date().toISOString(),
        };
        await updateProduct(updated);
      } else {
        const newProduct: Product = {
          id: generateId(),
          businessId: business.id,
          name: formName.trim(),
          barcode: formBarcode.trim() || undefined,
          sku: formSku.trim() || undefined,
          categoryId: categoryObj?.id,
          categoryName: formCategory.trim() || undefined,
          brand: formBrand.trim() || undefined,
          purchasePrice: purchasePrice,
          sellingPrice: sellingPrice,
          mrp: mrp,
          taxRate: taxRate,
          unit: formUnit,
          currentStock: stock,
          minStockLevel: minStock,
          supplierId: supplierObj?.id,
          supplierName: formSupplier.trim() || undefined,
          notes: formNotes.trim() || undefined,
          isArchived: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await createProduct(newProduct);

        // Record stock movement for opening stock
        if (stock > 0) {
          await createStockMovement({
            id: generateId(),
            businessId: business.id,
            productId: newProduct.id,
            productName: newProduct.name,
            previousQty: 0,
            changeQty: stock,
            newQty: stock,
            type: 'opening_stock',
            reason: 'Initial stock entry',
            createdAt: new Date().toISOString(),
          });
        }
      }
      setShowAddModal(false);
      resetForm();
      loadData();
    } catch (e: any) {
      if (e.message?.includes('UNIQUE')) {
        Alert.alert('Error', 'A product with this barcode already exists');
      } else {
        Alert.alert('Error', 'Failed to save product. Please try again.');
      }
    }
  }

  async function handleArchiveProduct() {
    if (!selectedProduct) return;
    try {
      await updateProduct({ ...selectedProduct, isArchived: 1, updatedAt: new Date().toISOString() });
      setShowDeleteConfirm(false);
      setSelectedProduct(null);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to archive product');
    }
  }

  async function handleAddNewCategory() {
    if (!business || !newCategoryName.trim()) return;
    try {
      const category: Category = {
        id: generateId(),
        businessId: business.id,
        name: newCategoryName.trim(),
        createdAt: new Date().toISOString(),
      };
      await createCategory(category);
      setCategories([...categories, category]);
      setFormCategory(newCategoryName.trim());
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      setShowCategoryPicker(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to create category');
    }
  }

  async function openStockAdjustment(product: Product) {
    setSelectedProduct(product);
    setStockAdjustmentQty(0);
    setStockAdjustmentReason('');
    setStockAdjustmentType('adjustment');
    setShowStockModal(true);
  }

  async function handleStockAdjustment() {
    if (!selectedProduct || !business) return;
    if (stockAdjustmentQty === 0) {
      Alert.alert('Invalid', 'Please enter a quantity to adjust');
      return;
    }

    const newQty = roundTo2(selectedProduct.currentStock + stockAdjustmentQty);
    if (newQty < 0) {
      Alert.alert('Invalid', 'Stock cannot go below 0');
      return;
    }

    try {
      await createStockMovement({
        id: generateId(),
        businessId: business.id,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        previousQty: selectedProduct.currentStock,
        changeQty: stockAdjustmentQty,
        newQty: newQty,
        type: stockAdjustmentType as any,
        reason: stockAdjustmentReason || undefined,
        createdAt: new Date().toISOString(),
      });
      await updateProductStock(selectedProduct.id, newQty);
      setShowStockModal(false);
      setSelectedProduct(null);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to adjust stock');
    }
  }

  async function openStockHistory(product: Product) {
    if (!business) return;
    const history = await getStockMovements(product.id);
    setStockHistory(history);
    setSelectedProduct(product);
    setShowStockHistory(true);
  }

  function renderProductItem({ item }: { item: Product }) {
    return (
      <ProductCard
        product={item}
        onPress={() => openAddModal(item)}
      />
    );
  }

  if (loading) return <LoadingState />;

  return (
    <View style={COMMON_STYLES.screen}>
      <AppHeader
        title="Products"
        rightAction={{ icon: 'add-outline', onPress: () => openAddModal() }}
      />

      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="Search by name, barcode, or SKU..."
          onClear={clearSearch}
        />
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionChip} onPress={() => openAddModal()}>
          <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.actionChipText}>Add Product</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionChip} onPress={() => navigation.navigate('BarcodeScanner', { fromScreen: 'Products' })}>
          <Ionicons name="scan-outline" size={18} color={COLORS.secondary} />
          <Text style={styles.actionChipText}>Scan</Text>
        </TouchableOpacity>
      </View>

      {products.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="No products yet"
          message="Add your first product to start managing inventory"
          actionLabel="Add Product"
          onAction={() => openAddModal()}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderProductItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Product Modal */}
      <Modal visible={showAddModal} animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalContainer}>
          <AppHeader
            title={editingProduct ? 'Edit Product' : 'Add Product'}
            onBack={() => setShowAddModal(false)}
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Product Name *</Text>
              <TextInput style={styles.formInput} value={formName} onChangeText={setFormName} placeholder="Enter product name" placeholderTextColor={COLORS.textTertiary} />

              <Text style={styles.formLabel}>Barcode</Text>
              <View style={styles.barcodeRow}>
                <TextInput style={[styles.formInput, { flex: 1 }]} value={formBarcode} onChangeText={setFormBarcode} placeholder="Scan or enter barcode" placeholderTextColor={COLORS.textTertiary} />
                <TouchableOpacity style={styles.scanButton} onPress={() => { setShowAddModal(false); navigation.navigate('BarcodeScanner', { fromScreen: 'Products', mode: 'add' }); }}>
                  <Ionicons name="scan-outline" size={22} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.formLabel}>SKU</Text>
              <TextInput style={styles.formInput} value={formSku} onChangeText={setFormSku} placeholder="Stock Keeping Unit" placeholderTextColor={COLORS.textTertiary} />

              <Text style={styles.formLabel}>Category</Text>
              <TouchableOpacity style={styles.formInput} onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
                <Text style={formCategory ? styles.formInputText : styles.formInputPlaceholder}>{formCategory || 'Select category'}</Text>
              </TouchableOpacity>
              {showCategoryPicker && (
                <View style={styles.pickerDropdown}>
                  {categories.map(c => (
                    <TouchableOpacity key={c.id} style={styles.pickerItem} onPress={() => { setFormCategory(c.name); setShowCategoryPicker(false); }}>
                      <Text style={styles.pickerItemText}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.pickerItem} onPress={() => setShowNewCategoryInput(true)}>
                    <Text style={[styles.pickerItemText, { color: COLORS.primary }]}>+ New Category</Text>
                  </TouchableOpacity>
                </View>
              )}
              {showNewCategoryInput && (
                <View style={styles.newCategoryRow}>
                  <TextInput style={[styles.formInput, { flex: 1 }]} value={newCategoryName} onChangeText={setNewCategoryName} placeholder="New category name" placeholderTextColor={COLORS.textTertiary} />
                  <TouchableOpacity style={styles.saveCategoryBtn} onPress={handleAddNewCategory}>
                    <Text style={styles.saveCategoryText}>Save</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.formLabel}>Brand</Text>
              <TextInput style={styles.formInput} value={formBrand} onChangeText={setFormBrand} placeholder="Brand name" placeholderTextColor={COLORS.textTertiary} />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Purchase Price</Text>
                  <TextInput style={styles.formInput} value={formPurchasePrice} onChangeText={setFormPurchasePrice} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.textTertiary} />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.formLabel}>Selling Price *</Text>
                  <TextInput style={styles.formInput} value={formSellingPrice} onChangeText={setFormSellingPrice} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.textTertiary} />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>MRP</Text>
                  <TextInput style={styles.formInput} value={formMrp} onChangeText={setFormMrp} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.textTertiary} />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.formLabel}>Tax Rate (%)</Text>
                  <TextInput style={styles.formInput} value={formTaxRate} onChangeText={setFormTaxRate} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.textTertiary} />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Unit</Text>
                  <TouchableOpacity style={styles.formInput} onPress={() => setShowUnitPicker(!showUnitPicker)}>
                    <Text style={styles.formInputText}>{formUnit}</Text>
                  </TouchableOpacity>
                  {showUnitPicker && (
                    <View style={styles.pickerDropdown}>
                      {units.map(u => (
                        <TouchableOpacity key={u} style={styles.pickerItem} onPress={() => { setFormUnit(u); setShowUnitPicker(false); }}>
                          <Text style={styles.pickerItemText}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.formLabel}>Stock</Text>
                  <TextInput style={styles.formInput} value={formStock} onChangeText={setFormStock} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.textTertiary} />
                </View>
              </View>

              <Text style={styles.formLabel}>Min Stock Level</Text>
              <TextInput style={styles.formInput} value={formMinStock} onChangeText={setFormMinStock} keyboardType="decimal-pad" placeholder="5" placeholderTextColor={COLORS.textTertiary} />

              <Text style={styles.formLabel}>Supplier</Text>
              <TouchableOpacity style={styles.formInput} onPress={() => setShowSupplierPicker(!showSupplierPicker)}>
                <Text style={formSupplier ? styles.formInputText : styles.formInputPlaceholder}>{formSupplier || 'Select supplier'}</Text>
              </TouchableOpacity>
              {showSupplierPicker && (
                <View style={styles.pickerDropdown}>
                  {suppliers.map(s => (
                    <TouchableOpacity key={s.id} style={styles.pickerItem} onPress={() => { setFormSupplier(s.name); setShowSupplierPicker(false); }}>
                      <Text style={styles.pickerItemText}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.formLabel}>Notes</Text>
              <TextInput style={[styles.formInput, styles.textArea]} value={formNotes} onChangeText={setFormNotes} multiline numberOfLines={3} placeholder="Additional notes" placeholderTextColor={COLORS.textTertiary} />

              {editingProduct && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.stockAdjBtn} onPress={() => { setShowAddModal(false); openStockAdjustment(editingProduct); }}>
                    <Ionicons name="swap-vertical-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.stockAdjText}>Adjust Stock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stockAdjBtn} onPress={() => { setShowAddModal(false); openStockHistory(editingProduct); }}>
                    <Ionicons name="time-outline" size={18} color={COLORS.secondary} />
                    <Text style={[styles.stockAdjText, { color: COLORS.secondary }]}>Stock History</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.archiveBtn} onPress={() => { setShowAddModal(false); setShowDeleteConfirm(true); }}>
                    <Ionicons name="archive-outline" size={18} color={COLORS.error} />
                    <Text style={styles.archiveText}>Archive</Text>
                  </TouchableOpacity>
                </View>
              )}

              <PrimaryButton title={editingProduct ? 'Update Product' : 'Save Product'} onPress={handleSaveProduct} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal visible={showStockModal} animationType="slide" transparent onRequestClose={() => setShowStockModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adjust Stock</Text>
            <Text style={styles.modalSubtitle}>{selectedProduct?.name}</Text>
            <Text style={styles.currentStockText}>Current: {selectedProduct?.currentStock} {selectedProduct?.unit}</Text>

            <Text style={styles.formLabel}>Type</Text>
            <TouchableOpacity style={styles.formInput} onPress={() => setShowStockTypePicker(!showStockTypePicker)}>
              <Text style={styles.formInputText}>
                {stockTypes.find(t => t.value === stockAdjustmentType)?.label}
              </Text>
            </TouchableOpacity>
            {showStockTypePicker && (
              <View style={styles.pickerDropdown}>
                {stockTypes.map(t => (
                  <TouchableOpacity key={t.value} style={styles.pickerItem} onPress={() => { setStockAdjustmentType(t.value); setShowStockTypePicker(false); }}>
                    <Text style={styles.pickerItemText}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.formLabel}>Quantity Change (+ or -)</Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setStockAdjustmentQty(prev => prev - 1)}>
                <Ionicons name="remove" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{stockAdjustmentQty}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setStockAdjustmentQty(prev => prev + 1)}>
                <Ionicons name="add" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Reason</Text>
            <TextInput style={styles.formInput} value={stockAdjustmentReason} onChangeText={setStockAdjustmentReason} placeholder="Reason for adjustment" placeholderTextColor={COLORS.textTertiary} />

            <Text style={styles.newStockText}>New Stock: {roundTo2((selectedProduct?.currentStock || 0) + stockAdjustmentQty)} {selectedProduct?.unit}</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowStockModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleStockAdjustment}>
                <Text style={styles.confirmBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Stock History Modal */}
      <Modal visible={showStockHistory} animationType="slide" onRequestClose={() => setShowStockHistory(false)}>
        <View style={styles.modalContainer}>
          <AppHeader title="Stock History" onBack={() => setShowStockHistory(false)} />
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {stockHistory.length === 0 ? (
              <Text style={styles.emptyText}>No stock movements recorded</Text>
            ) : (
              stockHistory.map(m => (
                <View key={m.id} style={styles.historyItem}>
                  <View style={styles.historyRow}>
                    <Text style={styles.historyType}>{m.type.replace(/_/g, ' ')}</Text>
                    <Text style={styles.historyDate}>{new Date(m.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <Text style={styles.historyChange}>
                    {m.changeQty > 0 ? '+' : ''}{m.changeQty} {m.reason ? `• ${m.reason}` : ''}
                  </Text>
                  <Text style={styles.historyQty}>
                    {m.previousQty} → {m.newQty}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      <ConfirmationDialog
        visible={showDeleteConfirm}
        title="Archive Product?"
        message="This product will be archived. It won't show in product lists but will remain in historical records."
        confirmText="Archive"
        cancelText="Cancel"
        onConfirm={handleArchiveProduct}
        onCancel={() => setShowDeleteConfirm(false)}
        danger
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  actionChipText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl * 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  currentStockText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: SPACING.lg,
  },
  modalScroll: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl * 2,
  },
  formLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  formInput: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    height: 48,
    justifyContent: 'center',
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  formInputText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  formInputPlaceholder: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textTertiary,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: SPACING.md,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  scanButton: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowInputs: {
    flexDirection: 'row',
  },
  pickerDropdown: {
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
  newCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  saveCategoryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  saveCategoryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginVertical: SPACING.lg,
  },
  stockAdjBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 1,
    justifyContent: 'center',
  },
  stockAdjText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
    flex: 1,
    justifyContent: 'center',
  },
  archiveText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    fontWeight: '600',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginVertical: SPACING.md,
  },
  qtyBtn: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyValue: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    minWidth: 60,
    textAlign: 'center',
  },
  newStockText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: FONT_SIZE.md,
    color: '#fff',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
  historyItem: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyType: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textTransform: 'capitalize',
  },
  historyDate: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
  },
  historyChange: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  historyQty: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
});
