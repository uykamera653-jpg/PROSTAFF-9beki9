import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
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

  // Auth check effect
  useEffect(() => {
    if (roleLoading || hasCheckedAuth.current) return;

    if (currentUserRole !== 'admin' && currentUserRole !== 'moderator') {
      hasCheckedAuth.current = true;
      showAlert('Kirish rad etildi', 'Faqat administratorlar bu sahifaga kirishi mumkin.', [
        { text: 'OK', onPress: () => router.replace('/') }
      ]);
      return;
    }

    hasCheckedAuth.current = true;
  }, [currentUserRole, roleLoading]);

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
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name, email, role, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        setUsers([]);
        return;
      }
      
      if (data) {
        setUsers(data);
      }
    } catch (error) {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (newRole: UserRole) => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', selectedUser.id);

      if (error) {
        showAlert('Xatolik', `Rolni yangilab bo'lmadi: ${error.message}`);
        return;
      }

      // Success - modal will close and data will update via real-time subscription
      showAlert('Muvaffaqiyatli', `Rol ${newRole}ga o'zgartirildi`);
      setShowRoleModal(false);
      setSelectedUser(null);
      
      // Force refresh to ensure latest data
      await fetchUsers();
    } catch (error) {
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Admin Panel</Text>
        <TouchableOpacity onPress={fetchUsers}>
          <Ionicons name="refresh" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

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

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
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
});
