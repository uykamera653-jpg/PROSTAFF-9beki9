import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useReviews } from '../../hooks/useReviews';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { spacing, typography, borderRadius, rs } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

type OrderStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

interface CustomerOrder {
  id: string;
  category_id: string;
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  images: string[];
  status: OrderStatus;
  customer_phone?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  worker_id?: string;
  target_company_id?: string;
  order_type?: string;
  accepted_workers?: string[];
}

interface AcceptedWorkerInfo {
  id: string;
  full_name: string;
  age?: number;
  min_price: number;
  max_price: number;
  rating: number;
  avatar_url?: string;
}

const TABS: { key: OrderStatus; label: string; color: string }[] = [
  { key: 'pending', label: 'Kutilmoqda', color: '#F59E0B' },
  { key: 'accepted', label: 'Qabul qilindi', color: '#3B82F6' },
  { key: 'in_progress', label: 'Jarayonda', color: '#8B5CF6' },
  { key: 'completed', label: 'Bajarilgan', color: '#10B981' },
  { key: 'cancelled', label: 'Bekor qilindi', color: '#EF4444' },
];

export default function MyAdsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { submitReview, checkReviewExists } = useReviews();

  const [activeTab, setActiveTab] = useState<OrderStatus>('pending');
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 20;
  const [orderTimers, setOrderTimers] = useState<{ [orderId: string]: number }>({});

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<CustomerOrder | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewedOrders, setReviewedOrders] = useState<Set<string>>(new Set());

  // Worker selection modal
  const [showWorkerSelectModal, setShowWorkerSelectModal] = useState(false);
  const [selectedOrderForWorker, setSelectedOrderForWorker] = useState<CustomerOrder | null>(null);
  const [acceptedWorkers, setAcceptedWorkers] = useState<AcceptedWorkerInfo[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [confirmingWorkers, setConfirmingWorkers] = useState(false);

  useEffect(() => {
    if (user) {
      loadOrders();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [user?.id, activeTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      setOrderTimers((prev) => {
        const updated = { ...prev };
        orders.forEach((order) => {
          if (order.status === 'pending' && order.expires_at) {
            const expiresAt = new Date(order.expires_at).getTime();
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
            updated[order.id] = remaining;
          }
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [orders]);

  // Check which completed company orders already have reviews
  useEffect(() => {
    if (activeTab === 'completed' && orders.length > 0) {
      checkReviewedOrders(orders);
    }
  }, [orders, activeTab]);

  const checkReviewedOrders = async (orderList: CustomerOrder[]) => {
    const companyOrders = orderList.filter((o) => o.order_type === 'company' && o.target_company_id);
    const reviewed = new Set<string>();
    await Promise.all(
      companyOrders.map(async (o) => {
        const exists = await checkReviewExists(o.id);
        if (exists) reviewed.add(o.id);
      })
    );
    setReviewedOrders(reviewed);
  };

  const loadOrders = async () => {
    if (!user?.id) return;
    try {
      setRefreshing(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', user.id)
        .eq('status', activeTab)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);
      if (error) throw error;
      setOrders(data || []);
      setCurrentPage(0);
      setHasMore((data || []).length === PAGE_SIZE);
    } catch (error: any) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMoreOrders = async () => {
    if (!user?.id || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const from = nextPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', user.id)
        .eq('status', activeTab)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      setOrders((prev) => [...prev, ...(data || [])]);
      setCurrentPage(nextPage);
      setHasMore((data || []).length === PAGE_SIZE);
    } catch (error: any) {
      console.error('Error loading more orders:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user?.id) return () => {};
    const channelName = `customer-orders-rt-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `customer_id=eq.${user.id}`,
      }, () => { loadOrders(); })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `customer_id=eq.${user.id}`,
      }, (payload) => {
        // Real-vaqt: accepted_workers, status, worker_id o'zgarganda darhol yangilash
        if (payload.new) {
          setOrders(prev =>
            prev.map(o =>
              o.id === payload.new.id
                ? { ...o, ...payload.new }
                : o
            )
          );
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'orders',
        filter: `customer_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.old?.id) {
          setOrders(prev => prev.filter(o => o.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      // First verify order is still pending
      const { data: current, error: checkErr } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .eq('customer_id', user!.id)
        .single();
      if (checkErr) throw checkErr;
      if (current?.status !== 'pending') {
        Alert.alert('Xatolik', 'Bu buyurtma allaqachon qabul qilingan yoki yakunlangan');
        loadOrders();
        return;
      }
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('customer_id', user!.id)
        .eq('status', 'pending');
      if (error) throw error;
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      Alert.alert('Bajarildi', 'Buyurtma bekor qilindi');
    } catch (err: any) {
      Alert.alert('Xatolik', "Buyurtmani bekor qilib bo'lmadi: " + (err.message || ''));
    }
  };

  const confirmCancelOrder = (orderId: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Bu buyurtmani bekor qilishni tasdiqlaysizmi?')) handleCancelOrder(orderId);
    } else {
      Alert.alert(
        'Bekor qilish',
        'Bu buyurtmani bekor qilishni tasdiqlaysizmi?',
        [
          { text: "Yo'q", style: 'cancel' },
          { text: 'Ha, bekor qilish', style: 'destructive', onPress: () => handleCancelOrder(orderId) },
        ]
      );
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    const doDelete = async () => {
      try {
        const { error } = await supabase
          .from('orders')
          .delete()
          .eq('id', orderId)
          .eq('customer_id', user?.id);
        if (error) throw error;
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } catch (err: any) {
        Alert.alert('Xatolik', "Buyurtmani o'chirib bo'lmadi");
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Bu buyurtmani o'chirishni tasdiqlaysizmi?")) doDelete();
    } else {
      Alert.alert(
        "O'chirish",
        "Bu buyurtmani o'chirishni tasdiqlaysizmi?",
        [
          { text: 'Bekor qilish', style: 'cancel' },
          { text: "O'chirish", style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  // Open worker selection modal
  const openWorkerSelectModal = async (order: CustomerOrder) => {
    setSelectedOrderForWorker(order);
    setSelectedWorkerIds([]);
    setShowWorkerSelectModal(true);
    setLoadingWorkers(true);

    try {
      const workerIds: string[] = Array.isArray(order.accepted_workers) ? order.accepted_workers : [];
      if (workerIds.length === 0) {
        setAcceptedWorkers([]);
        return;
      }

      const { data, error } = await supabase
        .from('workers')
        .select('id, full_name, age, min_price, max_price, rating, avatar_url')
        .in('id', workerIds);

      if (error) throw error;
      setAcceptedWorkers(data || []);
    } catch (e) {
      console.error('Failed to load workers:', e);
      setAcceptedWorkers([]);
    } finally {
      setLoadingWorkers(false);
    }
  };

  const toggleWorkerSelection = (workerId: string) => {
    setSelectedWorkerIds(prev =>
      prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]
    );
  };

  // Customer confirms selected workers — order status → accepted
  const handleConfirmWorkers = async () => {
    if (!selectedOrderForWorker || selectedWorkerIds.length === 0) return;

    setConfirmingWorkers(true);
    try {
      // Update order: first selected becomes the main worker_id, status = accepted
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'accepted',
          worker_id: selectedWorkerIds[0],
          accepted_workers: selectedWorkerIds,
        })
        .eq('id', selectedOrderForWorker.id);

      if (orderError) throw orderError;

      // Update local state immediately — no need to reload
      setOrders(prev =>
        prev.map(o =>
          o.id === selectedOrderForWorker.id
            ? { ...o, status: 'accepted', worker_id: selectedWorkerIds[0], accepted_workers: selectedWorkerIds }
            : o
        )
      );

      setShowWorkerSelectModal(false);
      setSelectedOrderForWorker(null);
      setSelectedWorkerIds([]);

      Alert.alert('Muvaffaqiyatli!', `Ishchi tanlandi. U siz bilan bog'lanadi.`);
    } catch (error: any) {
      Alert.alert('Xatolik', error.message || "Ishchilarni tasdiqlashda xatolik");
    } finally {
      setConfirmingWorkers(false);
    }
  };

  const openReviewModal = (order: CustomerOrder) => {
    setReviewOrder(order);
    setReviewRating(5);
    setReviewComment('');
    setShowReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewOrder?.target_company_id) return;
    setReviewSubmitting(true);
    try {
      await submitReview(
        reviewOrder.target_company_id,
        reviewOrder.id,
        reviewRating,
        reviewComment
      );
      setReviewedOrders((prev) => new Set([...prev, reviewOrder.id]));
      setShowReviewModal(false);
      Alert.alert('Rahmat!', 'Reytingingiz qabul qilindi');
    } catch (error: any) {
      Alert.alert('Xatolik', error.message || 'Reyting yuborishda xatolik');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const getLocationText = (item: CustomerOrder) => {
    if (item.location && !/^-?\d+\./.test(item.location)) return item.location;
    if (item.latitude && item.longitude)
      return `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`;
    return "Manzil ko'rsatilmagan";
  };

  const getStatusColor = (status: OrderStatus) => {
    return TABS.find((tab) => tab.key === status)?.color || theme.textSecondary;
  };

  const getStatusText = (status: OrderStatus) => {
    return TABS.find((tab) => tab.key === status)?.label || status;
  };

  const renderOrderItem = ({ item }: { item: CustomerOrder }) => {
    const timeRemaining = orderTimers[item.id] || 0;
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const statusColor = getStatusColor(item.status);
    const isCompanyOrder = item.order_type === 'company' && !!item.target_company_id;
    const alreadyReviewed = reviewedOrders.has(item.id);
    const acceptedCount = Array.isArray(item.accepted_workers) ? item.accepted_workers.length : 0;
    const isWorkerOrder = item.order_type !== 'company';

    return (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/order-detail', params: { orderId: item.id } })}
        activeOpacity={0.7}
      >
        <Card style={styles.jobCard}>
          {/* Header row */}
          <View style={styles.jobHeader}>
            <Text style={[styles.category, { color: theme.primary }]} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.headerRight}>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {getStatusText(item.status)}
                </Text>
              </View>
              {item.status === 'pending' && (
                <TouchableOpacity
                  onPress={(e) => {
                    (e as any).stopPropagation?.();
                    confirmCancelOrder(item.id);
                  }}
                  style={[styles.cancelBtn, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B' }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle-outline" size={13} color="#F59E0B" />
                  <Text style={[styles.cancelBtnText, { color: '#F59E0B' }]}>Bekor</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation?.();
                  handleDeleteOrder(item.id);
                }}
                style={[styles.deleteBtn, { backgroundColor: theme.error + '15' }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={15} color={theme.error} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.description, { color: theme.text }]} numberOfLines={2}>
            {item.description}
          </Text>

          {/* Timer */}
          {item.status === 'pending' && timeRemaining > 0 && (
            <View style={[styles.timerContainer, { backgroundColor: theme.warning + '12' }]}>
              <Ionicons name="timer" size={16} color={theme.warning} />
              <Text style={[styles.timerText, { color: theme.warning }]}>
                Ishchi topish uchun: {minutes}:{seconds.toString().padStart(2, '0')}
              </Text>
            </View>
          )}

          {item.status === 'pending' && timeRemaining === 0 && item.expires_at && (
            <View style={[styles.timerContainer, { backgroundColor: theme.error + '12' }]}>
              <Ionicons name="alert-circle" size={16} color={theme.error} />
              <Text style={[styles.timerText, { color: theme.error }]}>Muddati tugadi</Text>
            </View>
          )}

          {/* Accepted workers banner - for worker orders with acceptances */}
          {item.status === 'pending' && isWorkerOrder && acceptedCount > 0 && (

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                openWorkerSelectModal(item);
              }}
              style={[styles.acceptedWorkersBanner, { backgroundColor: '#10B981' + '15', borderColor: '#10B981' }]}
              activeOpacity={0.8}
            >
              <View style={styles.acceptedWorkersLeft}>
                <Ionicons name="people" size={20} color="#10B981" />
                <View>
                  <Text style={[styles.acceptedWorkersTitle, { color: '#10B981' }]}>
                    {acceptedCount} ishchi qabul qildi!
                  </Text>
                  <Text style={[styles.acceptedWorkersSub, { color: theme.textSecondary }]}>
                    Birini yoki bir nechtasini tanlang
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#10B981" />
            </TouchableOpacity>
          )}

          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.detailText, { color: theme.textSecondary }]} numberOfLines={1}>
              {getLocationText(item)}
            </Text>
          </View>

          <Text style={[styles.date, { color: theme.textTertiary }]}>
            {new Date(item.created_at).toLocaleDateString('uz-UZ')}
          </Text>

          {/* Rate button for completed company orders */}
          {item.status === 'completed' && isCompanyOrder && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                if (!alreadyReviewed) openReviewModal(item);
              }}
              style={[
                styles.rateBtn,
                {
                  backgroundColor: alreadyReviewed ? theme.surfaceVariant : '#F59E0B15',
                  borderColor: alreadyReviewed ? theme.border : '#F59E0B',
                },
              ]}
              activeOpacity={alreadyReviewed ? 1 : 0.8}
            >
              <Ionicons
                name={alreadyReviewed ? 'checkmark-circle' : 'star'}
                size={15}
                color={alreadyReviewed ? theme.success : '#F59E0B'}
              />
              <Text
                style={[
                  styles.rateBtnText,
                  { color: alreadyReviewed ? theme.textSecondary : '#F59E0B' },
                ]}
              >
                {alreadyReviewed ? 'Baholandi' : 'Firma baholash'}
              </Text>
            </TouchableOpacity>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Buyurtmalarim</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Yuklanmoqda...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Buyurtmalarim</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isActive ? tab.color : 'transparent',
                    borderColor: tab.color,
                  },
                ]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.tabChipText, { color: isActive ? '#FFFFFF' : tab.color }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Orders list */}
      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={60} color={theme.textTertiary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {TABS.find((tab) => tab.key === activeTab)?.label} buyurtmalar yo'q
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreOrders}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.footerLoaderText, { color: theme.textSecondary }]}>
                  Ko'proq yuklanmoqda...
                </Text>
              </View>
            ) : !hasMore && orders.length > 0 ? (
              <Text style={[styles.noMoreText, { color: theme.textTertiary }]}>
                Barcha buyurtmalar ko'rsatildi
              </Text>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={loadOrders}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        />
      )}

      {/* Worker Selection Modal */}
      <Modal
        visible={showWorkerSelectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWorkerSelectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.workerSelectModal, { backgroundColor: theme.surface }]}>
            {/* Header */}
            <View style={styles.workerSelectHeader}>
              <Text style={[styles.workerSelectTitle, { color: theme.text }]}>
                Ishchilarni tanlang
              </Text>
              <TouchableOpacity onPress={() => setShowWorkerSelectModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.workerSelectSubtitle, { color: theme.textSecondary }]}>
              Bir yoki bir nechta ishchini tanlang. Tanlanganlarga darhol xabar yuboriladi.
            </Text>

            {loadingWorkers ? (
              <View style={styles.workerLoadingBox}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Yuklanmoqda...</Text>
              </View>
            ) : acceptedWorkers.length === 0 ? (
              <View style={styles.workerLoadingBox}>
                <Ionicons name="person-outline" size={48} color={theme.textTertiary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Ishchilar yo'q</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.workerList}
                showsVerticalScrollIndicator={false}
              >
                {acceptedWorkers.map((worker) => {
                  const isSelected = selectedWorkerIds.includes(worker.id);
                  return (
                    <TouchableOpacity
                      key={worker.id}
                      style={[
                        styles.workerCard,
                        {
                          backgroundColor: isSelected ? theme.primary + '10' : theme.surfaceVariant,
                          borderColor: isSelected ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => toggleWorkerSelection(worker.id)}
                      activeOpacity={0.8}
                    >
                      {/* Avatar */}
                      <View style={styles.workerAvatar}>
                        {worker.avatar_url ? (
                          <Image
                            source={{ uri: worker.avatar_url }}
                            style={styles.workerAvatarImg}
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <View style={[styles.workerAvatarImg, { backgroundColor: theme.primary + '20', alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name="person" size={28} color={theme.primary} />
                          </View>
                        )}
                      </View>

                      {/* Info */}
                      <View style={styles.workerInfo}>
                        <Text style={[styles.workerName, { color: theme.text }]} numberOfLines={1}>
                          {worker.full_name}
                        </Text>
                        {worker.age ? (
                          <Text style={[styles.workerAge, { color: theme.textSecondary }]}>
                            {worker.age} yosh
                          </Text>
                        ) : null}
                        <View style={styles.workerMeta}>
                          <Ionicons name="star" size={12} color="#F59E0B" />
                          <Text style={[styles.workerRating, { color: theme.textSecondary }]}>
                            {worker.rating.toFixed(1)}
                          </Text>
                          <Text style={[styles.workerPrice, { color: theme.primary }]}>
                            {worker.min_price.toLocaleString()}–{worker.max_price.toLocaleString()} so'm/kun
                          </Text>
                        </View>
                      </View>

                      {/* Selection indicator */}
                      <View style={[
                        styles.workerCheckbox,
                        { borderColor: isSelected ? theme.primary : theme.border, backgroundColor: isSelected ? theme.primary : 'transparent' }
                      ]}>
                        {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Confirm button */}
            {!loadingWorkers && acceptedWorkers.length > 0 && (
              <View style={styles.workerSelectActions}>
                <Button
                  title="Bekor qilish"
                  onPress={() => setShowWorkerSelectModal(false)}
                  variant="outline"
                  style={{ flex: 1 }}
                  disabled={confirmingWorkers}
                />
                <Button
                  title={
                    confirmingWorkers
                      ? 'Tasdiqlanmoqda...'
                      : selectedWorkerIds.length > 0
                      ? `${selectedWorkerIds.length} ta ishchini tasdiqlash`
                      : 'Ishchi tanlang'
                  }
                  onPress={handleConfirmWorkers}
                  disabled={selectedWorkerIds.length === 0 || confirmingWorkers}
                  loading={confirmingWorkers}
                  style={{ flex: 2 }}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowReviewModal(false)}
          />
          <View style={[styles.reviewModal, { backgroundColor: theme.surface }]}>
            <Text style={[styles.reviewTitle, { color: theme.text }]}>Firmani baholang</Text>
            <Text style={[styles.reviewSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {reviewOrder?.title}
            </Text>

            {/* Star rating */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setReviewRating(star)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={star <= reviewRating ? 'star' : 'star-outline'}
                    size={36}
                    color={star <= reviewRating ? '#F59E0B' : theme.border}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.ratingLabel, { color: theme.textSecondary }]}>
              {reviewRating === 1
                ? 'Juda yomon'
                : reviewRating === 2
                ? 'Yomon'
                : reviewRating === 3
                ? "Qoniqarli"
                : reviewRating === 4
                ? 'Yaxshi'
                : "A'lo"}
            </Text>

            {/* Comment */}
            <TextInput
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Izoh qoldiring (ixtiyoriy)..."
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={3}
              style={[
                styles.commentInput,
                {
                  color: theme.text,
                  backgroundColor: theme.surfaceVariant,
                  borderColor: theme.border,
                },
              ]}
            />

            <View style={styles.reviewButtons}>
              <Button
                title="Bekor qilish"
                onPress={() => setShowReviewModal(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title={reviewSubmitting ? 'Yuborilmoqda...' : 'Yuborish'}
                onPress={handleSubmitReview}
                disabled={reviewSubmitting}
                loading={reviewSubmitting}
                style={{ flex: 1 }}
              />
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: { ...typography.h2 },
  tabsWrapper: {
    height: rs(52),
    marginBottom: spacing.xs,
  },
  tabsContent: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
  },
  tabChip: {
    paddingHorizontal: rs(14),
    height: rs(36),
    borderRadius: rs(18),
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: rs(80),
  },
  tabChipText: {
    fontSize: rs(13),
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  jobCard: { marginBottom: spacing.md },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  category: {
    ...typography.bodyMedium,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    width: rs(32),
    height: rs(32),
    borderRadius: rs(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(3),
    paddingHorizontal: rs(8),
    height: rs(32),
    borderRadius: rs(8),
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: rs(11),
    fontWeight: '600',
  },
  description: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  detailText: { ...typography.caption, flex: 1 },
  date: {
    ...typography.small,
    textAlign: 'right',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  timerText: {
    ...typography.small,
    fontWeight: '600',
  },
  acceptedWorkersBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    marginBottom: spacing.sm,
  },
  acceptedWorkersLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  acceptedWorkersTitle: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  acceptedWorkersSub: {
    ...typography.small,
    marginTop: 2,
  },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    marginTop: spacing.sm,
  },
  rateBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: { ...typography.body },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  footerLoaderText: { ...typography.small },
  noMoreText: {
    ...typography.small,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: { ...typography.body },
  // Modal base
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  // Worker Select Modal
  workerSelectModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    maxHeight: '85%',
  },
  workerSelectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  workerSelectTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  workerSelectSubtitle: {
    ...typography.small,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  workerLoadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  workerList: {
    maxHeight: 380,
  },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    marginBottom: spacing.sm,
  },
  workerAvatar: {
    flexShrink: 0,
  },
  workerAvatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  workerInfo: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  workerName: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  workerAge: {
    ...typography.small,
  },
  workerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  workerRating: {
    ...typography.small,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  workerPrice: {
    ...typography.small,
    fontWeight: '600',
  },
  workerCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  workerSelectActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  // Review Modal
  reviewModal: {
    width: '88%',
    maxWidth: 400,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  reviewTitle: {
    ...typography.h3,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  reviewSubtitle: {
    ...typography.small,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  ratingLabel: {
    ...typography.bodyMedium,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  commentInput: {
    minHeight: 80,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    ...typography.body,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  reviewButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
