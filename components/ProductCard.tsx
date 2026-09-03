import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Product } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW } from '../lib/theme';

interface ProductCardProps {
  product: Product;
  onPress?: () => void;
  onAddToCart?: () => void;
}

export default function ProductCard({ product, onPress, onAddToCart }: ProductCardProps) {
  const isLowStock = product.currentStock <= product.minStockLevel && product.currentStock > 0;
  const isOutOfStock = product.currentStock <= 0;
  const stockColor = isOutOfStock ? COLORS.error : isLowStock ? COLORS.warning : COLORS.success;
  const stockBg = isOutOfStock ? COLORS.errorLight : isLowStock ? COLORS.warningLight : COLORS.successLight;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.infoRow}>
        <View style={styles.iconContainer}>
          <Ionicons name="cube-outline" size={24} color={COLORS.primary} />
        </View>
        <View style={styles.details}>
          <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {product.categoryName || 'Uncategorized'} • {product.unit}
          </Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>{formatCurrency(product.sellingPrice)}</Text>
          <View style={[styles.stockBadge, { backgroundColor: stockBg }]}>
            <Text style={[styles.stockText, { color: stockColor }]}>
              {product.currentStock} {product.unit}
            </Text>
          </View>
        </View>
      </View>
      {onAddToCart && (
        <TouchableOpacity style={styles.addButton} onPress={onAddToCart}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOW.sm,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  details: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  name: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  meta: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  stockBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  stockText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  addButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.md,
  },
});
