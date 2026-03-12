import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { spacing, typography, borderRadius } from '../constants/theme';
import { supabase } from '../lib/supabase';

type OrderStatus = 'pending' | 'accepted' | 'in_progress' | 'completed';

interface WorkerOrder {
  id: string;
  category_id: string;
  title: string;
  description: string;
  location: string;
  customer_phone: string;
  status: OrderStatus;
  created_at: string;
  customer_id: string;
}

interface WorkerProfile {
  id: string;
  full_name: string;
  phone: string;
  rating: number;
  completed_orders: number;
  is_online: boolean;
}

export default function WorkerDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [selectedTab, setSelectedTab] = useState<OrderStatus>('pending');
  const [orders, setOrders] = useState<WorkerOrder[]>([]);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/');
      return;
    }
    checkWorkerProfile();
  }, [user]);

  useEffect(() => {
    if (workerProfile) {
      loadOrders();
      setupRealtimeSubscription();
    }
  }, [workerProfile, selectedTab]);

  const checkWorkerProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Worker profile doesn't exist, redirect to onboarding
          router.replace('/worker-onboarding');
        } else {
          throw error;
        }
        return;
      }

      if (data) {
        setWorkerProfile(data);
        setIsOnline(data.is_online);
      }
    } catch (error: any) {
      console.error('Failed to check worker profile:', error);
      Alert.alert('Xatolik', 'Profil yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      setRefreshing(true);

      // Get worker categories
      const { data: workerCats, error: catsError } = await supabase
        .from('worker_categories')
        .select('category_id')
        .eq('worker_id', user!.id);

      if (catsError) throw catsError;

      const categoryIds = workerCats?.map(c => c.category_id) || [];

      if (categoryIds.length === 0) {
        setOrders([]);
        return;
      }

      // Load orders based on selected tab
      let query = supabase
        .from('orders')
        .select('*')
        .in('category_id', categoryIds);

      if (selectedTab === 'pending') {
        query = query.eq('status', 'pending');
      } else {
        query = query.eq('worker_id', user!.id).eq('status', selectedTab);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Failed to load orders:', error);
      Alert.alert('Xatolik', 'Buyurtmalarni yuklashda xatolik');
    } finally {
      setRefreshing(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('worker-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const toggleOnlineStatus = async (value: boolean) => {
    try {
      const { error } = await supabase
        .from('workers')
        .update({ is_online: value })
        .eq('id', user!.id);

      if (error) throw error;
      setIsOnline(value);
    } catch (error: any) {
      console.error('Failed to update online status:', error);
      Alert.alert('Xatolik', 'Status yangilanmadi');
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'accepted',
          worker_id: user!.id,
        })
        .eq('id', orderId);

      if (error) throw error;

      Alert.alert('Muvaffaqiyatli!', 'Buyurtma qabul qilindi');
      loadOrders();
    } catch (error: any) {
      console.error('Failed to accept order:', error);
      Alert.alert('Xatolik', 'Buyurtmani qabul qilishda xatolik');
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    Alert.alert(
      'Tasdiqlash',
      'Buyurtma bajarilganini tasdiqlaysizmi?',
      [
        { text: 'Yo\'q', style: 'cancel' },
        {
          text: 'Ha',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('orders')
                .update({ status: 'completed' })
                .eq('id', orderId);

              if (error) throw error;

              // Update worker stats
              if (workerProfile) {
                const { error: updateError } = await supabase
                  .from('workers')
                  .update({
                    completed_orders: workerProfile.completed_orders + 1,
                  })
                  .eq('id', user!.id);

                if (updateError) console.error('Failed to update stats:', updateError);
              }

              Alert.alert('Muvaffaqiyatli!', 'Buyurtma bajarildi');
              loadOrders();
              checkWorkerProfile();
            } catch (error: any) {
              console.error('Failed to complete order:', error);
              Alert.alert('Xatolik', 'Buyurtmani yakunlashda xatolik');
            }
          },
        },
      ]
    );
  };

  if (loading) {
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

  const renderOrder = ({ item }: { item: WorkerOrder }) => (
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

      <View style={styles.orderInfo}>
        <View style={styles.orderInfoItem}>
          <Ionicons name="location" size={16} color={theme.textSecondary} />
          <Text style={[styles.orderInfoText, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.location}
          </Text>
        </View>
        {item.customer_phone && (
          <View style={styles.orderInfoItem}>
            <Ionicons name="call" size={16} color={theme.textSecondary} />
            <Text style={[styles.orderInfoText, { color: theme.textSecondary }]}>
              {item.customer_phone}
            </Text>
          </View>
        )}
      </View>

      {item.status === 'pending' && (
        <Button
          title="Qabul qilish"
          onPress={() => handleAcceptOrder(item.id)}
          style={styles.acceptButton}
        />
      )}
      {item.status === 'accepted' && (
        <View style={styles.actionButtons}>
          <Button
            title="Bajarildi"
            onPress={() => handleCompleteOrder(item.id)}
            variant="outline"
            style={styles.actionButton}
          />
        </View>
      )}
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t.workerDashboard || 'Ishchi paneli'}
        </Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
          <Ionicons name="person-circle" size={28} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.onlineContainer}>
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
    width: 10,
    height: 10,
    borderRadius: 5,
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
});
