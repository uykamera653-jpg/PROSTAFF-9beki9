import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { spacing, typography, borderRadius, shadows } from '../../constants/theme';

interface CategoryCardProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export function CategoryCard({ title, icon, onPress }: CategoryCardProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface }, shadows.lg]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.iconContainer, { backgroundColor: theme.primary }]}>
        <Ionicons name={icon} size={32} color="#FFFFFF" />
      </View>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={3}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
    flex: 1,
    margin: spacing.xs,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
});
