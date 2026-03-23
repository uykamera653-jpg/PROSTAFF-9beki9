import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MapViewComponent } from '../components/feature/MapView';
import { useAlert } from '../components/ui/WebAlert';
import { spacing, typography, borderRadius } from '../constants/theme';
import { supabase } from '../lib/supabase';

interface OrderDetail {
  id: string;
  customer_id: string;
  worker_id: string | null;
  category_id: string;
  title: string;
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  images: string[];
  status: string;
  customer_phone: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkerProfile {
  id: string;
  full_name: string;
  phone: string;
  rating: number;
  completed_orders: number;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useAlert();

  const orderId = params.orderId as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [customer, setCustomer] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
      setupRealtimeSubscription();
    }
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);

      // Load order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      setOrder(orderData);

      // Load customer profile
      const { data: customerData, error: customerError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', orderData.customer_id)
        .single();

      if (customerError) {
        console.warn('Customer profile not found:', customerError);
      } else {
        setCustomer(customerData);
      }

      // Load worker profile if assigned
      if (orderData.worker_id) {
        const { data: workerData, error: workerError } = await supabase
          .from('workers')
          .select('*')
          .eq('id', orderData.worker_id)
          .single();

        if (workerError) {
          console.warn('Worker profile not found:', workerError);
        } else {
          setWorker(workerData);
        }
      }
    } catch (error: any) {
      console.error('Failed to load order details:', error);
      showAlert('Xatolik', 'Buyurtma ma\'lumotlarini yuklab bo\'lmadi');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const subscription = supabase
      .channel(`order-detail:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        () => {
          loadOrderDetails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  };

  const handleAcceptOrder = async () => {
    if (!user || !order) return;

    try {
      setActionLoading(true);

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'accepted',
          worker_id: user.id,
        })
        .eq('id', orderId);

      if (error) throw error;

      showAlert('Muvaffaqiyatli!', 'Buyurtma qabul qilindi');
      loadOrderDetails();
    } catch (error: any) {
      console.error('Failed to accept order:', error);
      showAlert('Xatolik', error.message || 'Buyurtmani qabul qilishda xatolik');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (!user || !order) return;

    const completeAction = async () => {
      try {
        setActionLoading(true);

        const { error } = await supabase
          .from('orders')
          .update({ status: 'completed' })
          .eq('id', orderId);

        if (error) throw error;

        // Update worker stats
        const { data: workerData } = await supabase
          .from('workers')
          .select('completed_orders')
          .eq('id', user.id)
          .single();

        if (workerData) {
          await supabase
            .from('workers')
            .update({
              completed_orders: workerData.completed_orders + 1,
            })
            .eq('id', user.id);
        }

        showAlert('Muvaffaqiyatli!', 'Buyurtma bajarildi');
        loadOrderDetails();
      } catch (error: any) {
        console.error('Failed to complete order:', error);
        showAlert('Xatolik', 'Buyurtmani yakunlashda xatolik');
      } finally {
        setActionLoading(false);
      }
    };

    showAlert('Tasdiqlash', 'Buyurtma bajarilganini tasdiqlaysizmi?', [
      { text: 'Yo\'q', style: 'cancel' },
      { text: 'Ha', onPress: completeAction },
    ]);
  };

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return theme.warning;
      case 'accepted':
        return theme.primary;
      case 'in_progress':
        return theme.info;
      case 'completed':
        return theme.success;
      case 'cancelled':
        return theme.error;
      default:
        return theme.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Kutilmoqda';
      case 'accepted':
        return 'Qabul qilindi';
      case 'in_progress':
        return 'Jarayonda';
      case 'completed':
        return 'Bajarildi';
      case 'cancelled':
        return 'Bekor qilindi';
      default:
        return status;
    }
  };

  if (loading) {
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Buyurtma tafsilotlari</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Yuklanmoqda...
          </Text>
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.text }]}>Buyurtma topilmadi</Text>
          <Button title="Orqaga" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const isCustomer = user?.id === order.customer_id;
  const isWorker = user?.id === order.worker_id;
  const canAccept = order.status === 'pending' && !isCustomer;
  const canComplete = order.status === 'accepted' && isWorker;

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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Buyurtma tafsilotlari</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status */}
        <Card>
          <View style={styles.statusContainer}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Holat</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(order.status) + '15' },
              ]}
            >
              <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                {getStatusText(order.status)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Category & Description */}
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Buyurtma</Text>
          <Text style={[styles.orderTitle, { color: theme.primary }]}>{order.title}</Text>
          <Text style={[styles.description, { color: theme.text }]}>{order.description}</Text>
        </Card>

        {/* Images */}
        {order.images && order.images.length > 0 && (
          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Rasmlar</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.imagesContainer}>
                {order.images.map((imageUrl, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.orderImage}
                      contentFit="cover"
                      transition={200}
                    />
                  </View>
                ))}
              </View>
            </ScrollView>
          </Card>
        )}

        {/* Location */}
        {order.latitude && order.longitude && (
          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Manzil</Text>
            <MapViewComponent
              latitude={order.latitude}
              longitude={order.longitude}
              address={order.location}
              height={200}
            />
          </Card>
        )}

        {/* Customer Info (visible to worker) */}
        {!isCustomer && order.status !== 'pending' && (
          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Mijoz ma'lumotlari</Text>
            <View style={styles.contactInfo}>
              {customer && (
                <View style={styles.contactRow}>
                  <Ionicons name="person" size={20} color={theme.primary} />
                  <Text style={[styles.contactText, { color: theme.text }]}>
                    {customer.name}
                  </Text>
                </View>
              )}
              {order.customer_phone && (
                <TouchableOpacity
                  style={styles.contactRow}
                  onPress={() => handleCall(order.customer_phone!)}
                >
                  <Ionicons name="call" size={20} color={theme.success} />
                  <Text style={[styles.contactText, { color: theme.success, fontWeight: '600' }]}>
                    {order.customer_phone}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        )}

        {/* Worker Info (visible to customer) */}
        {isCustomer && worker && order.status !== 'pending' && (
          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Ishchi ma'lumotlari</Text>
            <View style={styles.workerInfo}>
              <View style={styles.workerHeader}>
                <View style={[styles.workerAvatar, { backgroundColor: theme.primary }]}>
                  <Text style={styles.avatarText}>
                    {worker.full_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.workerDetails}>
                  <Text style={[styles.workerName, { color: theme.text }]}>
                    {worker.full_name}
                  </Text>
                  <View style={styles.workerStats}>
                    <Ionicons name="star" size={14} color={theme.warning} />
                    <Text style={[styles.workerRating, { color: theme.textSecondary }]}>
                      {worker.rating.toFixed(1)} · {worker.completed_orders} buyurtma
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.callButton, { backgroundColor: theme.success }]}
                onPress={() => handleCall(worker.phone)}
              >
                <Ionicons name="call" size={20} color="#FFFFFF" />
                <Text style={styles.callButtonText}>{worker.phone}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Timestamps */}
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Vaqt</Text>
          <View style={styles.timestampRow}>
            <Ionicons name="calendar" size={16} color={theme.textSecondary} />
            <Text style={[styles.timestampText, { color: theme.textSecondary }]}>
              Yaratildi: {new Date(order.created_at).toLocaleString('uz-UZ')}
            </Text>
          </View>
          <View style={styles.timestampRow}>
            <Ionicons name="time" size={16} color={theme.textSecondary} />
            <Text style={[styles.timestampText, { color: theme.textSecondary }]}>
              Yangilandi: {new Date(order.updated_at).toLocaleString('uz-UZ')}
            </Text>
          </View>
        </Card>

        {/* Actions */}
        {canAccept && (
          <Button
            title="Buyurtmani qabul qilish"
            onPress={handleAcceptOrder}
            loading={actionLoading}
            style={styles.actionButton}
          />
        )}
        {canComplete && (
          <Button
            title="Bajarildi deb belgilash"
            onPress={handleCompleteOrder}
            loading={actionLoading}
            variant="outline"
            style={styles.actionButton}
          />
        )}

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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  errorText: {
    ...typography.h3,
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: spacing.sm,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  statusText: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  orderTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    lineHeight: 22,
  },
  imagesContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  imageWrapper: {
    width: 200,
    height: 150,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  orderImage: {
    width: '100%',
    height: '100%',
  },
  contactInfo: {
    gap: spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contactText: {
    ...typography.body,
  },
  workerInfo: {
    gap: spacing.md,
  },
  workerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  workerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.h3,
    color: '#FFFFFF',
  },
  workerDetails: {
    flex: 1,
  },
  workerName: {
    ...typography.bodyMedium,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  workerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  workerRating: {
    ...typography.small,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  callButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  timestampText: {
    ...typography.caption,
  },
  actionButton: {
    marginTop: spacing.sm,
  },
});
