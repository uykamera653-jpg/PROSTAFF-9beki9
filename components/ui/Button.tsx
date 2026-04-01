import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing, typography, borderRadius, rs } from '../../constants/theme';

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

  const paddingVertical =
    size === 'small' ? rs(10) : size === 'large' ? rs(18) : rs(14);
  const paddingHorizontal =
    size === 'small' ? rs(14) : size === 'large' ? rs(28) : rs(20);

  const buttonStyles: ViewStyle[] = [
    styles.button,
    {
      backgroundColor:
        variant === 'primary'
          ? theme.primary
          : variant === 'secondary'
          ? theme.secondary
          : 'transparent',
      borderWidth: variant === 'outline' ? 1.5 : 0,
      borderColor: variant === 'outline' ? theme.primary : 'transparent',
      paddingVertical,
      paddingHorizontal,
      opacity: disabled ? 0.5 : 1,
      // Android ripple-safe min touch target
      minHeight: 48,
    },
    style,
  ];

  const textStyles: TextStyle = {
    ...typography.bodyMedium,
    color:
      variant === 'outline'
        ? theme.primary
        : '#FFFFFF',
    fontSize:
      size === 'small'
        ? typography.caption.fontSize
        : size === 'large'
        ? typography.h3.fontSize
        : typography.bodyMedium.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  };

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' ? theme.primary : '#FFFFFF'}
          size="small"
        />
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
