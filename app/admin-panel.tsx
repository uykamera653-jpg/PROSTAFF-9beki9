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

export default function AdminPanelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { role: currentUserRole, isLoading: roleLoading } = useUserRole();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const { showAlert, AlertComponent } = useAlert();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasCheckedAuth = useRef(false);

  // Config management states
  const [activeTab, setActiveTab] = useState<'users' | 'config'>('users');
  const { configs, refreshConfigs } = useAppConfig();
  const [selectedConfig, setSelectedConfig] = useState<AppConfig | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configValue, setConfigValue] = useState('');

  // Auth check effect
  useEffect(() => {
    console.log('🔍 Admin panel useEffect triggered:', { roleLoading, currentUserRole });
    
    if (roleLoading) {
      console.log('⏳ Admin panel - Role loading...');
      return;
    }

    console.log('🔍 Admin panel - Current role:', currentUserRole);

    if (currentUserRole !== 'admin' && currentUserRole !== 'moderator') {
      console.log('⛔ Access denied - redirecting to home');
      // Immediate redirect without alert to avoid white screen
      router.replace('/');
      return;
    }

    console.log('✅ Admin access granted');
  }, [currentUserRole, roleLoading, router]);

  // Data fetching and real-time subscription effect
  useEffect(() => {
    if (roleLoading) return;
    if (currentUserRole !== 'admin' && currentUserRole !== 'moderator') return;

    // Initial fetch
    fetchUsers();

    // Setup real-time subscription
    channelRef.current = supabase
      .channel('user_profiles_admin_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles',
        },
        () => {
          // Re-fetch when any change occurs
          fetchUsers();
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
      setIsLoading(true);
      
      // Call Edge Function instead of direct database query
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        console.error('❌ No session');
        setUsers([]);
        return;
      }

      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/admin-operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ operation: 'get_users' }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to fetch users:', errorText);
        showAlert('Xatolik', `Foydalanuvchilarni yuklashda xatolik: ${errorText}`);
        setUsers([]);
        return;
      }

      const result = await response.json();
      if (result.users) {
        setUsers(result.users);
      }
    } catch (error: any) {
      console.error('❌ Fetch users error:', error);
      showAlert('Xatolik', 'Foydalanuvchilarni yuklashda xatolik');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (newRole: UserRole) => {
    if (!selectedUser) return;

    try {
      // Call Edge Function instead of direct database update
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        showAlert('Xatolik', 'Session yo\'q');
        return;
      }

      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/admin-operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          operation: 'update_role',
          user_id: selectedUser.id,
          new_role: newRole,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to update role:', errorText);
        showAlert('Xatolik', `Rolni yangilashda xatolik: ${errorText}`);
        return;
      }

      const result = await response.json();
      if (result.success) {
        showAlert('Muvaffaqiyatli', result.message || `Rol ${newRole}ga o'zgartirildi`);
        setShowRoleModal(false);
        setSelectedUser(null);
        
        // Force refresh to ensure latest data
        await fetchUsers();
      }
    } catch (error: any) {
      console.error('❌ Role change error:', error);
      showAlert('Xatolik', 'Rolni yangilashda xatolik yuz berdi');
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
    console.log('📺 Rendering loading screen - roleLoading:', roleLoading);
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Admin Panel</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Yuklanmoqda...</Text>
        </View>
      </View>
    );
  }

  console.log('📺 Rendering admin panel main content');

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Admin Panel</Text>
        <TouchableOpacity onPress={activeTab === 'users' ? fetchUsers : refreshConfigs}>
          <Ionicons name="refresh" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.mainTabsContainer}>
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
            size={20}
            color={activeTab === 'users' ? '#FFFFFF' : theme.primary}
          />
          <Text style={[styles.mainTabText, { color: activeTab === 'users' ? '#FFFFFF' : theme.primary }]}>
            Foydalanuvchilar
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
            size={20}
            color={activeTab === 'config' ? '#FFFFFF' : theme.primary}
          />
          <Text style={[styles.mainTabText, { color: activeTab === 'config' ? '#FFFFFF' : theme.primary }]}>
            Konfiguratsiya
          </Text>
        </TouchableOpacity>
      </View>

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

      {activeTab === 'users' && isLoading ? (
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
                ]}
                onPress={() => handleRoleChange(roleOption)}
                activeOpacity={0.7}
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
                {selectedUser?.role === roleOption && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                )}
              </TouchableOpacity>
            ))}

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
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  mainTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    borderColor: '#E5E7EB',
  },
  mainTabText: {
    ...typography.bodyMedium,
    fontWeight: '600',
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
});
