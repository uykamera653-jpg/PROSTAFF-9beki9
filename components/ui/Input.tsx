import React from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  Platform,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing, typography, borderRadius, rs } from '../../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      ) : null}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.surfaceVariant,
            borderColor: error ? theme.error : theme.border,
            color: theme.text,
          },
          style,
        ]}
        placeholderTextColor={theme.textTertiary}
        {...props}
      />
      {error ? (
        <Text style={[styles.error, { color: theme.error }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodyMedium,
    marginBottom: spacing.xs,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  input: {
    ...typography.body,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    // Consistent height across devices
    minHeight: rs(48),
    paddingVertical: rs(12),
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  error: {
    ...typography.small,
    marginTop: spacing.xs,
  },
});
