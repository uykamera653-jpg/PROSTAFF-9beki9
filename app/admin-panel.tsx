import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useUserRole, UserRole } from '../hooks/useUserRole';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAlert } from '../components/ui/WebAlert';
import { spacing, typography, borderRadius } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAppConfig, AppConfig } from '../hooks/useAppConfig';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

interface Worker {
  id: string;
  full_name: string;
  phone: string;
  rating: number;
  completed_orders: number;
  success_rate: number;
  min_price: number;
  max_price: number;
  is_online: boolean;
  is_blocked: boolean;
  created_at: string;
}

interface AdminOrder {
  id: string;
  title: string;
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  customer_phone: string | null;
  created_at: string;
  updated_at: string;
  customer_id: string;
  worker_id: string | null;
  category_id: string;
  customer?: { name: string; email: string };
  worker?: { full_name: string; phone: string };
  category?: { name_uz: string; icon: string };
}

interface Company {
  id: string;
  company_name: string;
  description?: string;
  phone: string;
  rating: number;
  completed_orders: number;
  is_online: boolean;
  is_blocked: boolean;
  created_at: string;
}

export default function AdminPanelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { role: currentUserRole, isLoading: roleLoading } = useUserRole();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const { showAlert, AlertComponent } = useAlert();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasCheckedAuth = useRef(false);

  // Config management states
  const [activeTab, setActiveTab] = useState<'users' | 'workers' | 'companies' | 'orders' | 'config'>('users');
  const { configs, refreshConfigs } = useAppConfig();
  const [selectedConfig, setSelectedConfig] = useState<AppConfig | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configValue, setConfigValue] = useState('');

  // Orders history states
  const [allOrders, setAllOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersFilter, setOrdersFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const fetchAllOrders = async () => {
    try {
      setOrdersLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          category:categories(name_uz, icon)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const orders = data || [];

      // Fetch customer and worker info
      const customerIds = [...new Set(orders.map((o: any) => o.customer_id).filter(Boolean))];
      const workerIds = [...new Set(orders.map((o: any) => o.worker_id).filter(Boolean))];

      const [customersRes, workersRes] = await Promise.all([
        customerIds.length > 0
          ? supabase.from('user_profiles').select('id, name, email').in('id', customerIds as string[])
          : { data: [] },
        workerIds.length > 0
          ? supabase.from('workers').select('id, full_name, phone').in('id', workerIds as string[])
          : { data: [] },
      ]);

      const customersMap: Record<string, any> = {};
      const workersMap: Record<string, any> = {};
      (customersRes.data || []).forEach((c: any) => (customersMap[c.id] = c));
      (workersRes.data || []).forEach((w: any) => (workersMap[w.id] = w));

      const enriched = orders.map((o: any) => ({
        ...o,
        customer: customersMap[o.customer_id],
        worker: o.worker_id ? workersMap[o.worker_id] : null,
      }));

      setAllOrders(enriched);
    } catch (error: any) {
      console.error('Failed to fetch orders:', error);
      showAlert('Xatolik', 'Buyurtmalarni yuklashda xatolik');
    } finally {
      setOrdersLoading(false);
    }
  };

  // Auth check effect - only redirect if not authorized
  useEffect(() => {
    if (roleLoading) return;

    if (currentUserRole !== 'admin' && currentUserRole !== 'moderator') {
      router.replace('/');
    }
  }, [currentUserRole, roleLoading]);

  // Data fetching and real-time subscription effect
  useEffect(() => {
    if (roleLoading) return;
    if (currentUserRole !== 'admin' && currentUserRole !== 'moderator') return;

    // Initial fetch
    fetchUsers();
    fetchWorkers();
    fetchCompanies();
    fetchAllOrders();

    // Setup real-time subscription for all tables
    channelRef.current = supabase
      .channel('admin_panel_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles',
        },
        () => {
          fetchUsers();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workers',
        },
        () => {
          fetchWorkers();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'companies',
        },
        () => {
          fetchCompanies();
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUserRole, roleLoading]);

  const fetchUsers = async () => {
    try {
      console.log('📥 Fetching users...');
      setIsLoading(true);
      
      // Direct database query - tezroq!
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, email, role, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Failed to fetch users:', error);
        showAlert('Xatolik', `Foydalanuvchilarni yuklashda xatolik: ${error.message}`);
        setUsers([]);
        return;
      }

      console.log('✅ Users loaded:', data?.length || 0);
      setUsers(data || []);
    } catch (error: any) {
      console.error('❌ Fetch users error:', error);
      showAlert('Xatolik', `Xatolik: ${error.message || 'Noma\'lum xatolik'}`);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (newRole: UserRole) => {
    if (!selectedUser || isUpdatingRole) return;

    try {
      console.log('🔄 Updating role:', { userId: selectedUser.id, newRole });
      setIsUpdatingRole(true);

      // Direct database update - tezroq!
      const { error } = await supabase
        .from('user_profiles')
        .update({
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUser.id);

      if (error) {
        console.error('❌ Failed to update role:', error);
        showAlert('Xatolik', `Rolni yangilashda xatolik: ${error.message}`);
        setIsUpdatingRole(false);
        return;
      }

      console.log('✅ Role updated successfully');
      showAlert('Muvaffaqiyatli', `Rol ${newRole}ga o'zgartirildi`);
      
      // Force refresh to ensure latest data
      await fetchUsers();
      
      // Close modal after successful update
      setShowRoleModal(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('❌ Role change error:', error);
      showAlert('Xatolik', `Rolni yangilashda xatolik: ${error.message}`);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return theme.error;
      case 'worker': return theme.primary;
      case 'company': return theme.warning;
      default: return theme.textSecondary;
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'shield-checkmark';
      case 'worker': return 'hammer';
      case 'company': return 'business';
      default: return 'person';
    }
  };

  const fetchWorkers = async () => {
    try {
      console.log('📥 Fetching workers...');
      
      // Direct database query - tezroq!
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Failed to fetch workers:', error);
        showAlert('Xatolik', `Ishchilarni yuklashda xatolik: ${error.message}`);
        return;
      }

      console.log('✅ Workers loaded:', data?.length || 0);
      setWorkers(data || []);
    } catch (error: any) {
      console.error('❌ Fetch workers error:', error);
      showAlert('Xatolik', `Xatolik: ${error.message}`);
    }
  };

  const fetchCompanies = async () => {
    try {
      console.log('📥 Fetching companies...');
      
      // Direct database query - tezroq!
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Failed to fetch companies:', error);
        showAlert('Xatolik', `Firmalarni yuklashda xatolik: ${error.message}`);
        return;
      }

      console.log('✅ Companies loaded:', data?.length || 0);
      setCompanies(data || []);
    } catch (error: any) {
      console.error('❌ Fetch companies error:', error);
      showAlert('Xatolik', `Xatolik: ${error.message}`);
    }
  };

  const toggleWorkerOnline = async (workerId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('workers')
        .update({
          is_online: !currentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workerId);

      if (error) {
        console.error('❌ Toggle worker online error:', error);
        showAlert('Xatolik', `Online holatini o'zgartirish xatoligi: ${error.message}`);
        return;
      }

      await fetchWorkers();
    } catch (error: any) {
      console.error('❌ Toggle worker online error:', error);
      showAlert('Xatolik', 'Online holatini o\'zgartirish xatoligi');
    }
  };

  const toggleCompanyOnline = async (companyId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          is_online: !currentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      if (error) {
        console.error('❌ Toggle company online error:', error);
        showAlert('Xatolik', `Online holatini o'zgartirish xatoligi: ${error.message}`);
        return;
      }

      await fetchCompanies();
    } catch (error: any) {
      console.error('❌ Toggle company online error:', error);
      showAlert('Xatolik', 'Online holatini o\'zgartirish xatoligi');
    }
  };

  const toggleWorkerBlock = async (workerId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('workers')
        .update({
          is_blocked: !currentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workerId);

      if (error) {
        console.error('❌ Toggle worker block error:', error);
        showAlert('Xatolik', `Bloklash holatini o'zgartirish xatoligi: ${error.message}`);
        return;
      }

      showAlert('Muvaffaqiyatli', !currentStatus ? 'Ishchi bloklandi' : 'Ishchi blokdan chiqarildi');
      await fetchWorkers();
    } catch (error: any) {
      console.error('❌ Toggle worker block error:', error);
      showAlert('Xatolik', 'Bloklash holatini o\'zgartirish xatoligi');
    }
  };

  const toggleCompanyBlock = async (companyId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          is_blocked: !currentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      if (error) {
        console.error('❌ Toggle company block error:', error);
        showAlert('Xatolik', `Bloklash holatini o'zgartirish xatoligi: ${error.message}`);
        return;
      }

      showAlert('Muvaffaqiyatli', !currentStatus ? 'Firma bloklandi' : 'Firma blokdan chiqarildi');
      await fetchCompanies();
    } catch (error: any) {
      console.error('❌ Toggle company block error:', error);
      showAlert('Xatolik', 'Bloklash holatini o\'zgartirish xatoligi');
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/');
    } catch (error: any) {
      console.error('❌ Logout error:', error);
      showAlert('Xatolik', 'Chiqishda xatolik');
    }
  };

  const handleEditConfig = (config: AppConfig) => {
    setSelectedConfig(config);
    setConfigValue(JSON.stringify(config.value, null, 2));
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedConfig) return;

    try {
      // Parse JSON value
      let parsedValue;
      try {
        parsedValue = JSON.parse(configValue);
      } catch (e) {
        showAlert('Xatolik', 'Noto\'g\'ri JSON format');
        return;
      }

      const { error } = await supabase
        .from('app_config')
        .update({
          value: parsedValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedConfig.id);

      if (error) throw error;

      showAlert('Muvaffaqiyatli', 'Konfiguratsiya yangilandi');
      setShowConfigModal(false);
      setSelectedConfig(null);
      await refreshConfigs();
    } catch (error: any) {
      console.error('❌ Failed to update config:', error);
      showAlert('Xatolik', 'Konfiguratsiyani yangilashda xatolik');
    }
  };

  const renderConfig = ({ item }: { item: AppConfig }) => (
    <Card style={styles.configCard}>
      <View style={styles.configHeader}>
        <View style={styles.configInfo}>
          <Text style={[styles.configKey, { color: theme.text }]}>{item.key}</Text>
          <Text style={[styles.configDescription, { color: theme.textSecondary }]}>
            {item.description || 'No description'}
          </Text>
        </View>
        <View style={[styles.categoryBadge, { backgroundColor: theme.primary + '20' }]}>
          <Text style={[styles.categoryText, { color: theme.primary }]}>
            {item.category}
          </Text>
        </View>
      </View>
      <View style={[styles.configValueContainer, { backgroundColor: theme.surfaceVariant }]}>
        <Text style={[styles.configValue, { color: theme.textSecondary }]} numberOfLines={3}>
          {JSON.stringify(item.value, null, 2)}
        </Text>
      </View>
      <Button
        title="Tahrirlash"
        onPress={() => handleEditConfig(item)}
        variant="outline"
        style={styles.editConfigButton}
      />
    </Card>
  );

  const renderUser = ({ item }: { item: UserProfile }) => (
    <Card style={styles.userCard}>
      <View style={styles.userInfo}>
        <View style={[styles.userAvatar, { backgroundColor: getRoleColor(item.role) + '20' }]}>
          <Ionicons name={getRoleIcon(item.role) as any} size={24} color={getRoleColor(item.role)} />
        </View>
        <View style={styles.userDetails}>
          <Text style={[styles.userName, { color: theme.text }]}>{item.name}</Text>
          <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{item.email}</Text>
        </View>
      </View>

      <View style={styles.roleSection}>
        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) + '20' }]}>
          <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
            {item.role.toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.changeButton, { borderColor: theme.primary }]}
          onPress={() => {
            setSelectedUser(item);
            setShowRoleModal(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.changeButtonText, { color: theme.primary }]}>
            {t.changeStatus || 'O\'zgartirish'}
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  if (roleLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Admin Panel</Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <TouchableOpacity onPress={() => {
            if (activeTab === 'users') fetchUsers();
            else if (activeTab === 'workers') fetchWorkers();
            else if (activeTab === 'companies') fetchCompanies();
            else if (activeTab === 'orders') fetchAllOrders();
            else refreshConfigs();
          }}>
            <Ionicons name="refresh" size={24} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={theme.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mainTabsContainer} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
        <TouchableOpacity
          style={[
            styles.mainTab,
            activeTab === 'users' && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => setActiveTab('users')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people"
            size={18}
            color={activeTab === 'users' ? '#FFFFFF' : theme.primary}
          />
          <Text style={[styles.mainTabText, { color: activeTab === 'users' ? '#FFFFFF' : theme.primary }]}>
            Users
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.mainTab,
            activeTab === 'workers' && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => setActiveTab('workers')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="hammer"
            size={18}
            color={activeTab === 'workers' ? '#FFFFFF' : theme.primary}
          />
          <Text style={[styles.mainTabText, { color: activeTab === 'workers' ? '#FFFFFF' : theme.primary }]}>
            Ishchilar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.mainTab,
            activeTab === 'companies' && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => setActiveTab('companies')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="business"
            size={18}
            color={activeTab === 'companies' ? '#FFFFFF' : theme.primary}
          />
          <Text style={[styles.mainTabText, { color: activeTab === 'companies' ? '#FFFFFF' : theme.primary }]}>
            Firmalar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.mainTab,
            activeTab === 'orders' && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => { setActiveTab('orders'); fetchAllOrders(); }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="receipt"
            size={18}
            color={activeTab === 'orders' ? '#FFFFFF' : theme.primary}
          />
          <Text style={[styles.mainTabText, { color: activeTab === 'orders' ? '#FFFFFF' : theme.primary }]}>
            Buyurtmalar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.mainTab,
            activeTab === 'config' && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => setActiveTab('config')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="settings"
            size={18}
            color={activeTab === 'config' ? '#FFFFFF' : theme.primary}
          />
          <Text style={[styles.mainTabText, { color: activeTab === 'config' ? '#FFFFFF' : theme.primary }]}>
            Config
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {activeTab === 'users' && (
        <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.primary }]}>{users.length}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Users</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.error }]}>
            {users.filter(u => u.role === 'admin').length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Admins</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.primary }]}>
            {users.filter(u => u.role === 'worker').length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Workers</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.warning }]}>
            {users.filter(u => u.role === 'company').length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Companies</Text>
        </Card>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : activeTab === 'users' ? (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.usersList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No users found
              </Text>
            </View>
          }
        />
      ) : activeTab === 'workers' ? (
        <FlatList
          data={workers}
          renderItem={({ item }) => (
            <Card style={styles.userCard}>
              <View style={styles.userInfo}>
                <View style={[styles.userAvatar, { backgroundColor: theme.primary + '20' }]}>
                  <Ionicons name="hammer" size={24} color={theme.primary} />
                </View>
                <View style={styles.userDetails}>
                  <Text style={[styles.userName, { color: theme.text }]}>{item.full_name}</Text>
                  <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{item.phone}</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs / 2 }}>
                    <Text style={[styles.userEmail, { color: theme.textSecondary }]}>⭐ {item.rating}</Text>
                    <Text style={[styles.userEmail, { color: theme.textSecondary }]}>• {item.completed_orders} orders</Text>
                  </View>
                </View>
              </View>

              <View style={styles.roleSection}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity
                    style={[
                      styles.statusBadge,
                      { backgroundColor: item.is_online ? theme.success + '20' : theme.textTertiary + '20' },
                    ]}
                    onPress={() => toggleWorkerOnline(item.id, item.is_online)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.is_online ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={item.is_online ? theme.success : theme.textTertiary}
                    />
                    <Text style={[styles.statusText, { color: item.is_online ? theme.success : theme.textTertiary }]}>
                      {item.is_online ? 'Online' : 'Offline'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusBadge,
                      { backgroundColor: item.is_blocked ? theme.error + '20' : theme.warning + '20' },
                    ]}
                    onPress={() => toggleWorkerBlock(item.id, item.is_blocked)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.is_blocked ? 'lock-closed' : 'lock-open'}
                      size={16}
                      color={item.is_blocked ? theme.error : theme.warning}
                    />
                    <Text style={[styles.statusText, { color: item.is_blocked ? theme.error : theme.warning }]}>
                      {item.is_blocked ? 'Blocked' : 'Active'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.usersList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="hammer-outline" size={64} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Ishchilar topilmadi
              </Text>
            </View>
          }
        />
      ) : activeTab === 'companies' ? (
        <FlatList
          data={companies}
          renderItem={({ item }) => (
            <Card style={styles.userCard}>
              <View style={styles.userInfo}>
                <View style={[styles.userAvatar, { backgroundColor: theme.warning + '20' }]}>
                  <Ionicons name="business" size={24} color={theme.warning} />
                </View>
                <View style={styles.userDetails}>
                  <Text style={[styles.userName, { color: theme.text }]}>{item.company_name}</Text>
                  <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{item.phone}</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs / 2 }}>
                    <Text style={[styles.userEmail, { color: theme.textSecondary }]}>⭐ {item.rating}</Text>
                    <Text style={[styles.userEmail, { color: theme.textSecondary }]}>• {item.completed_orders} orders</Text>
                  </View>
                </View>
              </View>

              <View style={styles.roleSection}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity
                    style={[
                      styles.statusBadge,
                      { backgroundColor: item.is_online ? theme.success + '20' : theme.textTertiary + '20' },
                    ]}
                    onPress={() => toggleCompanyOnline(item.id, item.is_online)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.is_online ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={item.is_online ? theme.success : theme.textTertiary}
                    />
                    <Text style={[styles.statusText, { color: item.is_online ? theme.success : theme.textTertiary }]}>
                      {item.is_online ? 'Online' : 'Offline'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusBadge,
                      { backgroundColor: item.is_blocked ? theme.error + '20' : theme.warning + '20' },
                    ]}
                    onPress={() => toggleCompanyBlock(item.id, item.is_blocked)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.is_blocked ? 'lock-closed' : 'lock-open'}
                      size={16}
                      color={item.is_blocked ? theme.error : theme.warning}
                    />
                    <Text style={[styles.statusText, { color: item.is_blocked ? theme.error : theme.warning }]}>
                      {item.is_blocked ? 'Blocked' : 'Active'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.usersList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={64} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Firmalar topilmadi
              </Text>
            </View>
          }
        />
      ) : activeTab === 'orders' ? (
        <View style={{ flex: 1 }}>
          {/* Status filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, paddingVertical: spacing.sm }}
            contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
          >
            {[
              { key: 'all', label: 'Barchasi', color: '#6B7280' },
              { key: 'pending', label: 'Kutilmoqda', color: '#F59E0B' },
              { key: 'accepted', label: 'Qabul qilindi', color: '#3B82F6' },
              { key: 'in_progress', label: 'Jarayonda', color: '#8B5CF6' },
              { key: 'completed', label: 'Bajarildi', color: '#10B981' },
              { key: 'cancelled', label: 'Bekor qilindi', color: '#EF4444' },
            ].map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: ordersFilter === f.key ? f.color : 'transparent',
                    borderColor: f.color,
                  },
                ]}
                onPress={() => setOrdersFilter(f.key)}
                activeOpacity={0.75}
              >
                <Text style={{ color: ordersFilter === f.key ? '#FFF' : f.color, fontSize: 12, fontWeight: '600' }}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {ordersLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={ordersFilter === 'all' ? allOrders : allOrders.filter((o) => o.status === ordersFilter)}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.usersList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const statusColors: Record<string, string> = {
                  pending: '#F59E0B',
                  accepted: '#3B82F6',
                  in_progress: '#8B5CF6',
                  completed: '#10B981',
                  cancelled: '#EF4444',
                };
                const statusLabels: Record<string, string> = {
                  pending: 'Kutilmoqda',
                  accepted: 'Qabul qilindi',
                  in_progress: 'Jarayonda',
                  completed: 'Bajarildi',
                  cancelled: 'Bekor qilindi',
                };
                const sColor = statusColors[item.status] || '#6B7280';
                return (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => { setSelectedOrder(item); setShowOrderModal(true); }}
                  >
                    <Card style={styles.userCard}>
                      {/* Header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm }}>
                        <Text style={{ fontSize: 22 }}>{item.category?.icon || '📋'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
                          <Text style={[styles.userEmail, { color: theme.textSecondary }]} numberOfLines={1}>
                            {item.category?.name_uz || 'Kategoriya'}
                          </Text>
                        </View>
                        <View style={[styles.roleBadge, { backgroundColor: sColor + '20' }]}>
                          <Text style={[styles.roleText, { color: sColor }]}>
                            {statusLabels[item.status] || item.status}
                          </Text>
                        </View>
                      </View>

                      {/* Buyurtmachi */}
                      <View style={styles.orderInfoRow}>
                        <Ionicons name="person-outline" size={14} color={theme.primary} />
                        <Text style={[styles.orderInfoText, { color: theme.text }]}>
                          {item.customer?.name || 'Noma\'lum'}
                        </Text>
                        {item.customer?.email ? (
                          <Text style={[styles.orderInfoSub, { color: theme.textSecondary }]} numberOfLines={1}>
                            · {item.customer.email}
                          </Text>
                        ) : null}
                      </View>

                      {/* Ishchi */}
                      <View style={styles.orderInfoRow}>
                        <Ionicons name="hammer-outline" size={14} color={item.worker ? theme.success : theme.textTertiary} />
                        <Text style={[styles.orderInfoText, { color: item.worker ? theme.text : theme.textTertiary }]}>
                          {item.worker ? item.worker.full_name : 'Ishchi tayinlanmagan'}
                        </Text>
                        {item.worker?.phone ? (
                          <Text style={[styles.orderInfoSub, { color: theme.textSecondary }]}>
                            · {item.worker.phone}
                          </Text>
                        ) : null}
                      </View>

                      {/* Manzil */}
                      <View style={styles.orderInfoRow}>
                        <Ionicons name="location-outline" size={14} color={theme.warning} />
                        <Text style={[styles.orderInfoText, { color: theme.textSecondary }]} numberOfLines={1}>
                          {item.location && !/^-?\d+\./.test(item.location)
                            ? item.location
                            : item.latitude
                            ? `${item.latitude.toFixed(5)}, ${item.longitude?.toFixed(5)}`
                            : 'Manzil yo\'q'}
                        </Text>
                      </View>

                      <Text style={[styles.userEmail, { color: theme.textTertiary, textAlign: 'right', marginTop: spacing.xs }]}>
                        {new Date(item.created_at).toLocaleString('uz-UZ')}
                      </Text>
                    </Card>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="receipt-outline" size={64} color={theme.textTertiary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Buyurtmalar topilmadi</Text>
                </View>
              }
            />
          )}
        </View>
      ) : (
        <FlatList
          data={configs}
          renderItem={renderConfig}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.usersList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="settings-outline" size={64} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Konfiguratsiya topilmadi
              </Text>
            </View>
          }
        />
      )}

      {/* Role Change Modal */}
      <Modal visible={showRoleModal} transparent animationType="fade" onRequestClose={() => setShowRoleModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalOverlayTouch} 
            activeOpacity={1} 
            onPress={() => setShowRoleModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Select Role for {selectedUser?.name}
            </Text>

            {(['customer', 'worker', 'company', 'admin'] as UserRole[]).map((roleOption) => (
              <TouchableOpacity
                key={roleOption}
                style={[
                  styles.roleOption,
                  { borderBottomColor: theme.border },
                  selectedUser?.role === roleOption && { backgroundColor: theme.surfaceVariant },
                  isUpdatingRole && { opacity: 0.5 },
                ]}
                onPress={() => handleRoleChange(roleOption)}
                activeOpacity={0.7}
                disabled={isUpdatingRole}
              >
                <View style={styles.roleOptionContent}>
                  <Ionicons 
                    name={getRoleIcon(roleOption) as any} 
                    size={24} 
                    color={getRoleColor(roleOption)} 
                  />
                  <Text style={[styles.roleOptionText, { color: theme.text }]}>
                    {roleOption.charAt(0).toUpperCase() + roleOption.slice(1)}
                  </Text>
                </View>
                {selectedUser?.role === roleOption && !isUpdatingRole && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                )}
                {isUpdatingRole && selectedUser?.role !== roleOption && (
                  <ActivityIndicator size="small" color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}

            {isUpdatingRole && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.text }]}>Yangilanmoqda...</Text>
              </View>
            )}

            <Button 
              title={t.cancel} 
              onPress={() => setShowRoleModal(false)} 
              variant="outline" 
              style={styles.modalCancelButton} 
            />
          </View>
        </View>
      </Modal>

      {/* Config Edit Modal */}
      <Modal
        visible={showConfigModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfigModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouch}
            activeOpacity={1}
            onPress={() => setShowConfigModal(false)}
          />
          <View style={[styles.configModalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {selectedConfig?.key}
            </Text>
            <Text style={[styles.configModalDescription, { color: theme.textSecondary }]}>
              {selectedConfig?.description}
            </Text>

            <ScrollView style={styles.configInputContainer} nestedScrollEnabled>
              <TextInput
                value={configValue}
                onChangeText={setConfigValue}
                multiline
                style={[
                  styles.configInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="JSON value"
                placeholderTextColor={theme.textTertiary}
              />
            </ScrollView>

            <View style={styles.configModalButtons}>
              <Button
                title="Bekor qilish"
                onPress={() => setShowConfigModal(false)}
                variant="outline"
                style={styles.configModalButton}
              />
              <Button
                title="Saqlash"
                onPress={handleSaveConfig}
                style={styles.configModalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
      {/* Order Detail Modal */}
      <Modal visible={showOrderModal} transparent animationType="fade" onRequestClose={() => setShowOrderModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalOverlayTouch} activeOpacity={1} onPress={() => setShowOrderModal(false)} />
          <View style={[styles.orderModalContent, { backgroundColor: theme.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
              <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 0 }]}>
                {selectedOrder?.category?.icon} {selectedOrder?.title}
              </Text>
              <TouchableOpacity onPress={() => setShowOrderModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Status */}
              {selectedOrder && (() => {
                const statusColors: Record<string, string> = { pending: '#F59E0B', accepted: '#3B82F6', in_progress: '#8B5CF6', completed: '#10B981', cancelled: '#EF4444' };
                const statusLabels: Record<string, string> = { pending: 'Kutilmoqda', accepted: 'Qabul qilindi', in_progress: 'Jarayonda', completed: 'Bajarildi', cancelled: 'Bekor qilindi' };
                const sc = statusColors[selectedOrder.status] || '#6B7280';
                return (
                  <View style={[styles.modalSection, { backgroundColor: sc + '15', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md }]}>
                    <Text style={{ color: sc, fontWeight: '700', fontSize: 16 }}>{statusLabels[selectedOrder.status]}</Text>
                  </View>
                );
              })()}

              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>📋 Tavsif</Text>
                <Text style={[styles.modalSectionValue, { color: theme.text }]}>{selectedOrder?.description}</Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>👤 Buyurtmachi</Text>
                <Text style={[styles.modalSectionValue, { color: theme.text }]}>{selectedOrder?.customer?.name || 'Noma\'lum'}</Text>
                {selectedOrder?.customer?.email ? (
                  <Text style={[styles.modalSectionSub, { color: theme.textSecondary }]}>{selectedOrder.customer.email}</Text>
                ) : null}
                {selectedOrder?.customer_phone ? (
                  <Text style={[styles.modalSectionSub, { color: theme.primary }]}>📞 {selectedOrder.customer_phone}</Text>
                ) : null}
              </View>

              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>🔨 Ishchi</Text>
                {selectedOrder?.worker ? (
                  <>
                    <Text style={[styles.modalSectionValue, { color: theme.text }]}>{selectedOrder.worker.full_name}</Text>
                    <Text style={[styles.modalSectionSub, { color: theme.primary }]}>📞 {selectedOrder.worker.phone}</Text>
                  </>
                ) : (
                  <Text style={[styles.modalSectionValue, { color: theme.textTertiary }]}>Tayinlanmagan</Text>
                )}
              </View>

              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>📍 Manzil</Text>
                <Text style={[styles.modalSectionValue, { color: theme.text }]}>
                  {selectedOrder?.location && !/^-?\d+\./.test(selectedOrder.location)
                    ? selectedOrder.location
                    : selectedOrder?.latitude
                    ? `${selectedOrder.latitude.toFixed(6)}, ${selectedOrder.longitude?.toFixed(6)}`
                    : 'Ko\'rsatilmagan'}
                </Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>🕐 Vaqt</Text>
                <Text style={[styles.modalSectionSub, { color: theme.textSecondary }]}>
                  Yaratildi: {selectedOrder ? new Date(selectedOrder.created_at).toLocaleString('uz-UZ') : ''}
                </Text>
                <Text style={[styles.modalSectionSub, { color: theme.textSecondary }]}>
                  Yangilandi: {selectedOrder ? new Date(selectedOrder.updated_at).toLocaleString('uz-UZ') : ''}
                </Text>
              </View>
            </ScrollView>

            <Button title="Yopish" onPress={() => setShowOrderModal(false)} style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>

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
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 80,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  usersList: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  userCard: {
    marginBottom: spacing.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    ...typography.bodyMedium,
    marginBottom: spacing.xs / 2,
  },
  userEmail: {
    ...typography.small,
  },
  roleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  roleText: {
    ...typography.small,
    fontWeight: '600',
  },
  changeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  changeButtonText: {
    ...typography.small,
    fontWeight: '600',
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
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
  },
  filterChip: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs / 2,
  },
  orderInfoText: {
    ...typography.small,
    fontWeight: '500',
  },
  orderInfoSub: {
    ...typography.small,
    flex: 1,
  },
  orderModalContent: {
    width: '92%',
    maxWidth: 480,
    maxHeight: '85%',
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalSection: {
    marginBottom: spacing.md,
  },
  modalSectionTitle: {
    ...typography.small,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalSectionValue: {
    ...typography.bodyMedium,
    fontWeight: '500',
  },
  modalSectionSub: {
    ...typography.small,
    marginTop: spacing.xs / 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlayTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: spacing.lg,
  },
  roleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  roleOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  roleOptionText: {
    ...typography.bodyMedium,
  },
  modalCancelButton: {
    marginTop: spacing.lg,
  },
  mainTabsContainer: {
    paddingVertical: spacing.md,
  },
  mainTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    borderColor: '#E5E7EB',
    minWidth: 100,
  },
  mainTabText: {
    ...typography.small,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.small,
    fontWeight: '600',
    fontSize: 11,
  },
  configCard: {
    marginBottom: spacing.md,
  },
  configHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  configInfo: {
    flex: 1,
  },
  configKey: {
    ...typography.bodyMedium,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  configDescription: {
    ...typography.small,
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  categoryText: {
    ...typography.small,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  configValueContainer: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  configValue: {
    ...typography.small,
    fontFamily: 'monospace',
  },
  editConfigButton: {
    marginTop: spacing.xs,
  },
  configModalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  configModalDescription: {
    ...typography.small,
    marginBottom: spacing.lg,
  },
  configInputContainer: {
    maxHeight: 300,
    marginBottom: spacing.lg,
  },
  configInput: {
    ...typography.body,
    fontFamily: 'monospace',
    minHeight: 200,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    textAlignVertical: 'top',
  },
  configModalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  configModalButton: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: borderRadius.lg,
  },
});
