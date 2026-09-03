import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../lib/theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export default function PrimaryButton({
  title, onPress, disabled, loading, variant = 'primary', size = 'md',
}: PrimaryButtonProps) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const height = size === 'sm' ? 36 : size === 'lg' ? 56 : 48;
  const fontSize = size === 'sm' ? FONT_SIZE.sm : size === 'lg' ? FONT_SIZE.lg : FONT_SIZE.md;

  const backgroundColor = isDanger ? COLORS.error : isPrimary ? COLORS.primary : COLORS.surface;
  const textColor = isPrimary || isDanger ? '#fff' : COLORS.primary;
  const borderColor = isDanger ? COLORS.error : COLORS.primary;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor, height, borderWidth: isPrimary ? 0 : 1.5, borderColor },
        (disabled || loading) && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.text, { color: textColor, fontSize }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  text: {
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});
