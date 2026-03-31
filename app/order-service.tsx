import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { LocationPicker } from '../components/feature/LocationPicker';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { spacing, typography, borderRadius } from '../constants/theme';
import { supabase } from '../lib/supabase';

export default function OrderServiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();

  const companyId = params.companyId as string;
  const companyName = params.companyName as string;
  const serviceType = params.serviceType as string;

  const [description, setDescription] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(user?.email ? '' : '+998');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const showNativeAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showNativeAlert('Ruxsat kerak', 'Galereya uchun ruxsat bering');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Image pick error:', e);
    }
  };

  const handleSubmitOrder = () => {
    if (!description.trim()) {
      showNativeAlert('Xatolik', 'Xizmat haqida ma\'lumot kiriting');
      return;
    }
    if (!phoneNumber.trim() || phoneNumber === '+998') {
      showNativeAlert('Xatolik', 'Telefon raqamni kiriting');
      return;
    }
    if (!latitude || !longitude) {
      showNativeAlert('Xatolik', 'Lokatsiyani tanlang');
      return;
    }
    setShowSummary(true);
  };

  const handleConfirmOrder = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Upload image if selected
      let imageUrl: string | null = null;
      if (photoUri) {
        try {
          const fileName = `order_company_${user.id}_${Date.now()}.jpg`;
          const response = await fetch(photoUri);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();

          const { error: uploadError } = await supabase.storage
            .from('order-images')
            .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('order-images')
              .getPublicUrl(fileName);
            imageUrl = urlData.publicUrl;
          }
        } catch (uploadErr) {
          console.warn('Image upload error:', uploadErr);
        }
      }

      // Get any available category for the company order
      const { data: categories } = await supabase
        .from('categories')
        .select('id')
        .limit(1);

      const categoryId = categories?.[0]?.id;
      if (!categoryId) throw new Error('Kategoriya topilmadi');

      const { error } = await supabase.from('orders').insert({
        customer_id: user.id,
        target_company_id: companyId,
        order_type: 'company',
        category_id: categoryId,
        title: serviceType || 'Xizmat buyurtmasi',
        description: description.trim(),
        location: location.trim() || 'Manzil ko\'rsatilmagan',
        latitude,
        longitude,
        images: imageUrl ? [imageUrl] : [],
        customer_phone: phoneNumber.trim(),
        status: 'pending',
      });

      if (error) throw error;

      setShowSummary(false);
      showNativeAlert('Muvaffaqiyatli!', 'Buyurtmangiz firmaga yuborildi');
      router.replace('/(tabs)/my-ads');
    } catch (error: any) {
      console.error('Failed to submit order:', error);
      showNativeAlert('Xatolik', error.message || 'Buyurtmani yuborishda xatolik');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {companyName || 'Xizmat buyurtmasi'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Company Info */}
          <Card>
            <View style={[styles.companyInfo, { backgroundColor: theme.primary + '10', borderRadius: borderRadius.md }]}>
              <View style={[styles.companyIconBox, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="business" size={28} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.companyNameText, { color: theme.text }]}>{companyName}</Text>
                {serviceType ? (
                  <Text style={[styles.serviceTypeText, { color: theme.primary }]}>{serviceType}</Text>
                ) : null}
              </View>
            </View>
          </Card>

          {/* Description */}
          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Xizmat haqida ma'lumot *
            </Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.surfaceVariant, color: theme.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Qanday xizmat kerak? Batafsil yozing..."
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </Card>

          {/* Photo */}
          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Rasm yuklash (ixtiyoriy)</Text>
            <TouchableOpacity
              style={[styles.imageUpload, { backgroundColor: theme.surfaceVariant, borderColor: photoUri ? theme.primary : theme.border }]}
              onPress={handlePickImage}
              activeOpacity={0.8}
            >
              {photoUri ? (
                <>
                  <Image source={{ uri: photoUri }} style={styles.uploadedImage} contentFit="cover" />
                  <TouchableOpacity
                    style={[styles.removeImageBtn, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
                    onPress={() => setPhotoUri(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="image-outline" size={44} color={theme.textTertiary} />
                  <Text style={[styles.uploadText, { color: theme.textSecondary }]}>
                    Rasm tanlash
                  </Text>
                  <Text style={[styles.uploadHint, { color: theme.textTertiary }]}>
                    Galereyadan rasm tanlang
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Card>

          {/* Phone */}
          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Telefon raqam *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text }]}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+998 90 123 45 67"
              placeholderTextColor={theme.textTertiary}
              keyboardType="phone-pad"
            />
          </Card>

          {/* Location */}
          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Joylashuv *</Text>
            <TouchableOpacity
              style={[
                styles.locationButton,
                {
                  backgroundColor: latitude ? theme.primary + '10' : theme.surfaceVariant,
                  borderColor: latitude ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setShowLocationPicker(true)}
              activeOpacity={0.8}
            >
              {latitude && longitude ? (
                <View style={styles.selectedLocation}>
                  <View style={[styles.locationIconBox, { backgroundColor: theme.primary + '20' }]}>
                    <Ionicons name="location" size={22} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.selectedLocationText, { color: theme.text }]} numberOfLines={2}>
                      {location || 'Joylashuv tanlandi'}
                    </Text>
                    <Text style={[styles.coordinates, { color: theme.textTertiary }]}>
                      {latitude.toFixed(6)}, {longitude.toFixed(6)}
                    </Text>
                  </View>
                  <Ionicons name="pencil" size={18} color={theme.primary} />
                </View>
              ) : (
                <>
                  <View style={[styles.locationIconBox, { backgroundColor: theme.surfaceVariant }]}>
                    <Ionicons name="location-outline" size={28} color={theme.textTertiary} />
                  </View>
                  <Text style={[styles.locationPlaceholder, { color: theme.textSecondary }]}>
                    Xaritadan joylashuvni belgilang
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
                </>
              )}
            </TouchableOpacity>
          </Card>

          <Button
            title="Buyurtmani ko'rib chiqish"
            onPress={handleSubmitOrder}
            size="large"
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Location Picker */}
      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationSelect={(coords, address) => {
          setLatitude(coords.latitude);
          setLongitude(coords.longitude);
          setLocation(address || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
          setShowLocationPicker(false);
        }}
        initialLocation={latitude && longitude ? { latitude, longitude } : undefined}
      />

      {/* Summary Modal */}
      <Modal visible={showSummary} transparent animationType="fade" onRequestClose={() => setShowSummary(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Buyurtma ma'lumotlari</Text>
              <TouchableOpacity onPress={() => setShowSummary(false)} disabled={isSubmitting}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Company */}
              <View style={[styles.summaryCompany, { backgroundColor: theme.primary + '10', borderRadius: borderRadius.md }]}>
                <Ionicons name="business" size={20} color={theme.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.summaryCompanyName, { color: theme.text }]}>{companyName}</Text>
                  {serviceType ? (
                    <Text style={[{ color: theme.primary, fontSize: 13 }]}>{serviceType}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>📝 Xizmat haqida</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>{description}</Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>📞 Telefon</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>{phoneNumber}</Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>📍 Joylashuv</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {location || `${latitude?.toFixed(5)}, ${longitude?.toFixed(5)}`}
                </Text>
              </View>

              {photoUri ? (
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>🖼️ Rasm</Text>
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.summaryImage}
                    contentFit="cover"
                    transition={200}
                  />
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: theme.border, borderWidth: 1.5 }]}
                onPress={() => setShowSummary(false)}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Tahrirlash</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.primary }, isSubmitting && { opacity: 0.7 }]}
                onPress={handleConfirmOrder}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>Yuborish</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: { width: 40 },
  headerTitle: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: { width: 40 },
  keyboardView: { flex: 1 },
  content: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  companyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  companyIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyNameText: {
    ...typography.h4,
    fontWeight: '700',
  },
  serviceTypeText: {
    ...typography.bodyMedium,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.h4,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  textArea: {
    ...typography.body,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 120,
    lineHeight: 22,
  },
  imageUpload: {
    height: 180,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    ...typography.bodyMedium,
    fontWeight: '500',
  },
  uploadHint: {
    ...typography.small,
  },
  input: {
    ...typography.body,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  locationButton: {
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locationIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  selectedLocationText: {
    ...typography.bodyMedium,
    fontWeight: '500',
    marginBottom: spacing.xs / 2,
  },
  locationPlaceholder: {
    ...typography.bodyMedium,
    flex: 1,
  },
  coordinates: {
    ...typography.caption,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  submitButton: { marginTop: spacing.md },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  modalScroll: { maxHeight: 400 },
  summaryCompany: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryCompanyName: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  summaryItem: { marginBottom: spacing.md },
  summaryLabel: {
    ...typography.small,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    ...typography.bodyMedium,
    lineHeight: 22,
  },
  summaryImage: {
    width: '100%',
    height: 140,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: 48,
  },
  modalBtnText: {
    ...typography.bodyMedium,
    fontWeight: '700',
    fontSize: 15,
  },
});
