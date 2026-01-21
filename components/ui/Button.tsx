import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing, typography, borderRadius } from '../../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const { theme } = useTheme();

  const buttonStyles: ViewStyle[] = [
    styles.button,
    {
      backgroundColor: variant === 'primary' ? theme.primary : variant === 'secondary' ? theme.secondary : 'transparent',
      borderWidth: variant === 'outline' ? 1 : 0,
      borderColor: variant === 'outline' ? theme.border : 'transparent',
      paddingVertical: size === 'small' ? spacing.sm : size === 'large' ? spacing.lg : spacing.md,
      paddingHorizontal: size === 'small' ? spacing.md : size === 'large' ? spacing.xl : spacing.lg,
      opacity: disabled ? 0.5 : 1,
    },
    style,
  ];

  const textStyles: TextStyle = {
    ...typography.bodyMedium,
    color: variant === 'outline' ? theme.text : '#FFFFFF',
    fontSize: size === 'small' ? 14 : size === 'large' ? 18 : 16,
  };

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? theme.primary : '#FFFFFF'} />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
