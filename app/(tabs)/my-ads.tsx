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
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useReviews } from '../../hooks/useReviews';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { spacing, typography, borderRadius } from '../../constants/theme';
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
    const channelName = `customer-orders-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `customer_id=eq.${user.id}`,
      }, () => { loadOrders(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const handleCancelOrder = (orderId: string) => {
    const doCancel = async () => {
      try {
        const { error } = await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', orderId)
          .eq('customer_id', user?.id);
        if (error) throw error;
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } catch (err: any) {
        Alert.alert('Xatolik', "Buyurtmani bekor qilib bo'lmadi");
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Bu buyurtmani bekor qilishni tasdiqlaysizmi?')) doCancel();
    } else {
      Alert.alert(
        'Bekor qilish',
        'Bu buyurtmani bekor qilishni tasdiqlaysizmi?',
        [
          { text: "Yo'q", style: 'cancel' },
          { text: 'Ha, bekor qilish', style: 'destructive', onPress: doCancel },
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
                    e.stopPropagation?.();
                    handleCancelOrder(item.id);
                  }}
                  style={[styles.cancelBtn, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B' }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
    height: 52,
    marginBottom: spacing.xs,
  },
  tabsContent: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
  },
  tabChip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabChipText: {
    fontSize: 13,
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
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 11,
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
  // Review Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewModal: {
    width: '88%',
    maxWidth: 400,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
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
