import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MapViewComponent } from '../components/feature/MapView';
import { useAlert } from '../components/ui/WebAlert';
import { spacing, typography, borderRadius, rs } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface OrderDetail {
  id: string;
  customer_id: string;
  worker_id: string | null;
  target_company_id: string | null;
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
  order_type: string;
  accepted_workers: string[];
}

interface WorkerProfile {
  id: string;
  full_name: string;
  phone: string;
  rating: number;
  completed_orders: number;
  avatar_url?: string;
  age?: number;
  min_price?: number;
  max_price?: number;
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
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useAlert();

  const orderId = params.orderId as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [customer, setCustomer] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Highlight animation when order updates in real-time
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
      setupRealtimeSubscription();
    }
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [orderId]);

  const triggerHighlight = () => {
    Animated.sequence([
      Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(highlightAnim, { toValue: 0, duration: 700, useNativeDriver: false }),
    ]).start();
  };

  const loadOrderDetails = async () => {
    try {
      setLoading(true);

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      setOrder(orderData);

      // Load customer
      const { data: customerData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', orderData.customer_id)
        .single();
      if (customerData) setCustomer(customerData);

      // Load worker if assigned
      if (orderData.worker_id) {
        const { data: workerData } = await supabase
          .from('workers')
          .select('*')
          .eq('id', orderData.worker_id)
          .single();
        if (workerData) setWorker(workerData);
      } else {
        setWorker(null);
      }
    } catch (error: any) {
      showAlert('Xatolik', "Buyurtma ma'lumotlarini yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`order-detail-rt-${orderId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        async (payload) => {
          if (!payload.new) return;

          const updated = payload.new as OrderDetail;

          // Update order state immediately without reload
          setOrder(prev => prev ? { ...prev, ...updated } : prev);

          // If worker_id changed, load new worker info
          if (updated.worker_id) {
            const { data: workerData } = await supabase
              .from('workers')
              .select('*')
              .eq('id', updated.worker_id)
              .single();
            if (workerData) {
              setWorker(workerData);
              triggerHighlight(); // Flash to alert the user
            }
          } else {
            setWorker(null);
          }
        }
      )
      .subscribe();
  };

  // Customer: reject current worker and reset to pending
  const handleRejectWorker = async () => {
    if (!order || !user) return;

    showAlert(
      'Ishchini bekor qilish',
      "Bu ishchini rad etib, yangi ishchi qidirmoqchimisiz?",
      [
        { text: "Yo'q", style: 'cancel' },
        {
          text: 'Ha, yangi izla',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);

              // Get current rejected list to exclude this worker
              const rejectedBy: string[] = [];
              if (order.worker_id) rejectedBy.push(order.worker_id);

              const { error } = await supabase
                .from('orders')
                .update({
                  status: 'pending',
                  worker_id: null,
                  accepted_workers: [],
                  rejected_by: rejectedBy,
                })
                .eq('id', order.id)
                .eq('customer_id', user.id);

              if (error) throw error;

              // Reset local state immediately
              setOrder(prev => prev ? {
                ...prev,
                status: 'pending',
                worker_id: null,
                accepted_workers: [],
              } : prev);
              setWorker(null);

              showAlert('Bajarildi', "Buyurtma yana kutish holatiga qaytdi. Yangi ishchi qidiring.");
            } catch (err: any) {
              showAlert('Xatolik', err.message || 'Bekor qilishda xatolik');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
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
            .update({ completed_orders: workerData.completed_orders + 1 })
            .eq('id', user.id);
        }

        showAlert('Muvaffaqiyatli!', 'Buyurtma bajarildi');
        loadOrderDetails();
      } catch (error: any) {
        showAlert('Xatolik', 'Buyurtmani yakunlashda xatolik');
      } finally {
        setActionLoading(false);
      }
    };

    showAlert('Tasdiqlash', 'Buyurtma bajarilganini tasdiqlaysizmi?', [
      { text: "Yo'q", style: 'cancel' },
      { text: 'Ha', onPress: completeAction },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':     return '#F59E0B';
      case 'accepted':    return '#3B82F6';
      case 'in_progress': return '#8B5CF6';
      case 'completed':   return '#10B981';
      case 'cancelled':   return '#EF4444';
      default:            return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':     return 'Kutilmoqda';
      case 'accepted':    return 'Qabul qilindi';
      case 'in_progress': return 'Jarayonda';
      case 'completed':   return 'Bajarildi';
      case 'cancelled':   return 'Bekor qilindi';
      default:            return status;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Buyurtma tafsilotlari</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Yuklanmoqda...</Text>
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={[styles.errorText, { color: theme.text }]}>Buyurtma topilmadi</Text>
          <Button title="Orqaga" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const isCustomer = user?.id === order.customer_id;
  const isWorker   = user?.id === order.worker_id;
  const canComplete = order.status === 'accepted' && isWorker;
  const statusColor = getStatusColor(order.status);
  const highlightColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', '#10B98125'],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
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
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusText(order.status)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Order info */}
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
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color={theme.primary} />
              <Text style={[styles.locationText, { color: theme.textSecondary }]} numberOfLines={2}>
                {order.location || `${order.latitude.toFixed(5)}, ${order.longitude.toFixed(5)}`}
              </Text>
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <MapViewComponent
                latitude={order.latitude}
                longitude={order.longitude}
                address={order.location}
                height={200}
              />
            </View>
          </Card>
        )}

        {/* ── WORKER INFO CARD (customer only, auto-updates) ── */}
        {isCustomer && (
          <Animated.View style={{ backgroundColor: highlightColor, borderRadius: borderRadius.lg }}>
            {order.status === 'accepted' && worker ? (
              <Card>
                {/* Header */}
                <View style={styles.workerCardHeader}>
                  <View style={styles.workerCardBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={[styles.workerCardBadgeText, { color: '#10B981' }]}>Ishchi topildi!</Text>
                  </View>
                </View>

                <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: spacing.md }]}>
                  Ishchi ma'lumotlari
                </Text>

                <View style={styles.workerRow}>
                  {/* Avatar */}
                  {worker.avatar_url ? (
                    <Image
                      source={{ uri: worker.avatar_url }}
                      style={styles.workerAvatar}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={[styles.workerAvatar, { backgroundColor: theme.primary + '20', alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="person" size={32} color={theme.primary} />
                    </View>
                  )}

                  {/* Info */}
                  <View style={styles.workerInfoCol}>
                    <Text style={[styles.workerName, { color: theme.text }]}>{worker.full_name}</Text>
                    {worker.age ? (
                      <Text style={[styles.workerAge, { color: theme.textSecondary }]}>{worker.age} yosh</Text>
                    ) : null}
                    <View style={styles.workerMeta}>
                      <Ionicons name="star" size={14} color="#F59E0B" />
                      <Text style={[styles.workerRating, { color: theme.textSecondary }]}>
                        {worker.rating.toFixed(1)} · {worker.completed_orders} ish bajarilgan
                      </Text>
                    </View>
                    {worker.min_price && worker.max_price ? (
                      <Text style={[styles.workerPrice, { color: theme.primary }]}>
                        {worker.min_price.toLocaleString()}–{worker.max_price.toLocaleString()} so'm/kun
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Call button */}
                <TouchableOpacity
                  style={[styles.callBtn, { backgroundColor: '#10B98115', borderColor: '#10B981' }]}
                  onPress={() => Linking.openURL(`tel:${worker.phone}`)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={20} color="#10B981" />
                  <Text style={[styles.callBtnText, { color: '#10B981' }]}>{worker.phone}</Text>
                </TouchableOpacity>

                {/* Reject worker button */}
                <TouchableOpacity
                  style={[styles.rejectWorkerBtn, { borderColor: '#EF4444', backgroundColor: '#EF444410' }]}
                  onPress={handleRejectWorker}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <>
                      <Ionicons name="person-remove" size={18} color="#EF4444" />
                      <Text style={[styles.rejectWorkerText, { color: '#EF4444' }]}>
                        Ishchi yoqmadi — yangi ishchi izlash
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </Card>
            ) : order.status === 'pending' ? (
              <Card>
                <View style={styles.waitingBox}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.waitingTitle, { color: theme.text }]}>Ishchi kutilmoqda...</Text>
                    <Text style={[styles.waitingSub, { color: theme.textSecondary }]}>
                      Ishchi qabul qilgach bu yerda avtomatik ko'rinadi
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}
          </Animated.View>
        )}

        {/* Customer info (visible to assigned worker) */}
        {!isCustomer && order.status !== 'pending' && (
          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Mijoz ma'lumotlari</Text>
            <View style={styles.contactInfo}>
              {customer && (
                <View style={styles.contactRow}>
                  <Ionicons name="person" size={20} color={theme.primary} />
                  <Text style={[styles.contactText, { color: theme.text }]}>{customer.name}</Text>
                </View>
              )}
              {order.customer_phone && (
                <TouchableOpacity
                  style={styles.contactRow}
                  onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}
                >
                  <Ionicons name="call" size={20} color="#10B981" />
                  <Text style={[styles.contactText, { color: '#10B981', fontWeight: '600' }]}>
                    {order.customer_phone}
                  </Text>
                </TouchableOpacity>
              )}
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

        {/* Worker: complete button */}
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: { width: 40 },
  headerTitle: { ...typography.h3, flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  content: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: { ...typography.body },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  errorText: { ...typography.h3 },
  sectionTitle: { ...typography.h4, marginBottom: spacing.sm },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6),
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  statusDot: {
    width: rs(8),
    height: rs(8),
    borderRadius: rs(4),
  },
  statusText: { ...typography.bodyMedium, fontWeight: '600' },
  orderTitle: { ...typography.h3, marginBottom: spacing.sm },
  description: { ...typography.body, lineHeight: 22 },
  imagesContainer: { flexDirection: 'row', gap: spacing.sm },
  imageWrapper: {
    width: 200,
    height: 150,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  orderImage: { width: '100%', height: '100%' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  locationText: { ...typography.body, flex: 1 },
  // Worker card
  workerCardHeader: {
    marginBottom: spacing.sm,
  },
  workerCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#10B98115',
    paddingHorizontal: spacing.sm,
    paddingVertical: rs(4),
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  workerCardBadgeText: {
    ...typography.small,
    fontWeight: '700',
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  workerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    flexShrink: 0,
  },
  workerInfoCol: {
    flex: 1,
    gap: rs(4),
  },
  workerName: { ...typography.bodyMedium, fontWeight: '700', fontSize: 17 },
  workerAge: { ...typography.small },
  workerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4),
  },
  workerRating: { ...typography.small, fontWeight: '500' },
  workerPrice: { ...typography.small, fontWeight: '600' },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    marginBottom: spacing.sm,
    minHeight: 48,
  },
  callBtnText: { ...typography.bodyMedium, fontWeight: '700' },
  rejectWorkerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    minHeight: 48,
  },
  rejectWorkerText: { ...typography.bodyMedium, fontWeight: '600' },
  // Waiting state
  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  waitingTitle: { ...typography.bodyMedium, fontWeight: '600' },
  waitingSub: { ...typography.small, marginTop: rs(2) },
  // Customer info
  contactInfo: { gap: spacing.md },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contactText: { ...typography.body },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  timestampText: { ...typography.caption },
  actionButton: { marginTop: spacing.sm },
});
