import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAlert } from '../components/ui/WebAlert';
import { spacing, typography, borderRadius } from '../constants/theme';
import { supabase } from '../lib/supabase';

interface Category {
  id: string;
  name_uz: string;
  name_ru: string;
  icon: string;
}

export default function WorkerOnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [minPrice, setMinPrice] = useState('200000');
  const [maxPrice, setMaxPrice] = useState('300000');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const { showAlert, AlertComponent } = useAlert();

  useEffect(() => {
    loadCategories();
    loadWorkerProfile();
  }, [user]);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name_uz');

      if (error) throw error;
      if (data) setCategories(data);
    } catch (error: any) {
      console.error('Failed to load categories:', error);
      showAlert('Xatolik', 'Kategoriyalarni yuklashda xatolik yuz berdi');
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadWorkerProfile = async () => {
    if (!user) return;

    try {
      setLoadingProfile(true);

      // Load worker profile
      const { data: worker, error: workerError } = await supabase
        .from('workers')
        .select('*')
        .eq('id', user.id)
        .single();

      if (workerError && workerError.code !== 'PGRST116') {
        console.error('Worker profile error:', workerError);
      }

      if (worker) {
        // Profile exists - edit mode
        setIsEditMode(true);
        setFullName(worker.full_name || '');
        setPhone(worker.phone || '');
        setMinPrice(worker.min_price?.toString() || '200000');
        setMaxPrice(worker.max_price?.toString() || '300000');

        // Load worker categories
        const { data: workerCats, error: catsError } = await supabase
          .from('worker_categories')
          .select('category_id')
          .eq('worker_id', user.id);

        if (catsError) {
          console.error('Worker categories error:', catsError);
        } else if (workerCats) {
          setSelectedCategories(workerCats.map(c => c.category_id));
        }
      }
    } catch (error: any) {
      console.error('Failed to load worker profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleComplete = async () => {
    if (!fullName.trim()) {
      showAlert('Xatolik', 'Ism-familiyani kiriting');
      return;
    }
    if (!phone.trim()) {
      showAlert('Xatolik', 'Telefon raqamni kiriting');
      return;
    }
    if (selectedCategories.length === 0) {
      showAlert('Xatolik', 'Kamida bitta kategoriya tanlang');
      return;
    }
    if (!user) return;

    try {
      setLoading(true);

      // 1. Check if worker profile exists
      const { data: existingWorker } = await supabase
        .from('workers')
        .select('id')
        .eq('id', user.id)
        .single();

      // 2. Create or update worker profile
      if (existingWorker) {
        // Update existing profile
        const { error: workerError } = await supabase
          .from('workers')
          .update({
            full_name: fullName.trim(),
            phone: phone.trim(),
            min_price: parseFloat(minPrice) || 200000,
            max_price: parseFloat(maxPrice) || 300000,
            is_online: true,
          })
          .eq('id', user.id);

        if (workerError) throw workerError;
      } else {
        // Create new profile
        const { error: workerError } = await supabase
          .from('workers')
          .insert({
            id: user.id,
            full_name: fullName.trim(),
            phone: phone.trim(),
            min_price: parseFloat(minPrice) || 200000,
            max_price: parseFloat(maxPrice) || 300000,
            is_online: true,
          });

        if (workerError) throw workerError;
      }

      // 3. Delete old categories
      await supabase
        .from('worker_categories')
        .delete()
        .eq('worker_id', user.id);

      // 4. Add new worker categories
      const categoryInserts = selectedCategories.map(categoryId => ({
        worker_id: user.id,
        category_id: categoryId,
      }));

      const { error: categoryError } = await supabase
        .from('worker_categories')
        .insert(categoryInserts);

      if (categoryError) throw categoryError;

      showAlert(
        'Muvaffaqiyatli!',
        isEditMode 
          ? 'Profil muvaffaqiyatli yangilandi!'
          : 'Ishchi profili saqlandi. Endi buyurtmalarni qabul qilishingiz mumkin.',
        [{ text: 'OK', onPress: () => {
          if (isEditMode) {
            router.back();
          } else {
            router.replace('/worker-dashboard');
          }
        }}]
      );
    } catch (error: any) {
      console.error('Failed to complete onboarding:', error);
      showAlert('Xatolik', error.message || 'Profilni saqlashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {isEditMode ? 'Profilni tahrirlash' : 'Ishchi profili yaratish'}
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Shaxsiy ma'lumotlar
          </Text>
          
          <Input
            value={fullName}
            onChangeText={setFullName}
            placeholder="Ism-familiya"
            editable={!loading}
          />

          <Input
            value={phone}
            onChangeText={setPhone}
            placeholder="Telefon raqam (+998901234567)"
            keyboardType="phone-pad"
            editable={!loading}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Narx oralig'i (so'm/kun)
          </Text>
          
          <View style={styles.priceRow}>
            <View style={styles.priceInput}>
              <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>
                Minimal
              </Text>
              <Input
                value={minPrice}
                onChangeText={setMinPrice}
                placeholder="200000"
                keyboardType="numeric"
                editable={!loading}
              />
            </View>

            <View style={styles.priceInput}>
              <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>
                Maksimal
              </Text>
              <Input
                value={maxPrice}
                onChangeText={setMaxPrice}
                placeholder="300000"
                keyboardType="numeric"
                editable={!loading}
              />
            </View>
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Xizmat ko'rsatish kategoriyalari
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Siz qaysi sohalarda ish qilasiz? (Bir nechta tanlash mumkin)
          </Text>

          {loadingCategories ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <View style={styles.categoriesGrid}>
              {categories.map(category => {
                const isSelected = selectedCategories.includes(category.id);
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.surface,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => toggleCategory(category.id)}
                    activeOpacity={0.7}
                    disabled={loading}
                  >
                    <Text style={styles.categoryIcon}>{category.icon}</Text>
                    <Text
                      style={[
                        styles.categoryName,
                        { color: isSelected ? '#FFFFFF' : theme.text },
                      ]}
                      numberOfLines={2}
                    >
                      {category.name_uz}
                    </Text>
                    {isSelected && (
                      <View style={styles.checkmark}>
                        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Card>

        <Button
          title={isEditMode ? 'Saqlash' : 'Profilni yaratish'}
          onPress={handleComplete}
          loading={loading}
          disabled={loading || loadingCategories || loadingProfile}
          style={styles.completeButton}
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
  section: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    fontWeight: '600',
  },
  sectionSubtitle: {
    ...typography.body,
    marginTop: -spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  priceInput: {
    flex: 1,
  },
  priceLabel: {
    ...typography.small,
    marginBottom: spacing.xs,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  categoryCard: {
    width: '48%',
    aspectRatio: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  categoryIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  categoryName: {
    ...typography.small,
    textAlign: 'center',
    fontWeight: '600',
  },
  checkmark: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  completeButton: {
    marginTop: spacing.md,
  },
});
