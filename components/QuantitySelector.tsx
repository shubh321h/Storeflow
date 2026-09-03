import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../lib/theme';

interface QuantitySelectorProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  min?: number;
  max?: number;
  unit?: string;
  size?: 'sm' | 'md';
}

export default function QuantitySelector({
  quantity, onIncrement, onDecrement, min = 1, max, unit, size = 'md',
}: QuantitySelectorProps) {
  const btnSize = size === 'sm' ? 32 : 40;
  const fontSize = size === 'sm' ? FONT_SIZE.md : FONT_SIZE.lg;
  const canDecrement = quantity > min;
  const canIncrement = max ? quantity < max : true;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, { width: btnSize, height: btnSize, opacity: canDecrement ? 1 : 0.4 }]}
        onPress={onDecrement}
        disabled={!canDecrement}
      >
        <Ionicons name="remove" size={size === 'sm' ? 16 : 20} color={COLORS.primary} />
      </TouchableOpacity>
      <View style={[styles.valueContainer, { minWidth: size === 'sm' ? 40 : 56 }]}>
        <Text style={[styles.value, { fontSize }]}>{quantity}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
      <TouchableOpacity
        style={[styles.button, { width: btnSize, height: btnSize, opacity: canIncrement ? 1 : 0.4 }]}
        onPress={onIncrement}
        disabled={!canIncrement}
      >
        <Ionicons name="add" size={size === 'sm' ? 16 : 20} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  value: {
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  unit: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
