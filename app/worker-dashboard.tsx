import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
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

type OrderStatus = 'available' | 'accepted' | 'completed';

interface WorkerOrder {
  id: string;
  category: string;
  description: string;
  location: string;
  customerPhone: string;
  status: OrderStatus;
  createdAt: string;
}

export default function WorkerDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [selectedTab, setSelectedTab] = useState<OrderStatus>('available');
  
  // Mock data - replace with real data from Supabase
  const [orders] = useState<WorkerOrder[]>([
    {
      id: '1',
      category: 'cleaning',
      description: 'Uy tozalash kerak, 3 xonali kvartira',
      location: 'Toshkent, Chilonzor tumani',
      customerPhone: '+998901234567',
      status: 'available',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      category: 'gardening',
      description: 'Bog\'da ishlar, daraxt qirqish',
      location: 'Toshkent, Yunusobod tumani',
      customerPhone: '+998907654321',
      status: 'available',
      createdAt: new Date().toISOString(),
    },
  ]);

  const filteredOrders = orders.filter(order => order.status === selectedTab);

  const handleAcceptOrder = (orderId: string) => {
    console.log('Accept order:', orderId);
    // TODO: Update order status in Supabase
  };

  const renderOrder = ({ item }: { item: WorkerOrder }) => (
    <Card style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: theme.primary + '20' }]}>
          <Text style={[styles.categoryText, { color: theme.primary }]}>
            {t[item.category as keyof typeof t] as string}
          </Text>
        </View>
        <Text style={[styles.orderDate, { color: theme.textSecondary }]}>
          {new Date(item.createdAt).toLocaleDateString('uz-UZ')}
        </Text>
      </View>

      <Text style={[styles.orderDescription, { color: theme.text }]}>
        {item.description}
      </Text>

      <View style={styles.orderInfo}>
        <View style={styles.orderInfoItem}>
          <Ionicons name="location" size={16} color={theme.textSecondary} />
          <Text style={[styles.orderInfoText, { color: theme.textSecondary }]}>
            {item.location}
          </Text>
        </View>
        <View style={styles.orderInfoItem}>
          <Ionicons name="call" size={16} color={theme.textSecondary} />
          <Text style={[styles.orderInfoText, { color: theme.textSecondary }]}>
            {item.customerPhone}
          </Text>
        </View>
      </View>

      {item.status === 'available' && (
        <Button
          title={t.acceptOrder || 'Qabul qilish'}
          onPress={() => handleAcceptOrder(item.id)}
          style={styles.acceptButton}
        />
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

      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.primary }]}>12</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            {t.totalOrders || 'Jami buyurtmalar'}
          </Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.success }]}>8</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            {t.completedOrders || 'Bajarilgan'}
          </Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.warning }]}>4</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            {t.activeOrders || 'Aktiv'}
          </Text>
        </Card>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'available' && { backgroundColor: theme.primary },
          ]}
          onPress={() => setSelectedTab('available')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              { color: selectedTab === 'available' ? '#FFFFFF' : theme.textSecondary },
            ]}
          >
            {t.available || 'Mavjud'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'accepted' && { backgroundColor: theme.primary },
          ]}
          onPress={() => setSelectedTab('accepted')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              { color: selectedTab === 'accepted' ? '#FFFFFF' : theme.textSecondary },
            ]}
          >
            {t.accepted || 'Qabul qilingan'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'completed' && { backgroundColor: theme.primary },
          ]}
          onPress={() => setSelectedTab('completed')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              { color: selectedTab === 'completed' ? '#FFFFFF' : theme.textSecondary },
            ]}
          >
            {t.completed || 'Bajarilgan'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredOrders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.ordersList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={64} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t.noOrders || 'Buyurtmalar yo\'q'}
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
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  categoryText: {
    ...typography.small,
    fontWeight: '600',
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
