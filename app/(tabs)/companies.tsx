import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { useCompanies } from '../../hooks/useCompanies';
import { useAuth } from '../../hooks/useAuth';
import { useFavorites } from '../../hooks/useFavorites';
import { CompanyCard } from '../../components/feature/CompanyCard';
import { spacing, typography } from '../../constants/theme';
import { Company } from '../../types';

export default function CompaniesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { companies, refetch, hasMore, isLoadingMore, loadMore } = useCompanies();
  const { user } = useAuth();
  const { addFavorite, removeFavorite, isFavorite } = useFavorites();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'newest'>('rating');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Initial fetch on mount
    handleRefresh();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const categories = [
    { id: 'all', name: t.allCategories, icon: 'apps' },
    { id: 'Yoqilg\'i yetkazish', name: 'Yoqilg\'i', icon: 'flame' },
    { id: 'Eshik va rom o\'rnatish', name: 'Eshik', icon: 'home' },
    { id: 'Tarjimonlik', name: 'Tarjima', icon: 'language' },
    { id: 'Konditsioner o\'rnatish', name: 'Konditsioner', icon: 'snow' },
    { id: 'Gilam yuvish', name: 'Gilam', icon: 'color-fill' },
  ];

  const handleCompanyPress = (companyId: string) => {
    router.push({
      pathname: '/company-detail',
      params: { id: companyId },
    });
  };

  const handleFavoritePress = async (companyId: string) => {
    if (!user) return;
    if (isFavorite(companyId, user.id)) {
      await removeFavorite(companyId, user.id);
    } else {
      await addFavorite(companyId, 'company', user.id);
    }
  };

  // Filter companies - only show online companies (already filtered in context)
  const filteredCompanies = companies
    .filter((company) => {
      const matchesSearch =
        company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.serviceType.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === 'all' || company.serviceType === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') {
        return b.rating - a.rating;
      }
      return 0;
    });

  const renderCompany = ({ item }: { item: Company }) => (
    <CompanyCard
      name={item.name}
      serviceType={item.serviceType}
      phoneNumber={item.phoneNumber}
      address={item.address}
      photoUrl={item.photoUrls[0] || 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800'}
      avatarUrl={item.avatarUrl || undefined}
      rating={item.rating}
      isFavorite={user ? isFavorite(item.id, user.id) : false}
      onPress={() => handleCompanyPress(item.id)}
      onFavoritePress={() => handleFavoritePress(item.id)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <Text style={[styles.appName, { color: theme.text }]}>{t.services}</Text>
      </View>

      <View style={styles.content}>
        {/* Category Filter */}
        <View style={styles.categoryContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor:
                      selectedCategory === category.id
                        ? theme.primary
                        : theme.surface,
                  },
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Ionicons
                  name={category.icon as any}
                  size={18}
                  color={
                    selectedCategory === category.id
                      ? '#FFFFFF'
                      : theme.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    {
                      color:
                        selectedCategory === category.id
                          ? '#FFFFFF'
                          : theme.text,
                    },
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
            <Ionicons name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t.searchPlaceholder}
              placeholderTextColor={theme.textTertiary}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.filterRow}>
          <Text style={[styles.title, { color: theme.text }]}>{t.companies}</Text>
          <TouchableOpacity
            style={[styles.sortButton, { backgroundColor: theme.surface }]}
            onPress={() => setSortBy(sortBy === 'rating' ? 'newest' : 'rating')}
          >
            <Ionicons name="funnel" size={16} color={theme.primary} />
            <Text style={[styles.sortText, { color: theme.primary }]}>
              {sortBy === 'rating' ? t.highestRated : t.newest}
            </Text>
          </TouchableOpacity>
        </View>

        {isRefreshing && companies.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Firmalar yuklanmoqda...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredCompanies}
            renderItem={renderCompany}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            onRefresh={handleRefresh}
            refreshing={isRefreshing}
            onEndReached={() => {
              if (!searchQuery && selectedCategory === 'all') {
                loadMore();
              }
            }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[styles.footerLoaderText, { color: theme.textSecondary }]}>
                    Ko'proq yuklanmoqda...
                  </Text>
                </View>
              ) : !hasMore && filteredCompanies.length > 0 ? (
                <Text style={[styles.noMoreText, { color: theme.textTertiary }]}>
                  Barcha firmalar ko'rsatildi
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="business-outline" size={64} color={theme.textTertiary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {searchQuery || selectedCategory !== 'all'
                    ? t.noCompaniesFound
                    : 'Hozircha online firmalar yo\'q'}
                </Text>
                <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>
                  Faqat online rejimidagi firmalar ko'rsatiladi
                </Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  appName: {
    ...typography.h2,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  sortText: {
    ...typography.small,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  categoryContainer: {
    paddingTop: spacing.md,
  },
  categoryScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  categoryChipText: {
    ...typography.bodyMedium,
    fontSize: 14,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  footerLoaderText: { ...typography.small },
  noMoreText: {
    ...typography.small,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.small,
    textAlign: 'center',
  },
});
