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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { useCompanies } from '../hooks/useCompanies';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { spacing, typography, borderRadius } from '../constants/theme';

export default function OrderServiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addOrder } = useCompanies();

  const companyId = params.companyId as string;
  const companyName = params.companyName as string;
  const serviceType = params.serviceType as string;

  const [customerName, setCustomerName] = useState(user?.name || '');
  const [phoneNumber, setPhoneNumber] = useState('+998');
  const [location, setLocation] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitOrder = () => {
    if (!customerName.trim() || !phoneNumber.trim() || !location.trim()) {
      if (Platform.OS === 'web') {
        alert(t.fillAllFields);
      }
      return;
    }
    setShowSummary(true);
  };

  const handleConfirmOrder = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      await addOrder({
        userId: user.id,
        companyId,
        companyName,
        serviceType,
        customerName: customerName.trim(),
        phoneNumber: phoneNumber.trim(),
        location: location.trim(),
        additionalNotes: additionalNotes.trim(),
      });

      setShowSummary(false);
      
      if (Platform.OS === 'web') {
        alert(t.orderSuccess);
      }
      
      router.back();
    } catch (error) {
      console.error('Failed to submit order:', error);
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
          {t.orderForm}
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
            <View style={[styles.companyInfo, { backgroundColor: theme.surfaceVariant }]}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {t.companyName}
              </Text>
              <Text style={[styles.companyName, { color: theme.text }]}>
                {companyName}
              </Text>
              <Text style={[styles.serviceType, { color: theme.primary }]}>
                {serviceType}
              </Text>
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t.yourName}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text }]}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder={t.namePlaceholder}
              placeholderTextColor={theme.textTertiary}
            />
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t.yourPhone}
            </Text>
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
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t.serviceLocation}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surfaceVariant, color: theme.text }]}
              value={location}
              onChangeText={setLocation}
              placeholder={t.locationPlaceholder}
              placeholderTextColor={theme.textTertiary}
            />
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t.additionalNotes}
            </Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.surfaceVariant, color: theme.text }]}
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              placeholder={t.notesPlaceholder}
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Card>

          <Button
            title={t.submitOrder}
            onPress={handleSubmitOrder}
            size="large"
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Summary Modal */}
      <Modal visible={showSummary} transparent animationType="fade" onRequestClose={() => setShowSummary(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {t.orderSummary}
            </Text>
            
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  {t.companyName}:
                </Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {companyName}
                </Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  {t.serviceType}:
                </Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {serviceType}
                </Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  {t.yourName}:
                </Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {customerName}
                </Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  {t.phone}:
                </Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {phoneNumber}
                </Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  {t.location}:
                </Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {location}
                </Text>
              </View>

              {additionalNotes ? (
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                    {t.additionalNotes}:
                  </Text>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>
                    {additionalNotes}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonOutline,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                  isSubmitting && { opacity: 0.5 },
                ]}
                onPress={() => setShowSummary(false)}
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
                onPress={handleConfirmOrder}
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
  companyInfo: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  label: {
    ...typography.small,
    marginBottom: spacing.xs / 2,
  },
  companyName: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.xs / 2,
  },
  serviceType: {
    ...typography.bodyMedium,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  textArea: {
    ...typography.body,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 100,
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
