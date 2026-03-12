import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAlert } from '../components/ui/WebAlert';
import { spacing, typography, borderRadius } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { Language } from '../constants/translations';

interface WorkerProfile {
  id: string;
  full_name: string;
  phone: string;
  rating: number;
  completed_orders: number;
  success_rate: number;
  min_price: number;
  max_price: number;
  is_online: boolean;
}

interface Category {
  id: string;
  name_uz: string;
  name_ru: string;
  icon: string;
}

export default function WorkerProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t, language } = useTranslation();
  const { darkMode, setDarkMode, setLanguage } = useSettings();
  const { user, signOut } = useAuth();

  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { showAlert, AlertComponent } = useAlert();

  useEffect(() => {
    loadWorkerData();
  }, [user]);

  const loadWorkerData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load worker profile
      const { data: worker, error: workerError } = await supabase
        .from('workers')
        .select('*')
        .eq('id', user.id)
        .single();

      if (workerError) throw workerError;
      if (worker) setWorkerProfile(worker);

      // Load worker categories
      const { data: workerCats, error: catsError } = await supabase
        .from('worker_categories')
        .select('category_id')
        .eq('worker_id', user.id);

      if (catsError) throw catsError;

      if (workerCats && workerCats.length > 0) {
        const categoryIds = workerCats.map(c => c.category_id);
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('*')
          .in('id', categoryIds);

        if (categoriesError) throw categoriesError;
        if (categoriesData) setCategories(categoriesData);
      }
    } catch (error: any) {
      console.error('Failed to load worker data:', error);
      showAlert('Xatolik', 'Ma\'lumotlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = async (lang: Language) => {
    await setLanguage(lang);
    showAlert('Muvaffaqiyatli', `Til ${lang === 'uz' ? 'O\'zbekcha' : 'Русский'}ga o'zgartirildi`);
  };

  const handleDarkModeToggle = async () => {
    await setDarkMode(!darkMode);
  };

  const handleContactSupport = () => {
    const phoneNumber = '+998501017695';
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleEditProfile = () => {
    router.push('/worker-onboarding');
  };

  const handleSignOut = () => {
    showAlert(
      'Chiqish',
      'Hisobdan chiqmoqchimisiz?',
      [
        { text: 'Yo\'q', style: 'cancel' },
        { text: 'Ha', onPress: async () => {
          await signOut();
          router.replace('/');
        }},
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Profil</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Worker Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="person" size={40} color={theme.primary} />
            </View>
          </View>
          
          <Text style={[styles.name, { color: theme.text }]}>
            {workerProfile?.full_name || 'Ishchi'}
          </Text>
          <Text style={[styles.phone, { color: theme.textSecondary }]}>
            {workerProfile?.phone}
          </Text>

          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEditProfile}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={18} color={theme.primary} />
            <Text style={[styles.editButtonText, { color: theme.primary }]}>
              Profilni tahrirlash
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Statistics Card */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Statistika</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: theme.warning + '20' }]}>
                <Ionicons name="star" size={24} color={theme.warning} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {workerProfile?.rating.toFixed(1) || '0.0'}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Reyting
              </Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: theme.success + '20' }]}>
                <Ionicons name="checkmark-circle" size={24} color={theme.success} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {workerProfile?.completed_orders || 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Bajarilgan
              </Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="trending-up" size={24} color={theme.primary} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {workerProfile?.success_rate.toFixed(0) || '0'}%
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Muvaffaqiyat
              </Text>
            </View>
          </View>
        </Card>

        {/* Categories Card */}
        {categories.length > 0 && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Xizmat sohalari
            </Text>
            <View style={styles.categoriesGrid}>
              {categories.map(category => (
                <View
                  key={category.id}
                  style={[styles.categoryChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Text style={styles.categoryIcon}>{category.icon}</Text>
                  <Text style={[styles.categoryName, { color: theme.text }]}>
                    {language === 'uz' ? category.name_uz : category.name_ru}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Price Range Card */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Narx oralig'i
          </Text>
          <View style={styles.priceRange}>
            <View style={styles.priceItem}>
              <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>
                Minimal
              </Text>
              <Text style={[styles.priceValue, { color: theme.text }]}>
                {workerProfile?.min_price.toLocaleString()} so'm
              </Text>
            </View>
            <Ionicons name="remove" size={20} color={theme.textTertiary} />
            <View style={styles.priceItem}>
              <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>
                Maksimal
              </Text>
              <Text style={[styles.priceValue, { color: theme.text }]}>
                {workerProfile?.max_price.toLocaleString()} so'm
              </Text>
            </View>
          </View>
        </Card>

        {/* Settings Card */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Sozlamalar</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => handleLanguageChange(language === 'uz' ? 'ru' : 'uz')}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="language" size={24} color={theme.primary} />
              <Text style={[styles.settingText, { color: theme.text }]}>Til</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                {language === 'uz' ? 'O\'zbekcha' : 'Русский'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleDarkModeToggle}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name={darkMode ? 'moon' : 'sunny'}
                size={24}
                color={theme.primary}
              />
              <Text style={[styles.settingText, { color: theme.text }]}>
                Kun/Tun rejimi
              </Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                {darkMode ? 'Tun' : 'Kun'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleContactSupport}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="headset" size={24} color={theme.primary} />
              <Text style={[styles.settingText, { color: theme.text }]}>
                Yordam xizmati
              </Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                +998 50 101 76 95
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
            </View>
          </TouchableOpacity>
        </Card>

        {/* Sign Out Button */}
        <Button
          title="Chiqish"
          onPress={handleSignOut}
          variant="outline"
          style={styles.signOutButton}
        />

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
      <AlertComponent />
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
  },
  headerTitle: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.xl,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...typography.h3,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  phone: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  editButtonText: {
    ...typography.bodyMedium,
    fontWeight: '500',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs / 2,
  },
  statValue: {
    ...typography.h3,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.small,
    textAlign: 'center',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  categoryIcon: {
    fontSize: 18,
  },
  categoryName: {
    ...typography.body,
    fontWeight: '500',
  },
  priceRange: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  priceItem: {
    flex: 1,
    alignItems: 'center',
  },
  priceLabel: {
    ...typography.small,
    marginBottom: spacing.xs / 2,
  },
  priceValue: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  settingText: {
    ...typography.bodyMedium,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  settingValue: {
    ...typography.body,
  },
  signOutButton: {
    marginTop: spacing.md,
  },
});
