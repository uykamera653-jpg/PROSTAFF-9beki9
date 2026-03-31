import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  Linking,
  ActionSheetIOS,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
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
}

export default function MyAdsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('pending');
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orderTimers, setOrderTimers] = useState<{ [orderId: string]: number }>({});

  // Load orders on mount and when tab changes
  useEffect(() => {
    if (user) {
      loadOrders();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [user?.id, activeTab]);

  // Timer for pending orders
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

  const loadOrders = async () => {
    if (!user?.id) return;

    try {
      setRefreshing(true);
      console.log('🔄 Loading customer orders...');

      let query = supabase
        .from('orders')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Failed to load orders:', error);
        throw error;
      }

      console.log('✅ Loaded orders:', data?.length || 0);
      setOrders(data || []);
    } catch (error: any) {
      console.error('❌ Error loading orders:', error);
      if (Platform.OS === 'web') {
        alert('Buyurtmalarni yuklab bo\'lmadi');
      } else {
        Alert.alert('Xatolik', 'Buyurtmalarni yuklab bo\'lmadi');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user?.id) return () => {};

    const channelName = `customer-orders-${user.id}-${Date.now()}`;
    console.log('📡 Setting up real-time subscription:', channelName);
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('📨 Real-time order update:', payload);
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  };

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const getStatusColor = (status: OrderStatus) => {
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

  const getStatusText = (status: OrderStatus) => {
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

  const renderOrderItem = ({ item }: { item: CustomerOrder }) => {
    const timeRemaining = orderTimers[item.id] || 0;
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    return (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/order-detail', params: { orderId: item.id } })}
        activeOpacity={0.7}
      >
        <Card style={styles.jobCard}>
          <View style={styles.jobHeader}>
            <Text style={[styles.category, { color: theme.primary }]}>
              {item.title}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusText(item.status)}
              </Text>
            </View>
          </View>
          
          <Text style={[styles.description, { color: theme.text }]} numberOfLines={2}>
            {item.description}
          </Text>

          {/* Timer for pending orders */}
          {item.status === 'pending' && timeRemaining > 0 && (
            <View style={[styles.timerContainer, { backgroundColor: theme.warning + '10' }]}>
              <Ionicons name="timer" size={18} color={theme.warning} />
              <Text style={[styles.timerText, { color: theme.warning }]}>
                Ishchi topish uchun: {minutes}:{seconds.toString().padStart(2, '0')}
              </Text>
            </View>
          )}

          {item.status === 'pending' && timeRemaining === 0 && (
            <View style={[styles.timerContainer, { backgroundColor: theme.error + '10' }]}>
              <Ionicons name="alert-circle" size={18} color={theme.error} />
              <Text style={[styles.timerText, { color: theme.error }]}>
                Muddati tugadi
              </Text>
            </View>
          )}
          
          <View style={styles.jobDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="location" size={16} color={theme.textSecondary} />
              <Text style={[styles.detailText, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          </View>
          
          <Text style={[styles.date, { color: theme.textTertiary }]}>
            {new Date(item.created_at).toLocaleDateString('uz-UZ')}
          </Text>
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
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Yuklanmoqda...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Buyurtmalarim</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
      >
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'pending' && { backgroundColor: theme.warning, borderColor: theme.warning },
          ]}
          onPress={() => setActiveTab('pending')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabButtonText,
              { color: activeTab === 'pending' ? '#FFFFFF' : theme.warning },
            ]}
          >
            Kutilmoqda
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'accepted' && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => setActiveTab('accepted')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabButtonText,
              { color: activeTab === 'accepted' ? '#FFFFFF' : theme.primary },
            ]}
          >
            Qabul qilindi
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'in_progress' && { backgroundColor: theme.info, borderColor: theme.info },
          ]}
          onPress={() => setActiveTab('in_progress')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabButtonText,
              { color: activeTab === 'in_progress' ? '#FFFFFF' : theme.info },
            ]}
          >
            Jarayonda
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'completed' && { backgroundColor: theme.success, borderColor: theme.success },
          ]}
          onPress={() => setActiveTab('completed')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabButtonText,
              { color: activeTab === 'completed' ? '#FFFFFF' : theme.success },
            ]}
          >
            Bajarilgan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'cancelled' && { backgroundColor: theme.error, borderColor: theme.error },
          ]}
          onPress={() => setActiveTab('cancelled')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabButtonText,
              { color: activeTab === 'cancelled' ? '#FFFFFF' : theme.error },
            ]}
          >
            Bekor qilindi
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color={theme.textTertiary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {activeTab === 'pending'
              ? 'Kutilayotgan buyurtmalar yo\'q'
              : activeTab === 'completed'
              ? 'Bajarilgan buyurtmalar yo\'q'
              : 'Buyurtmalar yo\'q'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  jobCard: {
    marginBottom: spacing.md,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  category: {
    ...typography.h3,
    fontSize: 18,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  statusText: {
    ...typography.small,
    fontWeight: '600',
  },
  description: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  jobDetails: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    ...typography.caption,
  },
  date: {
    ...typography.small,
    textAlign: 'right',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
  },
  tabsContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  tabButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    marginRight: spacing.xs,
  },
  tabButtonText: {
    ...typography.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  timerText: {
    ...typography.small,
    fontWeight: '600',
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
  serviceTypeText: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
  },
  actionButtonText: {
    ...typography.small,
    fontWeight: '600',
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
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xl,
  },
  starButton: {
    padding: spacing.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
