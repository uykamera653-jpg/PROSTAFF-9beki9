import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { useWorkers } from '../hooks/useWorkers';
import { WorkerCard } from '../components/feature/WorkerCard';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { spacing, typography } from '../constants/theme';
import { Worker } from '../types';
import { supabase } from '../lib/supabase';

export default function WorkerSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { getWorkersByCategory, hireWorkers } = useWorkers();

  const category = params.category as string;
  const orderId = params.orderId as string;

  const [isSearching, setIsSearching] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [orderStatus, setOrderStatus] = useState<string>('pending');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(600); // 10 minutes in seconds
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  // Subscribe to order status changes
  useEffect(() => {
    if (!orderId) {
      console.warn('⚠️ No orderId provided');
      return;
    }

    console.log('🔍 Monitoring order:', orderId);

    // Initial order fetch
    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('status, expires_at, worker_id')
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('❌ Failed to fetch order:', error);
        return;
      }

      console.log('📦 Order data:', data);
      setOrderStatus(data.status);
      setExpiresAt(data.expires_at);

      // If already accepted, stop searching
      if (data.status === 'accepted' && data.worker_id) {
        setIsSearching(false);
      }
    };

    fetchOrder();

    // Real-time subscription
    const subscription = supabase
      .channel(`order:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          console.log('🔔 Order updated:', payload.new);
          const newStatus = (payload.new as any).status;
          const newWorkerId = (payload.new as any).worker_id;

          setOrderStatus(newStatus);

          if (newStatus === 'accepted' && newWorkerId) {
            setIsSearching(false);
            
            if (Platform.OS === 'web') {
              alert('✅ Ishchi topildi! Ma\'lumotlarni ko\'ring.');
            } else {
              Alert.alert(t.appName, '✅ Ishchi topildi! Ma\'lumotlarni ko\'ring.');
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [orderId]);

  // Timer countdown
  useEffect(() => {
    if (!expiresAt || orderStatus !== 'pending') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const expiry = new Date(expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));

      setTimeRemaining(remaining);

      if (remaining === 0) {
        // Time expired
        setIsSearching(false);
        setShowExpiredModal(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, orderStatus]);

  // Initial worker search simulation
  useEffect(() => {
    const searchTimeout = setTimeout(() => {
      setIsSearching(false);
    }, 3000);

    return () => clearTimeout(searchTimeout);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTryAgain = () => {
    setShowExpiredModal(false);
    router.back();
  };

  const handleGoHome = () => {
    setShowExpiredModal(false);
    router.push('/(tabs)/home');
  };

  if (isSearching) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {t[category as keyof typeof t] as string}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.searchingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.searchingText, { color: theme.text }]}>
            {t.searchingWorkers}
          </Text>
          <Text style={[styles.searchingSubtext, { color: theme.textSecondary }]}>
            {t.availableWorkers}
          </Text>
          
          {/* Timer */}
          <View style={[styles.timerContainer, { backgroundColor: theme.surfaceVariant }]}>
            <Ionicons name="time-outline" size={20} color={theme.primary} />
            <Text style={[styles.timerText, { color: theme.text }]}>
              {formatTime(timeRemaining)}
            </Text>
          </View>
          <Text style={[styles.timerHint, { color: theme.textTertiary }]}>
            Qolgan vaqt
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {orderStatus === 'pending' ? 'Ishchi kutilmoqda...' : 'Buyurtma holati'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.waitingContainer}>
        {orderStatus === 'pending' ? (
          <>
            <ActivityIndicator size="large" color={theme.primary} style={{ marginBottom: spacing.lg }} />
            <Ionicons name="hourglass-outline" size={64} color={theme.textTertiary} />
            <Text style={[styles.waitingTitle, { color: theme.text }]}>
              Ishchilar qidirilmoqda...
            </Text>
            <Text style={[styles.waitingSubtitle, { color: theme.textSecondary }]}>
              Eng yaqin online ishchilarga xabar yuborildi
            </Text>
            
            <View style={[styles.timerContainer, { backgroundColor: theme.surfaceVariant }]}>
              <Ionicons name="time-outline" size={24} color={theme.primary} />
              <Text style={[styles.timerText, { color: theme.text }]}>
                {formatTime(timeRemaining)}
              </Text>
            </View>
            <Text style={[styles.timerHint, { color: theme.textTertiary }]}>
              Qolgan vaqt
            </Text>
          </>
        ) : orderStatus === 'accepted' ? (
          <>
            <Ionicons name="checkmark-circle" size={64} color={theme.success} />
            <Text style={[styles.waitingTitle, { color: theme.success }]}>
              Ishchi topildi!
            </Text>
            <Text style={[styles.waitingSubtitle, { color: theme.textSecondary }]}>
              Ishchi ma'lumotlarini "Mening e'lonlarim" bo'limida ko'ring
            </Text>
            <Button
              title="Mening e'lonlarimga o'tish"
              onPress={() => router.push('/(tabs)/my-ads')}
              style={{ marginTop: spacing.xl }}
            />
          </>
        ) : null}
      </View>

      {/* Expired Modal */}
      <Modal visible={showExpiredModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.expiredIconContainer}>
              <Ionicons name="time-outline" size={64} color={theme.error} />
            </View>
            
            <Text style={[styles.expiredTitle, { color: theme.text }]}>
              Muddati tugadi
            </Text>
            <Text style={[styles.expiredMessage, { color: theme.textSecondary }]}>
              Afsuski, 10 minut ichida hech qanday ishchi topilmadi. Keyinroq qayta urinib ko'ring yoki boshqa kategoriyani tanlang.
            </Text>

            <View style={styles.expiredButtons}>
              <Button
                title="Qayta urinish"
                onPress={handleTryAgain}
                variant="outline"
              />
              <Button
                title="Bosh sahifa"
                onPress={handleGoHome}
              />
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
  searchingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  searchingText: {
    ...typography.h3,
    marginTop: spacing.md,
  },
  searchingSubtext: {
    ...typography.body,
  },
  waitingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  waitingTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  waitingSubtitle: {
    ...typography.body,
    textAlign: 'center',
    maxWidth: 300,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginTop: spacing.xl,
  },
  timerText: {
    ...typography.h2,
    fontSize: 28,
    fontWeight: '700',
  },
  timerHint: {
    ...typography.caption,
  },
  expiredIconContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  expiredTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  expiredMessage: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  expiredButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl + 80,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  footerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  footerLabel: {
    ...typography.bodyMedium,
  },
  footerTotal: {
    ...typography.h3,
  },
  confirmButton: {
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    padding: spacing.xl,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    ...typography.h2,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalBody: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  workerSummary: {
    padding: spacing.md,
  },
  workerSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  workerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerSummaryInfo: {
    flex: 1,
  },
  workerSummaryName: {
    ...typography.bodyMedium,
    marginBottom: 2,
  },
  workerSummaryDetail: {
    ...typography.small,
  },
  workerSummaryPrice: {
    ...typography.h3,
    fontSize: 16,
  },
  workerSummaryContact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  workerSummaryPhone: {
    ...typography.caption,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
  },
  totalLabel: {
    ...typography.bodyMedium,
  },
  totalAmount: {
    ...typography.h2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
