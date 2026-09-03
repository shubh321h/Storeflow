import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Customer } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW } from '../lib/theme';

interface CustomerCardProps {
  customer: Customer;
  onPress?: () => void;
  onSelect?: () => void;
}

export default function CustomerCard({ customer, onPress, onSelect }: CustomerCardProps) {
  const hasBalance = customer.balance > 0;
  const Wrapper = onSelect ? TouchableOpacity : onPress ? TouchableOpacity : View;
  const handlePress = onSelect || onPress;

  return (
    <Wrapper style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        <Ionicons name="person-outline" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={1}>{customer.name}</Text>
        {customer.mobile && (
          <Text style={styles.meta} numberOfLines={1}>{customer.mobile}</Text>
        )}
      </View>
      <View style={styles.balanceContainer}>
        {hasBalance ? (
          <>
            <Text style={styles.balanceLabel}>Due</Text>
            <Text style={styles.balanceAmount}>{formatCurrency(customer.balance)}</Text>
          </>
        ) : (
          <Text style={styles.noBalance}>No dues</Text>
        )}
      </View>
      {onSelect && (
        <TouchableOpacity style={styles.selectButton} onPress={onSelect}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      )}
    </Wrapper>
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
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  details: {
    flex: 1,
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
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    fontWeight: '600',
  },
  balanceAmount: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.error,
    fontVariant: ['tabular-nums'],
  },
  noBalance: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.success,
    fontWeight: '600',
  },
  selectButton: {
    marginLeft: SPACING.md,
  },
});
