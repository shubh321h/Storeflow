import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatTime } from '../lib/utils';
import { COLORS, SPACING, FONT_SIZE } from '../lib/theme';
import { RecentTransaction } from '../lib/types';

interface TransactionRowProps {
  transaction: RecentTransaction;
  onPress?: () => void;
}

export default function TransactionRow({ transaction, onPress }: TransactionRowProps) {
  const isIncome = transaction.type === 'sale' || transaction.type === 'payment';
  const iconColor = isIncome ? COLORS.success : COLORS.error;
  const iconName = isIncome ? 'arrow-up-outline' : 'arrow-down-outline';

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconContainer, { backgroundColor: isIncome ? COLORS.successLight : COLORS.errorLight }]}>
        <Ionicons name={iconName} size={18} color={iconColor} />
      </View>
      <View style={styles.details}>
        <Text style={styles.description} numberOfLines={1}>{transaction.description}</Text>
        <Text style={styles.time}>{formatTime(transaction.date)}</Text>
      </View>
      <Text style={[styles.amount, { color: isIncome ? COLORS.success : COLORS.error }]}>
        {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  details: {
    flex: 1,
  },
  description: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  time: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  amount: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
