import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { CategoryCard } from '../components/feature/CategoryCard';
import { spacing, typography } from '../constants/theme';

const categories = [
  { key: 'gardenWork', icon: 'leaf' as const },
  { key: 'loading', icon: 'cube' as const },
  { key: 'roomCleaning', icon: 'home' as const },
  { key: 'postRepairCleaning', icon: 'brush' as const },
  { key: 'partyHelper', icon: 'wine' as const },
  { key: 'childCare', icon: 'happy' as const },
  { key: 'construction', icon: 'construct' as const },
  { key: 'cook', icon: 'restaurant' as const },
  { key: 'waiter', icon: 'person' as const },
  { key: 'dishwasher', icon: 'water' as const },
  { key: 'other', icon: 'apps' as const },
];

export default function DailyWorkersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const handleCategorySelect = (category: string) => {
    router.push({
      pathname: '/post-job',
      params: { category },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.appName, { color: theme.text }]}>{t.dailyWorkers}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>{t.selectCategory}</Text>
        
        <View style={styles.grid}>
          {categories.map((category) => (
            <View key={category.key} style={styles.gridItem}>
              <CategoryCard
                title={t[category.key as keyof typeof t] as string}
                icon={category.icon}
                onPress={() => handleCategorySelect(category.key)}
              />
            </View>
          ))}
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    width: 40,
  },
  appName: {
    ...typography.h2,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.h3,
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  gridItem: {
    width: '50%',
  },
});
