import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { useUserRole } from '../hooks/useUserRole';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { spacing, typography, borderRadius } from '../constants/theme';

type OrderStatus = 'pending' | 'confirmed' | 'completed';

interface CompanyOrder {
  id: string;
  serviceType: string;
  customerName: string;
  customerPhone: string;
  location: string;
  notes: string;
  status: OrderStatus;
  createdAt: string;
}

export default function CompanyDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();

  const [selectedTab, setSelectedTab] = useState<OrderStatus>('pending');
  
  // Mock data - replace with real data from Supabase
  const [orders] = useState<CompanyOrder[]>([
    {
      id: '1',
      serviceType: 'Santexnika',
      customerName: 'Ali Valiyev',
      customerPhone: '+998901234567',
      location: 'Toshkent, Chilonzor tumani, 12-mavze',
      notes: 'Suv quvuri oqayapti, tezroq kelib ko\'ring',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      serviceType: 'Elektr ishlari',
      customerName: 'Sardor Karimov',
      customerPhone: '+998907654321',
      location: 'Toshkent, Yunusobod tumani, 5-kvartal',
      notes: 'Elektr kabellari almashtirish kerak',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  ]);

  // Check role and redirect if not company
  useEffect(() => {
    if (!roleLoading && role && role !== 'company') {
      console.log('⚠️ Access denied: User role is', role, 'not company');
      router.replace(role === 'customer' ? '/(tabs)/home' : role === 'worker' ? '/worker-dashboard' : '/admin-panel');
    }
  }, [role, roleLoading]);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const filteredOrders = orders.filter(order => order.status === selectedTab);

  const handleConfirmOrder = (orderId: string) => {
    console.log('Confirm order:', orderId);
    // TODO: Update order status in Supabase
  };

  if (roleLoading) {
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

  // Show access denied if not company
  if (role && role !== 'company') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Ionicons name="warning" size={64} color={theme.warning} />
          <Text style={[styles.loadingText, { color: theme.text, marginTop: spacing.lg }]}>
            Bu sahifaga kirish uchun firma profili kerak
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

  const renderOrder = ({ item }: { item: CompanyOrder }) => (
    <Card style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={[styles.serviceTypeBadge, { backgroundColor: theme.primary + '20' }]}>
          <Text style={[styles.serviceTypeText, { color: theme.primary }]}>
            {item.serviceType}
          </Text>
        </View>
        <Text style={[styles.orderDate, { color: theme.textSecondary }]}>
          {new Date(item.createdAt).toLocaleDateString('uz-UZ')}
        </Text>
      </View>

      <View style={styles.customerInfo}>
        <View style={styles.customerInfoItem}>
          <Ionicons name="person" size={16} color={theme.textSecondary} />
          <Text style={[styles.customerInfoText, { color: theme.text }]}>
            {item.customerName}
          </Text>
        </View>
        <View style={styles.customerInfoItem}>
          <Ionicons name="call" size={16} color={theme.textSecondary} />
          <Text style={[styles.customerInfoText, { color: theme.text }]}>
            {item.customerPhone}
          </Text>
        </View>
        <View style={styles.customerInfoItem}>
          <Ionicons name="location" size={16} color={theme.textSecondary} />
          <Text style={[styles.customerInfoText, { color: theme.text }]}>
            {item.location}
          </Text>
        </View>
      </View>

      {item.notes && (
        <View style={[styles.notesContainer, { backgroundColor: theme.surfaceVariant }]}>
          <Text style={[styles.notesLabel, { color: theme.textSecondary }]}>
            {t.additionalNotes || 'Qo\'shimcha izohlar'}:
          </Text>
          <Text style={[styles.notesText, { color: theme.text }]}>
            {item.notes}
          </Text>
        </View>
      )}

      {item.status === 'pending' && (
        <Button
          title={t.confirmOrder || 'Buyurtmani tasdiqlash'}
          onPress={() => handleConfirmOrder(item.id)}
          style={styles.confirmButton}
        />
      )}
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <View style={{ width: 40 }} />
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t.companyDashboard || 'Firma paneli'}
        </Text>
        <TouchableOpacity onPress={() => router.push('/company-profile')}>
          <Ionicons name="person-circle" size={28} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.primary }]}>24</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            {t.totalOrders || 'Jami'}
          </Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.warning }]}>5</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            {t.pending || 'Kutilmoqda'}
          </Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.success }]}>19</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            {t.completed || 'Bajarilgan'}
          </Text>
        </Card>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'pending' && { backgroundColor: theme.primary },
          ]}
          onPress={() => setSelectedTab('pending')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              { color: selectedTab === 'pending' ? '#FFFFFF' : theme.textSecondary },
            ]}
          >
            {t.pending || 'Yangi'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'confirmed' && { backgroundColor: theme.primary },
          ]}
          onPress={() => setSelectedTab('confirmed')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              { color: selectedTab === 'confirmed' ? '#FFFFFF' : theme.textSecondary },
            ]}
          >
            {t.confirmed || 'Tasdiqlangan'}
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
            <Ionicons name="document-text-outline" size={64} color={theme.textTertiary} />
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
    marginBottom: spacing.md,
  },
  serviceTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  serviceTypeText: {
    ...typography.small,
    fontWeight: '600',
  },
  orderDate: {
    ...typography.small,
  },
  customerInfo: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  customerInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  customerInfoText: {
    ...typography.body,
  },
  notesContainer: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  notesLabel: {
    ...typography.small,
    marginBottom: spacing.xs / 2,
  },
  notesText: {
    ...typography.body,
  },
  confirmButton: {
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
  },
});
