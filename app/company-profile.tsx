import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAlert } from '../components/ui/WebAlert';
import { spacing, typography, borderRadius } from '../constants/theme';
import { supabase } from '../lib/supabase';

interface CompanyProfile {
  id: string;
  company_name: string;
  description: string;
  phone: string;
  images: string[];
  is_online: boolean;
  rating: number;
  completed_orders: number;
}

export default function CompanyProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t, language } = useTranslation();
  const { user, logout } = useAuth();
  const { darkMode, setDarkMode, setLanguage } = useSettings();
  const { showAlert, AlertComponent } = useAlert();

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    fetchCompanyProfile();
  }, [user]);

  const fetchCompanyProfile = async () => {
    try {
      setIsLoading(true);
      
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Failed to fetch company profile:', error);
        // Redirect to onboarding if profile not found
        if (error.code === 'PGRST116') {
          router.replace('/company-onboarding');
        }
      } else if (data) {
        setProfile(data);
        setCompanyName(data.company_name);
        setDescription(data.description || '');
        setPhone(data.phone);
        setIsOnline(data.is_online);
      }
    } catch (error) {
      console.error('Error fetching company profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!companyName.trim() || !phone.trim()) {
      showAlert('Xatolik', 'Barcha majburiy maydonlarni to\'ldiring');
      return;
    }

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('companies')
        .update({
          company_name: companyName.trim(),
          description: description.trim(),
          phone: phone.trim(),
          is_online: isOnline,
        })
        .eq('id', user!.id);

      if (error) {
        console.error('Failed to update profile:', error);
        showAlert('Xatolik', `Profilni yangilab bo'lmadi: ${error.message}`);
      } else {
        showAlert('Muvaffaqiyatli', 'Profil yangilandi!');
        fetchCompanyProfile();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showAlert('Xatolik', 'Profilni yangilashda xatolik yuz berdi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Firma profili</Text>
          <View style={{ width: 40 }} />
        </View>
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Firma profili</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Statistika</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{profile?.rating.toFixed(1)}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Reyting</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{profile?.completed_orders}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Bajarilgan</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Firma ma'lumotlari</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Firma nomi *</Text>
            <Input
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Firma nomi"
              editable={!isSaving}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Telefon raqam *</Text>
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder="+998 90 123 45 67"
              keyboardType="phone-pad"
              editable={!isSaving}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Firma haqida</Text>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Firma faoliyati haqida..."
              multiline
              numberOfLines={4}
              style={{ minHeight: 100 }}
              editable={!isSaving}
            />
          </View>

          <View style={[styles.switchRow, { borderTopColor: theme.border }]}>
            <View style={styles.switchLabel}>
              <Ionicons name="globe-outline" size={24} color={theme.text} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: theme.text }]}>Online rejim</Text>
                <Text style={[styles.switchSubtitle, { color: theme.textSecondary }]}>
                  {isOnline ? 'Sizni ko\'rishlari mumkin' : 'Yashirilgan'}
                </Text>
              </View>
            </View>
            <Switch
              value={isOnline}
              onValueChange={setIsOnline}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <Button
            title={isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
            onPress={handleSaveProfile}
            disabled={isSaving}
            loading={isSaving}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {profile?.images && profile.images.length > 0 && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Firma rasmlari</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
              {profile.images.map((image, index) => (
                <Image key={index} source={{ uri: image }} style={styles.profileImage} />
              ))}
            </ScrollView>
          </Card>
        )}

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Sozlamalar</Text>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.border }]}
            onPress={() => setDarkMode(!darkMode)}
            activeOpacity={0.7}
          >
            <Ionicons name="moon-outline" size={24} color={theme.text} />
            <Text style={[styles.menuText, { color: theme.text }]}>Kun/Tun rejimi</Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.border }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={24} color={theme.error} />
            <Text style={[styles.menuText, { color: theme.error }]}>Chiqish</Text>
          </TouchableOpacity>
        </Card>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    fontSize: 32,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.small,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  switchLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  switchTitle: {
    ...typography.bodyMedium,
    marginBottom: spacing.xs / 2,
  },
  switchSubtitle: {
    ...typography.small,
  },
  imagesScroll: {
    flexDirection: 'row',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
  },
  menuText: {
    ...typography.bodyMedium,
    flex: 1,
  },
});
