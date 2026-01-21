import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useFavorites } from '../../hooks/useFavorites';
import { useCompanies } from '../../hooks/useCompanies';
import { CompanyCard } from '../../components/feature/CompanyCard';
import { spacing, typography } from '../../constants/theme';
import { Company } from '../../types';

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { getUserFavorites, removeFavorite, isFavorite } = useFavorites();
  const { companies } = useCompanies();

  const userFavorites = user ? getUserFavorites(user.id, 'company') : [];
  const favoriteCompanies = companies.filter((company) =>
    userFavorites.some((fav) => fav.itemId === company.id)
  );

  const handleCompanyPress = (companyId: string) => {
    router.push({
      pathname: '/company-detail',
      params: { id: companyId },
    });
  };

  const handleFavoritePress = async (companyId: string) => {
    if (!user) return;
    await removeFavorite(companyId, user.id);
  };

  const renderCompany = ({ item }: { item: Company }) => (
    <CompanyCard
      name={item.name}
      serviceType={item.serviceType}
      phoneNumber={item.phoneNumber}
      address={item.address}
      photoUrl={item.photoUrls[0]}
      rating={item.rating}
      isFavorite={user ? isFavorite(item.id, user.id) : false}
      onPress={() => handleCompanyPress(item.id)}
      onFavoritePress={() => handleFavoritePress(item.id)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Ionicons name="heart" size={28} color={theme.primary} />
        <Text style={[styles.title, { color: theme.text }]}>{t.favorites}</Text>
      </View>

      {favoriteCompanies.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="heart-outline" size={64} color={theme.textTertiary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {t.noFavorites}
          </Text>
        </View>
      ) : (
        <FlatList
          data={favoriteCompanies}
          renderItem={renderCompany}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
