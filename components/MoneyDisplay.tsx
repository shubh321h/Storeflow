import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { formatCurrency } from '../lib/utils';
import { FONT_SIZE, COLORS } from '../lib/theme';

interface MoneyDisplayProps {
  amount: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  bold?: boolean;
}

export default function MoneyDisplay({ amount, currency, size = 'md', color, bold }: MoneyDisplayProps) {
  const fontSize =
    size === 'sm' ? FONT_SIZE.md :
    size === 'lg' ? FONT_SIZE.xxl :
    size === 'xl' ? FONT_SIZE.xxxl :
    FONT_SIZE.lg;

  return (
    <Text style={[styles.text, { fontSize, color: color || COLORS.textPrimary, fontWeight: bold ? '700' : '600' }]}>
      {formatCurrency(amount, currency)}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontVariant: ['tabular-nums'],
  },
});
