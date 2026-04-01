import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing, borderRadius, shadows } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface },
        Platform.OS === 'ios' ? shadows.md : undefined,
        Platform.OS === 'android' ? { elevation: 3 } : undefined,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    // Android border to separate cards on same-colored background
    ...Platform.select({
      android: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.07)',
      },
    }),
  },
});
