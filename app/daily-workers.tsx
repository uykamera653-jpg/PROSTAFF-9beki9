import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { CategoryCard } from '../components/feature/CategoryCard';
import { spacing, typography } from '../constants/theme';
import { supabase } from '../lib/supabase';

interface Category {
  id: string;
  name_uz: string;
  name_ru: string;
  icon: string;
}

export default function DailyWorkersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name_uz');

      if (error) throw error;
      if (data) setCategories(data);
    } catch (error: any) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryId: string, categoryName: string) => {
    router.push({
      pathname: '/post-job',
      params: { 
        categoryId,
        categoryName,
      },
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
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <View style={styles.grid}>
            {categories.map((category) => (
              <View key={category.id} style={styles.gridItem}>
                <CategoryCard
                  title={category.name_uz}
                  icon={category.icon as any}
                  onPress={() => handleCategorySelect(category.id, category.name_uz)}
                />
              </View>
            ))}
          </View>
        )}
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
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
});
