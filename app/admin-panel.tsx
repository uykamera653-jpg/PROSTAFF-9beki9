import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useUserRole, UserRole } from '../hooks/useUserRole';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { spacing, typography, borderRadius } from '../constants/theme';
import { supabase } from '../lib/supabase';

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

  useEffect(() => {
    // Check if user is admin
    if (!roleLoading && currentUserRole !== 'admin') {
      Alert.alert('Access Denied', 'Only administrators can access this page.');
      router.back();
      return;
    }

    if (currentUserRole === 'admin') {
      fetchUsers();
    }
  }, [currentUserRole, roleLoading]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch users:', error.message);
        showAlert('Error', `Failed to load users: ${error.message}`);
      } else if (data) {
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showAlert('Error', 'An error occurred while loading users');
    } finally {
      setIsLoading(false);
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleRoleChange = async (newRole: UserRole) => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', selectedUser.id);

      if (error) {
        console.error('Failed to update role:', error.message);
        showAlert('Error', `Failed to update role: ${error.message}`);
      } else {
        showAlert('Success', `Role updated to ${newRole} successfully`);
        setUsers(users.map(u => 
          u.id === selectedUser.id ? { ...u, role: newRole } : u
        ));
        setShowRoleModal(false);
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('Error updating role:', error);
      showAlert('Error', 'An error occurred while updating role');
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

  if (roleLoading || (currentUserRole !== 'admin' && !roleLoading)) {
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
