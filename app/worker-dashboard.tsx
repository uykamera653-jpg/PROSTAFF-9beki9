import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Switch,
  Platform,
  Alert,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { playNotificationSound } from '../services/sound-service';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { useNotificationSettings } from '../hooks/useNotificationSettings';
import { useUserRole } from '../hooks/useUserRole';
import { useNotifications } from '../hooks/useNotifications';
import { Image } from 'expo-image';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAlert } from '../components/ui/WebAlert';
import { LocationPicker } from '../components/feature/LocationPicker';
import { spacing, typography, borderRadius, rs, rf } from '../constants/theme';
import { supabase } from '../lib/supabase';

type OrderStatus = 'pending' | 'accepted' | 'in_progress' | 'completed';

interface WorkerOrder {
  id: string;
  category_id: string;
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  customer_phone?: string;
  status: OrderStatus;
  created_at: string;
  customer_id: string;
  worker_id?: string;
  distance?: number;
  customer_name?: string;
}

interface WorkerLocation {
  latitude: number;
  longitude: number;
}

interface WorkerProfile {
  id: string;
  full_name: string;
  phone: string;
  rating: number;
  completed_orders: number;
  is_online: boolean;
  avatar_url?: string;
}

export default function WorkerDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();

  const [selectedTab, setSelectedTab] = useState<OrderStatus>('pending');
  const [orders, setOrders] = useState<WorkerOrder[]>([]);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workerLocation, setWorkerLocation] = useState<WorkerLocation | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [orderTimers, setOrderTimers] = useState<{ [orderId: string]: number }>({});
  const { showAlert, AlertComponent } = useAlert();
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const loadOrdersRef = useRef<() => void>(() => {});
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Push notifications
  const { settings: notifSettings } = useNotificationSettings();
  const { expoPushToken, isLoading: notifLoading, error: notifError } = useNotifications(user?.id || null);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    if (!roleLoading && role && role !== 'worker') {
      router.replace(role === 'customer' ? '/(tabs)/home' : role === 'company' ? '/company-dashboard' : '/admin-panel');
    }
  }, [role, roleLoading]);

  // Check worker profile and get location on mount
  useEffect(() => {
    if (user && !roleLoading && role === 'worker') {
      checkWorkerProfile();
    }
  }, [user, role, roleLoading]);

  // Keep loadOrdersRef always pointing to the latest loadOrders
  useEffect(() => {
    loadOrdersRef.current = loadOrders;
  });

  // 30-second timer for pending orders
  useEffect(() => {
    if (selectedTab !== 'pending' || orders.length === 0) return;

    const interval = setInterval(() => {
      setOrderTimers((prev) => {
        const updated = { ...prev };
        orders.forEach((order) => {
          const orderId = order.id;
          const createdAt = new Date(order.created_at).getTime();
          const now = Date.now();
          const elapsed = Math.floor((now - createdAt) / 1000);
          const remaining = Math.max(0, 300 - elapsed);
          updated[orderId] = remaining;

          // Auto-reject when timer expires (5 minutes)
          if (remaining === 0 && prev[orderId] !== 0) {
            handleRejectOrder(orderId, true); // silent reject
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedTab, orders]);

  // Load orders when tab changes
  useEffect(() => {
    if (workerProfile && isOnline) {
      loadOrders();
    }
  }, [selectedTab]);

  // Setup realtime subscription ONCE when worker goes online — independent of selectedTab
  useEffect(() => {
    if (workerProfile && isOnline) {
      loadOrders();
      const cleanup = setupRealtimeSubscription();
      startLocationTracking();
      return () => {
        cleanup();
        stopLocationTracking();
      };
    } else if (workerProfile && !isOnline) {
      setOrders([]);
      stopLocationTracking();
    }
  }, [workerProfile, isOnline]);

  const checkWorkerProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('workers').select('*').eq('id', user!.id).single();
      if (error) {
        if (error.code === 'PGRST116') router.replace('/worker-onboarding');
        else showAlert('Xatolik', 'Profil yuklanmadi');
        return;
      }
      if (data) {
        setWorkerProfile(data);
        setIsOnline(data.is_online);
        if (data.latitude && data.longitude) setWorkerLocation({ latitude: data.latitude, longitude: data.longitude });
      }
    } catch {
      showAlert('Xatolik', 'Profil yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    if (!user?.id) return;
    try {
      setRefreshing(true);
      const { data: workerCats, error: catsError } = await supabase
        .from('worker_categories')
        .select('category_id')
        .eq('worker_id', user.id);

      if (catsError) throw catsError;

      const categoryIds = workerCats?.map(c => c.category_id) || [];
      if (categoryIds.length === 0) {
        setOrders([]);
        setRefreshing(false);
        return;
      }

      // Load orders based on selected tab
      let query = supabase
        .from('orders')
        .select('*')
        .in('category_id', categoryIds);

      if (selectedTab === 'pending') {
        query = query.eq('status', 'pending').eq('order_type', 'worker');
      } else {
        query = query.eq('worker_id', user.id).eq('status', selectedTab);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      let filteredData = data || [];
      if (selectedTab === 'pending' && data) {
        filteredData = data.filter(order => {
          const rejectedBy = Array.isArray(order.rejected_by) ? order.rejected_by : [];
          return !rejectedBy.includes(user.id);
        });
      }

      // Fetch customer profiles for accepted/in_progress orders
      if (selectedTab !== 'pending' && filteredData.length > 0) {
        const customerIds = [...new Set(filteredData.map(o => o.customer_id).filter(Boolean))];
        if (customerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, name')
            .in('id', customerIds);
          const profileMap: Record<string, string> = {};
          (profiles || []).forEach((p: any) => { profileMap[p.id] = p.name; });
          filteredData = filteredData.map(o => ({ ...o, customer_name: profileMap[o.customer_id] || '' }));
        }
      }
      
      // Calculate distance for pending orders if worker location available
      let processedOrders = filteredData;
      if (selectedTab === 'pending' && workerLocation && filteredData.length > 0) {
        processedOrders = filteredData
          .map(order => {
            if (order.latitude && order.longitude) {
              const distance = calculateDistance(
                workerLocation.latitude,
                workerLocation.longitude,
                order.latitude,
                order.longitude
              );
              return { ...order, distance };
            }
            return order;
          })
          .sort((a, b) => {
            // Sort by distance (nearest first)
            if (a.distance && b.distance) return a.distance - b.distance;
            if (a.distance) return -1;
            if (b.distance) return 1;
            return 0;
          });
      }
      
      setOrders(processedOrders);
    } catch {
      // Silent
    } finally {
      setRefreshing(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user?.id) return () => {};

    // Polling fallback: every 8 seconds to guarantee real-time feel
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => {
      loadOrdersRef.current();
    }, 8000);

    const channel = supabase
      .channel('worker-orders-rt-' + user.id + '-' + Date.now())
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: 'order_type=eq.worker' },
        (payload) => {
          if (payload.new?.status === 'pending' && notifSettings.enabled && notifSettings.new_orders) {
            if (notifSettings.vibration) Vibration.vibrate([0, 400, 200, 400]);
            if (notifSettings.sound !== false) {
              playNotificationSound(notifSettings.volume ?? 1.0);
            }
          }
          loadOrdersRef.current();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => { loadOrdersRef.current(); }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          loadOrdersRef.current();
        }
      });

    return () => {
      supabase.removeChannel(channel);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  };

  const startLocationTracking = async () => {
    if (!user?.id) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Ruxsat kerak', 'Joylashuvni kuzatish uchun sozlamalardan lokatsiya ruxsatini bering');
        return;
      }

      // Try last known position first for immediate update
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          const { latitude, longitude } = last.coords;
          setWorkerLocation({ latitude, longitude });
          await supabase.from('workers').update({ latitude, longitude, location_updated_at: new Date().toISOString() }).eq('id', user.id);
        }
      } catch { /* ignore */ }

      if (locationSubscriptionRef.current) locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Low, distanceInterval: 50, timeInterval: 30000 },
        async (location) => {
          const { latitude, longitude } = location.coords;
          setWorkerLocation({ latitude, longitude });
          await supabase.from('workers').update({ latitude, longitude, location_updated_at: new Date().toISOString() }).eq('id', user.id);
        }
      );
    } catch (e) {
      console.error('startLocationTracking error:', e);
      showAlert('Xatolik', 'Joylashuvni kuzatish boshlanmadi. GPS ni yoqib, qayta urining.');
    }
  };

  const stopLocationTracking = () => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
  };

  const toggleOnlineStatus = async (value: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('workers')
        .update({ is_online: value })
        .eq('id', user.id);

      if (error) throw error;
      setIsOnline(value);

      if (value) {
        // Start location tracking when going online
        await startLocationTracking();
      } else {
        // Stop location tracking when going offline
        stopLocationTracking();
      }
    } catch (error: any) {
      console.error('❌ Failed to update online status:', error);
      showAlert('Xatolik', 'Status yangilanmadi');
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    if (!user) return;
    try {
      const { data: currentOrder, error: checkError } = await supabase
        .from('orders').select('status, accepted_workers').eq('id', orderId).single();
      if (checkError) throw checkError;
      if (currentOrder.status !== 'pending') {
        showAlert('Xatolik', 'Bu buyurtma endi mavjud emas');
        loadOrders();
        return;
      }
      const existingAccepted: string[] = Array.isArray(currentOrder.accepted_workers) ? currentOrder.accepted_workers : [];
      if (existingAccepted.includes(user.id)) {
        showAlert("Ma'lumot", "Siz allaqachon bu buyurtmani qabul qildingiz.");
        setOrders(prev => prev.filter(o => o.id !== orderId));
        return;
      }
      const { error } = await supabase
        .from('orders').update({ accepted_workers: [...existingAccepted, user.id] })
        .eq('id', orderId).eq('status', 'pending');
      if (error) throw error;
      setOrders(prev => prev.filter(o => o.id !== orderId));
      showAlert("Yuborildi!", "Buyurtmachi siz haqingizda xabardor bo'ladi.");
      setTimeout(() => loadOrders(), 500);
    } catch (error: any) {
      showAlert('Xatolik', error.message || 'Buyurtmani qabul qilishda xatolik');
      loadOrders();
    }
  };

  const handleRejectOrder = async (orderId: string, silent = false) => {
    if (!user) return;
    try {
      const { data: order, error: fetchError } = await supabase
        .from('orders').select('rejected_by, status').eq('id', orderId).single();
      if (fetchError) throw fetchError;
      if (order.status !== 'pending') {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        return;
      }
      const rejectedBy: string[] = Array.isArray(order.rejected_by) ? [...order.rejected_by] : [];
      if (rejectedBy.includes(user.id)) {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        return;
      }
      rejectedBy.push(user.id);
      const { error: updateError } = await supabase
        .from('orders').update({ rejected_by: rejectedBy })
        .eq('id', orderId).eq('status', 'pending');
      if (updateError) throw updateError;
      setOrders(prev => prev.filter(o => o.id !== orderId));
      if (!silent) showAlert('Rad etildi', 'Buyurtma rad etildi');
      setTimeout(() => loadOrders(), 500);
    } catch (error: any) {
      if (!silent) showAlert('Xatolik', error.message || 'Buyurtmani rad etishda xatolik');
      loadOrders();
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    const completeAction = async () => {
      try {
        const { error } = await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
        if (error) throw error;
        if (workerProfile) {
          await supabase.from('workers')
            .update({ completed_orders: workerProfile.completed_orders + 1 }).eq('id', user!.id);
        }
        showAlert('Muvaffaqiyatli!', 'Buyurtma bajarildi');
        loadOrders();
        checkWorkerProfile();
      } catch {
        showAlert('Xatolik', 'Buyurtmani yakunlashda xatolik');
      }
    };
    showAlert('Tasdiqlash', 'Buyurtma bajarilganini tasdiqlaysizmi?', [
      { text: "Yo'q", style: 'cancel' },
      { text: 'Ha', onPress: completeAction },
    ]);
  };

  const handleLogout = async () => {
    try { await signOut(); } catch { /* ignore */ } finally { router.replace('/'); }
  };

  if (loading || roleLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Yuklanmoqda...
          </Text>
        </View>
      </View>
    );
  }

  // Show access denied if not worker
  if (role && role !== 'worker') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Ionicons name="warning" size={64} color={theme.warning} />
          <Text style={[styles.loadingText, { color: theme.text, marginTop: spacing.lg }]}>
            Bu sahifaga kirish uchun ishchi profili kerak
          </Text>
          <Button
            title="Ortga qaytish"
            onPress={() => router.back()}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </View>
    );
  }

  const renderOrder = ({ item }: { item: WorkerOrder }) => {
    const timeRemaining = orderTimers[item.id] || 0;
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    return (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/order-detail', params: { orderId: item.id } })}
        activeOpacity={0.7}
      >
        <Card style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <Text style={[styles.orderTitle, { color: theme.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.orderDate, { color: theme.textSecondary }]}>
              {new Date(item.created_at).toLocaleDateString('uz-UZ')}
            </Text>
          </View>

          <Text style={[styles.orderDescription, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>

          {item.distance && (
            <View style={[styles.distanceBadge, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="navigate" size={14} color={theme.primary} />
              <Text style={[styles.distanceText, { color: theme.primary }]}>
                {item.distance.toFixed(1)} km yaqin
              </Text>
            </View>
          )}

          <View style={styles.orderInfo}>
            <View style={styles.orderInfoItem}>
              <Ionicons name="location" size={16} color={theme.textSecondary} />
              <Text style={[styles.orderInfoText, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
            {/* Show customer info only if order is accepted by this worker */}
            {item.worker_id === user?.id && item.status !== 'pending' && (
              <>
                {item.customer_name ? (
                  <View style={styles.orderInfoItem}>
                    <Ionicons name="person" size={16} color={theme.primary} />
                    <Text style={[styles.orderInfoText, { color: theme.primary, fontWeight: '600' }]}>
                      {item.customer_name}
                    </Text>
                  </View>
                ) : null}
                {item.customer_phone ? (
                  <View style={styles.orderInfoItem}>
                    <Ionicons name="call" size={16} color={theme.success} />
                    <Text style={[styles.orderInfoText, { color: theme.success, fontWeight: '600' }]}>
                      {item.customer_phone}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {item.status === 'pending' && (
            <>
              {timeRemaining > 0 && (
                <View style={[styles.timerBadge, { backgroundColor: theme.warning + '15' }]}>
                  <Ionicons name="timer" size={16} color={theme.warning} />
                  <Text style={[styles.timerText, { color: theme.warning }]}>
                    Ko'rish vaqti: {minutes}:{seconds.toString().padStart(2, '0')}
                  </Text>
                </View>
              )}
              <View style={styles.actionButtons}>
                <Button
                  title="Rad etish"
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    handleRejectOrder(item.id);
                  }}
                  variant="outline"
                  style={styles.actionButton}
                />
                <Button
                  title="Qabul qilish"
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    handleAcceptOrder(item.id);
                  }}
                  style={styles.actionButton}
                />
              </View>
            </>
          )}
          {(item.status === 'accepted' || item.status === 'in_progress') && (
            <View style={styles.actionButtons}>
              <Button
                title="Bajarildi"
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  handleCompleteOrder(item.id);
                }}
                variant="outline"
                style={styles.actionButton}
              />
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <View style={{ width: 40 }} />
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t.workerDashboard || 'Ishchi paneli'}
        </Text>
        <TouchableOpacity onPress={() => router.push('/worker-profile')} activeOpacity={0.8}>
          {workerProfile?.avatar_url ? (
            <Image
              source={{ uri: workerProfile.avatar_url }}
              style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: theme.primary }}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Ionicons name="person-circle" size={36} color={theme.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Location Status */}
      <View style={styles.onlineContainer}>
        {!workerLocation ? (
          <Card style={[styles.warningCard, { backgroundColor: theme.warning + '15' }]}>
            <View style={styles.warningRow}>
              <Ionicons name="warning" size={24} color={theme.warning} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.warningTitle, { color: theme.warning }]}>
                  Joylashuv belgilanmagan
                </Text>
                <Text style={[styles.warningText, { color: theme.textSecondary }]}>
                  Buyurtmalar olish uchun joylashuvingizni belgilang
                </Text>
              </View>
              <Button
                title="Belgilash"
                onPress={() => setShowLocationPicker(true)}
                variant="outline"
                style={{ paddingHorizontal: spacing.md }}
              />
            </View>
          </Card>
        ) : null}

        <Card style={styles.onlineCard}>
          <View style={styles.onlineRow}>
            <View style={styles.onlineInfo}>
              <View style={styles.onlineIndicator}>
                <View
                  style={[
                    styles.onlineDot,
                    { backgroundColor: isOnline ? theme.success : theme.textTertiary },
                  ]}
                />
                <Text style={[styles.onlineText, { color: theme.text }]}>
                  {isOnline ? 'Onlayn' : 'Oflayn'}
                </Text>
              </View>
              <Text style={[styles.onlineDescription, { color: theme.textSecondary }]}>
                {isOnline ? 'Buyurtmalarni qabul qilasiz' : 'Buyurtmalar kelmaydi'}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={toggleOnlineStatus}
              trackColor={{ false: theme.border, true: theme.primary + '50' }}
              thumbColor={isOnline ? theme.primary : theme.textTertiary}
            />
          </View>
        </Card>
      </View>

      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.primary }]}>
            {workerProfile?.rating.toFixed(1) || '0.0'}
          </Text>
          <View style={styles.statRating}>
            <Ionicons name="star" size={16} color={theme.warning} />
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Reyting</Text>
          </View>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.success }]}>
            {workerProfile?.completed_orders || 0}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Bajarilgan</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.warning }]}>
            {orders.filter(o => o.status === 'accepted').length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Aktiv</Text>
        </Card>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'pending' && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => setSelectedTab('pending')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              { color: selectedTab === 'pending' ? '#FFFFFF' : theme.primary },
            ]}
          >
            Mavjud
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'accepted' && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => setSelectedTab('accepted')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              { color: selectedTab === 'accepted' ? '#FFFFFF' : theme.primary },
            ]}
          >
            Aktiv
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'completed' && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => setSelectedTab('completed')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              { color: selectedTab === 'completed' ? '#FFFFFF' : theme.primary },
            ]}
          >
            Bajarilgan
          </Text>
        </TouchableOpacity>
      </View>

      {refreshing && orders.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Yuklanmoqda...
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.ordersList}
          showsVerticalScrollIndicator={false}
          onRefresh={loadOrders}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={64} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {selectedTab === 'pending'
                  ? isOnline
                    ? 'Yangi buyurtmalar yo\'q'
                    : 'Onlayn bo\'ling va buyurtmalarni qabul qiling'
                  : selectedTab === 'accepted'
                  ? 'Aktiv buyurtmalar yo\'q'
                  : 'Bajarilgan buyurtmalar yo\'q'}
              </Text>
            </View>
          }
        />
      )}

      {/* Location Picker Modal */}
      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationSelect={async (coords) => {
          setShowLocationPicker(false);
          if (!user?.id) return;
          try {
            const { error } = await supabase
              .from('workers')
              .update({
                latitude: coords.latitude,
                longitude: coords.longitude,
                location_updated_at: new Date().toISOString(),
              })
              .eq('id', user.id);

            if (error) throw error;
            setWorkerLocation(coords);
            showAlert('Muvaffaqiyatli!', 'Joylashuv saqlandi');
          } catch (error: any) {
            console.error('Failed to update location:', error);
            showAlert('Xatolik', 'Joylashuvni saqlashda xatolik');
          }
        }}
        initialLocation={workerLocation || undefined}
      />

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
  onlineContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  onlineCard: {
    padding: spacing.md,
  },
  onlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  onlineInfo: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  onlineDot: {
    width: rs(10),
    height: rs(10),
    borderRadius: rs(5),
  },
  onlineText: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  onlineDescription: {
    ...typography.small,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
  },
  statValue: {
    ...typography.h2,
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.small,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  statRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    marginTop: spacing.xs,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    borderColor: '#E5E7EB',
  },
  tabText: {
    ...typography.bodyMedium,
  },
  ordersList: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  orderCard: {
    marginBottom: spacing.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  orderTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    flex: 1,
  },
  orderDate: {
    ...typography.small,
  },
  orderDescription: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  orderInfo: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  orderInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  orderInfoText: {
    ...typography.body,
  },
  acceptButton: {
    marginTop: spacing.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionButton: {
    flex: 1,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(3),
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: rs(3),
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  distanceText: {
    ...typography.small,
    fontWeight: '600',
  },
  warningCard: {
    marginBottom: spacing.sm,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  warningTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  warningText: {
    ...typography.small,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(3),
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: rs(3),
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  timerText: {
    ...typography.small,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
});
