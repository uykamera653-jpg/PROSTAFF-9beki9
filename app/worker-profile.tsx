import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useSettings } from '../hooks/useSettings';
import { useNotificationSettings } from '../hooks/useNotificationSettings';
import { Switch } from 'react-native';
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
  avatar_url?: string;
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
  const { settings: notifSettings, updateSettings: updateNotifSettings, loading: notifLoading } = useNotificationSettings();
  const { user, signOut } = useAuth();

  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
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

  const handleAvatarUpload = async (source: 'gallery' | 'camera') => {
    setShowImagePickerModal(false);
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Ruxsat kerak', 'Kamera uchun ruxsat bering');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Ruxsat kerak', 'Galereya uchun ruxsat bering');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setAvatarUploading(true);

      // Convert image to base64 for upload
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user!.id}/avatar_${Date.now()}.${ext}`;
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, arrayBuffer, { contentType, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(fileName);

      const avatarUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('workers')
        .update({ avatar_url: avatarUrl })
        .eq('id', user!.id);

      if (updateError) throw updateError;

      setWorkerProfile((prev) => prev ? { ...prev, avatar_url: avatarUrl } : prev);
      showAlert('Muvaffaqiyatli', 'Profil rasmi yangilandi!');
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      showAlert('Xatolik', error.message || 'Rasm yuklashda xatolik');
    } finally {
      setAvatarUploading(false);
    }
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
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => setShowImagePickerModal(true)}
            activeOpacity={0.8}
          >
            {workerProfile?.avatar_url ? (
              <Image
                source={{ uri: workerProfile.avatar_url }}
                style={[styles.avatar, { borderRadius: 40 }]}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="person" size={40} color={theme.primary} />
              </View>
            )}
            <View style={[styles.avatarEditBadge, { backgroundColor: theme.primary }]}>
              {avatarUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={14} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          
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

        {/* Notification Settings Card */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Bildirishnoma sozlamalari</Text>

          {/* Master toggle */}
          <View style={[styles.notifRow, { borderBottomColor: theme.border }]}>
            <View style={styles.notifLeft}>
              <View style={[styles.notifIcon, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="notifications" size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={[styles.notifTitle, { color: theme.text }]}>Bildirishnomalar</Text>
                <Text style={[styles.notifSub, { color: theme.textSecondary }]}>Barcha bildirishnomalar</Text>
              </View>
            </View>
            <Switch
              value={notifSettings.enabled}
              onValueChange={(v) => updateNotifSettings({ enabled: v })}
              trackColor={{ false: theme.border, true: theme.primary + '60' }}
              thumbColor={notifSettings.enabled ? theme.primary : theme.textTertiary}
              disabled={notifLoading}
            />
          </View>

          {/* Sound */}
          <View style={[styles.notifRow, { borderBottomColor: theme.border }]}>
            <View style={styles.notifLeft}>
              <View style={[styles.notifIcon, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="volume-high" size={20} color="#F59E0B" />
              </View>
              <View>
                <Text style={[styles.notifTitle, { color: theme.text }]}>Ovoz</Text>
                <Text style={[styles.notifSub, { color: theme.textSecondary }]}>Yangi buyurtma ovozi</Text>
              </View>
            </View>
            <Switch
              value={notifSettings.sound}
              onValueChange={(v) => updateNotifSettings({ sound: v })}
              trackColor={{ false: theme.border, true: '#F59E0B60' }}
              thumbColor={notifSettings.sound ? '#F59E0B' : theme.textTertiary}
              disabled={notifLoading || !notifSettings.enabled}
            />
          </View>

          {/* Volume slider */}
          {notifSettings.sound && notifSettings.enabled && (
            <View style={[styles.volumeRow, { borderBottomColor: theme.border }]}>
              <Ionicons name="volume-low" size={18} color={theme.textSecondary} />
              <View style={[styles.volumeTrack, { backgroundColor: theme.surfaceVariant }]}>
                {[0.25, 0.5, 0.75, 1.0].map((vol) => (
                  <TouchableOpacity
                    key={vol}
                    style={[
                      styles.volumeSegment,
                      { backgroundColor: notifSettings.volume >= vol ? theme.primary : 'transparent' },
                    ]}
                    onPress={() => updateNotifSettings({ volume: vol })}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: notifSettings.volume >= vol ? '#fff' : theme.textSecondary, fontSize: 11, fontWeight: '600' }}>
                      {vol === 1.0 ? '100%' : `${vol * 100}%`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Ionicons name="volume-high" size={18} color={theme.textSecondary} />
            </View>
          )}

          {/* Vibration */}
          <View style={[styles.notifRow, { borderBottomColor: theme.border }]}>
            <View style={styles.notifLeft}>
              <View style={[styles.notifIcon, { backgroundColor: '#8B5CF620' }]}>
                <Ionicons name="phone-portrait" size={20} color="#8B5CF6" />
              </View>
              <View>
                <Text style={[styles.notifTitle, { color: theme.text }]}>Vibratsiya</Text>
                <Text style={[styles.notifSub, { color: theme.textSecondary }]}>Buyurtma kelganda tebranish</Text>
              </View>
            </View>
            <Switch
              value={notifSettings.vibration}
              onValueChange={(v) => updateNotifSettings({ vibration: v })}
              trackColor={{ false: theme.border, true: '#8B5CF660' }}
              thumbColor={notifSettings.vibration ? '#8B5CF6' : theme.textTertiary}
              disabled={notifLoading || !notifSettings.enabled}
            />
          </View>

          {/* New orders */}
          <View style={[styles.notifRow, { borderBottomColor: theme.border }]}>
            <View style={styles.notifLeft}>
              <View style={[styles.notifIcon, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="briefcase" size={20} color="#10B981" />
              </View>
              <View>
                <Text style={[styles.notifTitle, { color: theme.text }]}>Yangi buyurtmalar</Text>
                <Text style={[styles.notifSub, { color: theme.textSecondary }]}>Yangi buyurtma xabardorligi</Text>
              </View>
            </View>
            <Switch
              value={notifSettings.new_orders}
              onValueChange={(v) => updateNotifSettings({ new_orders: v })}
              trackColor={{ false: theme.border, true: '#10B98160' }}
              thumbColor={notifSettings.new_orders ? '#10B981' : theme.textTertiary}
              disabled={notifLoading || !notifSettings.enabled}
            />
          </View>

          {/* Order updates */}
          <View style={[styles.notifRow, { borderBottomColor: 'transparent' }]}>
            <View style={styles.notifLeft}>
              <View style={[styles.notifIcon, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="refresh-circle" size={20} color="#3B82F6" />
              </View>
              <View>
                <Text style={[styles.notifTitle, { color: theme.text }]}>Buyurtma yangilanishlari</Text>
                <Text style={[styles.notifSub, { color: theme.textSecondary }]}>Status o'zgarganda xabar</Text>
              </View>
            </View>
            <Switch
              value={notifSettings.order_updates}
              onValueChange={(v) => updateNotifSettings({ order_updates: v })}
              trackColor={{ false: theme.border, true: '#3B82F660' }}
              thumbColor={notifSettings.order_updates ? '#3B82F6' : theme.textTertiary}
              disabled={notifLoading || !notifSettings.enabled}
            />
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
      {/* Image Picker Modal */}
      <Modal
        visible={showImagePickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImagePickerModal(false)}
      >
        <TouchableOpacity
          style={styles.imagePickerOverlay}
          activeOpacity={1}
          onPress={() => setShowImagePickerModal(false)}
        >
          <View style={[styles.imagePickerSheet, { backgroundColor: theme.surface }]}>
            <Text style={[styles.imagePickerTitle, { color: theme.text }]}>Rasm tanlash</Text>
            <TouchableOpacity
              style={[styles.imagePickerOption, { borderBottomColor: theme.border }]}
              onPress={() => handleAvatarUpload('camera')}
              activeOpacity={0.7}
            >
              <Ionicons name="camera" size={24} color={theme.primary} />
              <Text style={[styles.imagePickerOptionText, { color: theme.text }]}>Kamera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imagePickerOption, { borderBottomColor: 'transparent' }]}
              onPress={() => handleAvatarUpload('gallery')}
              activeOpacity={0.7}
            >
              <Ionicons name="images" size={24} color={theme.primary} />
              <Text style={[styles.imagePickerOptionText, { color: theme.text }]}>Galereya</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imagePickerCancel, { backgroundColor: theme.surfaceVariant }]}
              onPress={() => setShowImagePickerModal(false)}
              activeOpacity={0.7}
            >
              <Text style={[{ color: theme.text, fontWeight: '600', fontSize: 16 }]}>Bekor qilish</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  imagePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  imagePickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  imagePickerTitle: {
    ...typography.h4,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  imagePickerOptionText: {
    ...typography.bodyMedium,
    fontWeight: '500',
    fontSize: 16,
  },
  imagePickerCancel: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
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
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  notifLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  notifSub: {
    ...typography.small,
    marginTop: 2,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  volumeTrack: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    height: 36,
  },
  volumeSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
