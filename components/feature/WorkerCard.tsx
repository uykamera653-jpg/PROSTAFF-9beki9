import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { Card } from '../ui/Card';
import { spacing, typography, borderRadius } from '../../constants/theme';
import { Worker } from '../../types';

interface WorkerCardProps {
  worker: Worker;
  isSelected: boolean;
  onSelect: () => void;
}

export function WorkerCard({ worker, isSelected, onSelect }: WorkerCardProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <Card style={[styles.card, isSelected && { borderColor: theme.primary, borderWidth: 2 }]}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {worker.photoUrl ? (
            <Image
              source={{ uri: worker.photoUrl }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="person" size={32} color={theme.primary} />
            </View>
          )}
          <View style={[styles.ratingBadge, { backgroundColor: theme.success }]}>
            <Ionicons name="star" size={12} color="#FFFFFF" />
            <Text style={styles.ratingText}>{worker.rating}</Text>
          </View>
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {worker.name}
          </Text>
          <Text style={[styles.age, { color: theme.textSecondary }]}>
            {worker.age} {t.years}
          </Text>
          <Text style={[styles.experience, { color: theme.textTertiary }]} numberOfLines={1}>
            {worker.experience}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={[styles.detailItem, { backgroundColor: theme.surfaceVariant }]}>
          <Ionicons name="cash-outline" size={18} color={theme.primary} />
          <View style={styles.detailTextContainer}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
              {t.dailyRate}
            </Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>
              {worker.dailyRate.toLocaleString()} {t.som}
            </Text>
          </View>
        </View>

        <View style={[styles.detailItem, { backgroundColor: theme.surfaceVariant }]}>
          <Ionicons name="time-outline" size={18} color={theme.secondary} />
          <View style={styles.detailTextContainer}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
              {t.arrivalTime}
            </Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>
              {worker.arrivalTime} {t.minutes}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.selectButton,
          {
            backgroundColor: isSelected ? theme.primary : theme.surfaceVariant,
          },
        ]}
        onPress={onSelect}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
          size={20}
          color={isSelected ? '#FFFFFF' : theme.primary}
        />
        <Text
          style={[
            styles.selectButtonText,
            { color: isSelected ? '#FFFFFF' : theme.primary },
          ]}
        >
          {isSelected ? t.selectedWorkers : t.selectWorker}
        </Text>
      </TouchableOpacity>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  info: {
    flex: 1,
  },
  name: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  age: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  experience: {
    ...typography.small,
  },
  details: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    ...typography.small,
    marginBottom: 2,
  },
  detailValue: {
    ...typography.bodyMedium,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  selectButtonText: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
});
