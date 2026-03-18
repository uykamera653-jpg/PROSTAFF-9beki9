import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAlert } from '../components/ui/WebAlert';
import { spacing, typography, borderRadius } from '../constants/theme';
import { supabase } from '../lib/supabase';

export default function CompanyOnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useAlert();

  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleAddImage = () => {
    // For demo: add placeholder image
    const placeholders = [
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800',
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800',
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800',
    ];
    
    if (images.length < 5) {
      setImages([...images, placeholders[images.length % placeholders.length]]);
    } else {
      showAlert('Ogohlantirish', 'Maksimal 5 ta rasm qo\'shishingiz mumkin');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleCreateProfile = async () => {
    // Validation
    if (!companyName.trim()) {
      showAlert('Xatolik', 'Firma nomini kiriting');
      return;
    }
    if (!phone.trim()) {
      showAlert('Xatolik', 'Telefon raqamini kiriting');
      return;
    }
    if (!description.trim()) {
      showAlert('Xatolik', 'Firma haqida ma\'lumot kiriting');
      return;
    }

    try {
      setIsLoading(true);

      if (!user?.id) {
        showAlert('Xatolik', 'Foydalanuvchi topilmadi');
        return;
      }

      // Check if profile already exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('id', user.id)
        .single();

      if (existingCompany) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            company_name: companyName.trim(),
            description: description.trim(),
            phone: phone.trim(),
            images: images,
            is_online: true,
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Failed to update company profile:', updateError);
          showAlert('Xatolik', `Profilni yangilab bo'lmadi: ${updateError.message}`);
          return;
        }
      } else {
        // Create new profile
        const { error: insertError } = await supabase
          .from('companies')
          .insert({
            id: user.id,
            company_name: companyName.trim(),
            description: description.trim(),
            phone: phone.trim(),
            images: images,
            is_online: true,
            rating: 0,
            completed_orders: 0,
          });

        if (insertError) {
          console.error('Failed to create company profile:', insertError);
          showAlert('Xatolik', `Profil yaratib bo'lmadi: ${insertError.message}`);
          return;
        }
      }

      showAlert('Muvaffaqiyatli', 'Firma profili yaratildi!', [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)/home'),
        },
      ]);
    } catch (error) {
      console.error('Error creating company profile:', error);
      showAlert('Xatolik', 'Profil yaratishda xatolik yuz berdi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Firma profili yaratish</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Firma ma'lumotlari</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Firma nomi *</Text>
            <Input
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Masalan: ProBuild Construction"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Telefon raqam *</Text>
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder="+998 90 123 45 67"
              keyboardType="phone-pad"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Firma haqida *</Text>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Firma faoliyati, xizmatlar haqida ma'lumot..."
              multiline
              numberOfLines={4}
              style={{ minHeight: 100 }}
              editable={!isLoading}
            />
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Firma rasmlari</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Maksimal 5 ta rasm qo'shishingiz mumkin
          </Text>

          <View style={styles.imagesGrid}>
            {images.map((image, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image source={{ uri: image }} style={styles.image} />
                <TouchableOpacity
                  style={[styles.removeButton, { backgroundColor: theme.error }]}
                  onPress={() => handleRemoveImage(index)}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}

            {images.length < 5 && (
              <TouchableOpacity
                style={[styles.addImageButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
                onPress={handleAddImage}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={32} color={theme.textTertiary} />
                <Text style={[styles.addImageText, { color: theme.textSecondary }]}>Rasm qo'shish</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        <Card style={styles.section}>
          <View style={[styles.infoBox, { backgroundColor: theme.surfaceVariant, borderColor: theme.primary }]}>
            <Ionicons name="information-circle" size={24} color={theme.primary} />
            <Text style={[styles.infoText, { color: theme.text }]}>
              Profil yaratilgandan so'ng siz mijozlardan buyurtmalar olishni boshlashingiz mumkin. 
              Online rejimida bo'lganingizda faqat sizning firmangiz ko'rinadi.
            </Text>
          </View>
        </Card>

        <View style={styles.footer}>
          <Button
            title={isLoading ? 'Saqlanmoqda...' : 'Profilni yaratish'}
            onPress={handleCreateProfile}
            disabled={isLoading}
            loading={isLoading}
          />
        </View>
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
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.small,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.small,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  imageContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addImageText: {
    ...typography.small,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
  },
  infoText: {
    ...typography.small,
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    marginBottom: spacing.xxl,
  },
});
