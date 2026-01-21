import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { useJobs } from '../hooks/useJobs';
import { GenderSelector } from '../components/feature/GenderSelector';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { spacing, typography, borderRadius } from '../constants/theme';

export default function PostJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const { addJob } = useJobs();

  const category = params.category as string;

  const [gender, setGender] = useState<'male' | 'female' | 'any'>('any');
  const [description, setDescription] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+998');
  const [location, setLocation] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [showSummary, setShowSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };



  const handlePostAd = () => {
    if (!description.trim()) {
      if (Platform.OS === 'web') {
        alert('Ish haqida ma\'lumot kiriting');
      } else {
        Alert.alert(t.appName, 'Ish haqida ma\'lumot kiriting');
      }
      return;
    }
    setShowSummary(true);
  };

  const handleConfirmAd = async () => {
    setIsSubmitting(true);
    
    try {
      let currentUser = user;
      
      // Ensure user is logged in
      if (!currentUser) {
        await login('demo@prostaff.uz');
        // Get fresh user state - wait a bit for state to update
        await new Promise(resolve => setTimeout(resolve, 300));
        // Try to get user from AsyncStorage
        const userJson = await AsyncStorage.getItem('user');
        if (userJson) {
          currentUser = JSON.parse(userJson);
        }
      }

      if (!currentUser) {
        throw new Error('User not found after login');
      }
      
      // Add job to context
      await addJob({
        userId: currentUser.id,
        category,
        gender,
        description: description.trim(),
        phoneNumber: phoneNumber.trim() || '+998',
        location: location.trim() || 'Manzil ko\'rsatilmagan',
        photoUri,
      });
      
      // Close modal
      setShowSummary(false);
      
      // Navigate to worker search screen
      router.push({
        pathname: '/worker-search',
        params: { 
          category,
          jobAdId: Date.now().toString(),
        },
      });
    } catch (error) {
      console.error('Failed to post ad:', error);
      if (Platform.OS === 'web') {
        alert('Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
      } else {
        Alert.alert(t.appName, 'Xatolik yuz berdi');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t[category as keyof typeof t] as string}
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
          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.selectGender}</Text>
            <GenderSelector
              selected={gender}
              onSelect={setGender}
              labels={{ male: t.male, female: t.female, any: t.any }}
            />
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.jobDescription}</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.surfaceVariant, color: theme.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder={t.descriptionPlaceholder}
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.uploadPhoto}</Text>
            <TouchableOpacity
              style={[styles.imageUpload, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
              onPress={handlePickImage}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.uploadedImage} contentFit="cover" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={48} color={theme.textTertiary} />
                  <Text style={[styles.uploadText, { color: theme.textSecondary }]}>
                    {t.uploadPhoto}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.phoneNumber}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text }]}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder={t.phonePlaceholder}
              placeholderTextColor={theme.textTertiary}
              keyboardType="phone-pad"
            />
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.address} ({t.optional})</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text }]}
              value={location}
              onChangeText={setLocation}
              placeholder={t.locationPlaceholder}
              placeholderTextColor={theme.textTertiary}
            />
          </Card>

          <Button title={t.postAd} onPress={handlePostAd} style={styles.submitButton} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Summary Modal */}
      <Modal visible={showSummary} transparent animationType="fade" onRequestClose={() => setShowSummary(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t.orderSummary}</Text>
            
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t.category}:</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {t[category as keyof typeof t] as string}
                </Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t.gender}:</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {t[gender as keyof typeof t] as string}
                </Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t.description}:</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {description}
                </Text>
              </View>

              {phoneNumber && phoneNumber !== '+998' && (
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t.phone}:</Text>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>{phoneNumber}</Text>
                </View>
              )}

              {location && (
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t.location}:</Text>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>{location}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonOutline,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                  isSubmitting && { opacity: 0.5 },
                ]}
                onPress={() => {
                  console.log('❌ Cancel button pressed');
                  setShowSummary(false);
                }}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>{t.cancel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  { backgroundColor: theme.primary },
                  isSubmitting && { opacity: 0.7 },
                ]}
                onPress={() => {
                  console.log('✅ Confirm button pressed - calling handleConfirmAd');
                  handleConfirmAd();
                }}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>{t.sendAd}</Text>
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
  placeholder: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.md,
  },
  textArea: {
    ...typography.body,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 120,
  },
  imageUpload: {
    height: 200,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
  },
  uploadText: {
    ...typography.bodyMedium,
  },
  input: {
    ...typography.body,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  submitButton: {
    marginTop: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    ...typography.h2,
    marginBottom: spacing.lg,
  },
  modalScroll: {
    maxHeight: 400,
  },
  summaryItem: {
    marginBottom: spacing.md,
  },
  summaryLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    ...typography.bodyMedium,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  modalButtonPrimary: {
    // backgroundColor set dynamically
  },
  modalButtonText: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },

});
