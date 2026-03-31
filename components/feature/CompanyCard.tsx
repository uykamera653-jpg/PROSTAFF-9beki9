import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { spacing, typography, borderRadius } from '../../constants/theme';

interface CompanyCardProps {
  name: string;
  serviceType: string;
  phoneNumber: string;
  address: string;
  photoUrl: string;
  avatarUrl?: string;
  rating: number;
  isFavorite?: boolean;
  onPress: () => void;
  onFavoritePress?: () => void;
}

export function CompanyCard({
  name,
  serviceType,
  phoneNumber,
  address,
  photoUrl,
  avatarUrl,
  rating,
  isFavorite = false,
  onPress,
  onFavoritePress,
}: CompanyCardProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: theme.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View>
        <Image
          source={{ uri: photoUrl }}
          style={styles.image}
          contentFit="cover"
        />
        {onFavoritePress && (
          <TouchableOpacity
            style={[styles.favoriteButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={(e) => {
              e.stopPropagation();
              onFavoritePress();
            }}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? '#FF4444' : '#FFFFFF'}
            />
          </TouchableOpacity>
        )}
        {/* Avatar badge overlay */}
        <View style={[styles.avatarBadge, { borderColor: theme.surface }]}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatarImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.avatarImage, { backgroundColor: theme.primary + '20', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="business" size={20} color={theme.primary} />
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.rating}>
            <Ionicons name="star" size={16} color="#FFB800" />
            <Text style={[styles.ratingText, { color: theme.text }]}>
              {rating.toFixed(1)}
            </Text>
          </View>
        </View>

        <View style={[styles.tag, { backgroundColor: theme.primary + '15' }]}>
          <Text style={[styles.serviceType, { color: theme.primary }]} numberOfLines={1}>
            {serviceType}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="call" size={14} color={theme.textSecondary} />
          <Text style={[styles.info, { color: theme.textSecondary }]} numberOfLines={1}>
            {phoneNumber}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location" size={14} color={theme.textSecondary} />
          <Text style={[styles.info, { color: theme.textSecondary }]} numberOfLines={1}>
            {address}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  image: {
    width: '100%',
    height: 160,
  },
  content: {
    padding: spacing.md,
    paddingTop: spacing.xl + spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  name: {
    ...typography.h3,
    fontSize: 18,
    flex: 1,
    marginRight: spacing.sm,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  ratingText: {
    ...typography.bodyMedium,
    fontSize: 14,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  serviceType: {
    ...typography.small,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs / 2,
  },
  info: {
    ...typography.caption,
    flex: 1,
  },
  favoriteButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -20,
    left: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
});
