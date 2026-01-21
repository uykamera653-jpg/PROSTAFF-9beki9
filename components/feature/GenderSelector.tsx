import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { spacing, typography, borderRadius } from '../../constants/theme';

interface GenderSelectorProps {
  selected: 'male' | 'female' | 'any';
  onSelect: (gender: 'male' | 'female' | 'any') => void;
  labels: { male: string; female: string; any: string };
}

export function GenderSelector({ selected, onSelect, labels }: GenderSelectorProps) {
  const { theme } = useTheme();

  const options: Array<{ value: 'male' | 'female' | 'any'; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
    { value: 'male', icon: 'man', label: labels.male },
    { value: 'female', icon: 'woman', label: labels.female },
    { value: 'any', icon: 'people', label: labels.any },
  ];

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isSelected = selected === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.option,
              {
                backgroundColor: isSelected ? theme.primary : theme.surface,
                borderColor: isSelected ? theme.primary : theme.border,
              },
            ]}
            onPress={() => onSelect(option.value)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={option.icon}
              size={32}
              color={isSelected ? '#FFFFFF' : theme.text}
            />
            <Text
              style={[
                styles.label,
                { color: isSelected ? '#FFFFFF' : theme.text },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  option: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.bodyMedium,
  },
});
