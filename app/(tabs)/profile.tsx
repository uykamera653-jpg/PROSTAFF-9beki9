import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Modal, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { useJobs } from '../../hooks/useJobs';
import { useCompanies } from '../../hooks/useCompanies';
import { useUserRole } from '../../hooks/useUserRole';
import { useNotificationSettings } from '../../hooks/useNotificationSettings';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { spacing, typography, borderRadius } from '../../constants/theme';
import { Language } from '../../constants/translations';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t, language } = useTranslation();
  const { user, logout, updateProfile } = useAuth();
  const { darkMode, setDarkMode, setLanguage } = useSettings();
  const { getUserJobs } = useJobs();
  const { getUserOrders } = useCompanies();
  const { role, refetch: refetchRole } = useUserRole();

  const myJobs = user ? getUserJobs(user.id) : [];
  const myOrders = user ? getUserOrders(user.id) : [];
  const activeJobs = myJobs.filter(job => job.status === 'active').length;
  const completedOrders = myOrders.filter(order => order.status === 'completed').length;
  
  const [showNameModal, setShowNameModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [hasCompanyProfile, setHasCompanyProfile] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  
  // Notification settings
  const { settings: notifSettings, loading: notifLoading, updateSettings } = useNotificationSettings();

  // Auto-refresh role and check company profile when screen is focused
  useEffect(() => {
    if (user) {
      refetchRole(); // Refresh role when profile opens
      if (role === 'company') {
        checkCompanyProfile();
      }
    }
  }, [user, role]);

  const checkCompanyProfile = async () => {
    if (!user?.id) return;
    
    setIsCheckingProfile(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('id', user.id)
        .single();

      if (data) {
        setHasCompanyProfile(true);
      } else {
        setHasCompanyProfile(false);
      }
    } catch (error) {
      setHasCompanyProfile(false);
    } finally {
      setIsCheckingProfile(false);
    }
  };

  const handleSaveName = async () => {
    if (newName.trim()) {
      await updateProfile(newName.trim());
      setShowNameModal(false);
    }
  };

  const handleLanguageChange = async (lang: Language) => {
    await setLanguage(lang);
    setShowLangModal(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/');
    } catch (error) {
      router.replace('/');
    }
  };

  const handleHelpSupport = () => {
    const phone = '+998501017695';
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{t.profile}</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={[styles.userName, { color: theme.text }]}>{user?.name}</Text>
          <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{user?.email}</Text>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={[styles.statsTitle, { color: theme.text }]}>{t.stats}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text style={[styles.debugText, { color: theme.textTertiary }]}>Role: {role}</Text>
              <TouchableOpacity onPress={refetchRole} style={{ padding: 4 }}>
                <Ionicons name="refresh" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{myJobs.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.totalAds}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{activeJobs}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.activeAds}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{myOrders.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.totalOrders}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{completedOrders}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.completedOrders}</Text>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          {role === 'company' && (
            isCheckingProfile ? (
              <View style={[styles.menuItem, { backgroundColor: theme.surface }]}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.menuText, { color: theme.textSecondary }]}>Tekshirilmoqda...</Text>
              </View>
            ) : hasCompanyProfile ? (
              <TouchableOpacity
                style={[styles.menuItem, { backgroundColor: theme.surface, borderLeftWidth: 3, borderLeftColor: theme.warning }]}
                onPress={() => router.push('/company-profile')}
                activeOpacity={0.7}
              >
                <Ionicons name="business" size={24} color={theme.warning} />
                <Text style={[styles.menuText, { color: theme.text, fontWeight: '600' }]}>Firma profili</Text>
                <Ionicons name="chevron-forward" size={24} color={theme.textTertiary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.menuItem, { backgroundColor: theme.surface, borderLeftWidth: 3, borderLeftColor: theme.warning }]}
                onPress={() => router.push('/company-onboarding')}
                activeOpacity={0.7}
              >
                <Ionicons name="business-outline" size={24} color={theme.warning} />
                <Text style={[styles.menuText, { color: theme.text, fontWeight: '600' }]}>Firma profili yaratish</Text>
                <Ionicons name="chevron-forward" size={24} color={theme.textTertiary} />
              </TouchableOpacity>
            )
          )}

          {(role === 'admin' || role === 'moderator') && (
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: theme.surface, borderLeftWidth: 3, borderLeftColor: theme.error }]}
              onPress={() => router.push('/admin-panel' as any)}
              activeOpacity={0.7}
            >
              <Ionicons name="shield-checkmark" size={24} color={theme.error} />
              <Text style={[styles.menuText, { color: theme.text, fontWeight: '600' }]}>{t.adminPanel}</Text>
              <Ionicons name="chevron-forward" size={24} color={theme.textTertiary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: theme.surface }]}
            onPress={() => setShowNameModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="person-outline" size={24} color={theme.text} />
            <Text style={[styles.menuText, { color: theme.text }]}>{t.changeName}</Text>
            <Ionicons name="chevron-forward" size={24} color={theme.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: theme.surface }]}
            onPress={() => setShowLangModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="language-outline" size={24} color={theme.text} />
            <Text style={[styles.menuText, { color: theme.text }]}>{t.changeLanguage}</Text>
            <Text style={[styles.menuValue, { color: theme.textSecondary }]}>
              {language.toUpperCase()}
            </Text>
            <Ionicons name="chevron-forward" size={24} color={theme.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: theme.surface }]}
            onPress={() => setDarkMode(!darkMode)}
            activeOpacity={0.7}
          >
            <Ionicons name="moon-outline" size={24} color={theme.text} />
            <Text style={[styles.menuText, { color: theme.text }]}>{t.darkMode}</Text>
            <View style={[styles.switch, { backgroundColor: darkMode ? theme.primary : theme.border }]}>
              <View style={[styles.switchThumb, { transform: [{ translateX: darkMode ? 20 : 2 }] }]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: theme.surface }]}
            onPress={() => setShowNotificationSettings(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color={theme.text} />
            <Text style={[styles.menuText, { color: theme.text }]}>Bildirishnomalar</Text>
            <Ionicons name="chevron-forward" size={24} color={theme.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: theme.surface }]}
            onPress={handleHelpSupport}
            activeOpacity={0.7}
          >
            <Ionicons name="call-outline" size={24} color={theme.text} />
            <Text style={[styles.menuText, { color: theme.text }]}>{t.helpSupport}</Text>
            <Text style={[styles.menuValue, { color: theme.primary }]}>
              +998501017695
            </Text>
          </TouchableOpacity>
        </View>

        <Button
          title={t.logout}
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutButton}
        />
      </ScrollView>

      {/* Name Edit Modal */}
      <Modal visible={showNameModal} transparent animationType="fade" onRequestClose={() => setShowNameModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalOverlayTouch} 
            activeOpacity={1} 
            onPress={() => setShowNameModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t.changeName}</Text>
            <Input
              value={newName}
              onChangeText={setNewName}
              placeholder={t.namePlaceholder}
            />
            <View style={styles.modalButtons}>
              <Button title={t.cancel} onPress={() => setShowNameModal(false)} variant="outline" />
              <Button title={t.save} onPress={handleSaveName} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Notification Settings Modal */}
      <Modal visible={showNotificationSettings} transparent animationType="fade" onRequestClose={() => setShowNotificationSettings(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalOverlayTouch} 
            activeOpacity={1} 
            onPress={() => setShowNotificationSettings(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Bildirishnoma sozlamalari</Text>
            
            <View style={styles.notifSection}>
              <TouchableOpacity
                style={[styles.notifItem, { borderBottomColor: theme.border }]}
                onPress={() => updateSettings({ enabled: !notifSettings.enabled })}
                activeOpacity={0.7}
                disabled={notifLoading}
              >
                <View style={styles.notifInfo}>
                  <Ionicons name="notifications" size={20} color={theme.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifLabel, { color: theme.text }]}>Bildirishnomalar</Text>
                    <Text style={[styles.notifDesc, { color: theme.textSecondary }]}>
                      Barcha bildirishnomalarni yoqish/o'chirish
                    </Text>
                  </View>
                </View>
                <View style={[styles.switch, { backgroundColor: notifSettings.enabled ? theme.primary : theme.border }]}>
                  <View style={[styles.switchThumb, { transform: [{ translateX: notifSettings.enabled ? 20 : 2 }] }]} />
                </View>
              </TouchableOpacity>

              {notifSettings.enabled && (
                <>
                  <TouchableOpacity
                    style={[styles.notifItem, { borderBottomColor: theme.border }]}
                    onPress={() => updateSettings({ new_orders: !notifSettings.new_orders })}
                    activeOpacity={0.7}
                    disabled={notifLoading}
                  >
                    <View style={styles.notifInfo}>
                      <Ionicons name="briefcase" size={20} color={theme.text} />
                      <Text style={[styles.notifLabel, { color: theme.text }]}>Yangi buyurtmalar</Text>
                    </View>
                    <View style={[styles.switch, { backgroundColor: notifSettings.new_orders ? theme.primary : theme.border }]}>
                      <View style={[styles.switchThumb, { transform: [{ translateX: notifSettings.new_orders ? 20 : 2 }] }]} />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.notifItem, { borderBottomColor: theme.border }]}
                    onPress={() => updateSettings({ order_updates: !notifSettings.order_updates })}
                    activeOpacity={0.7}
                    disabled={notifLoading}
                  >
                    <View style={styles.notifInfo}>
                      <Ionicons name="refresh" size={20} color={theme.text} />
                      <Text style={[styles.notifLabel, { color: theme.text }]}>Buyurtma yangilanishlari</Text>
                    </View>
                    <View style={[styles.switch, { backgroundColor: notifSettings.order_updates ? theme.primary : theme.border }]}>
                      <View style={[styles.switchThumb, { transform: [{ translateX: notifSettings.order_updates ? 20 : 2 }] }]} />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.notifItem, { borderBottomColor: theme.border }]}
                    onPress={() => updateSettings({ messages: !notifSettings.messages })}
                    activeOpacity={0.7}
                    disabled={notifLoading}
                  >
                    <View style={styles.notifInfo}>
                      <Ionicons name="chatbubble" size={20} color={theme.text} />
                      <Text style={[styles.notifLabel, { color: theme.text }]}>Xabarlar</Text>
                    </View>
                    <View style={[styles.switch, { backgroundColor: notifSettings.messages ? theme.primary : theme.border }]}>
                      <View style={[styles.switchThumb, { transform: [{ translateX: notifSettings.messages ? 20 : 2 }] }]} />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.notifItem, { borderBottomColor: theme.border }]}
                    onPress={() => updateSettings({ sound: !notifSettings.sound })}
                    activeOpacity={0.7}
                    disabled={notifLoading}
                  >
                    <View style={styles.notifInfo}>
                      <Ionicons name="volume-high" size={20} color={theme.text} />
                      <Text style={[styles.notifLabel, { color: theme.text }]}>Ovoz</Text>
                    </View>
                    <View style={[styles.switch, { backgroundColor: notifSettings.sound ? theme.primary : theme.border }]}>
                      <View style={[styles.switchThumb, { transform: [{ translateX: notifSettings.sound ? 20 : 2 }] }]} />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.notifItem, { borderBottomColor: 'transparent' }]}
                    onPress={() => updateSettings({ vibration: !notifSettings.vibration })}
                    activeOpacity={0.7}
                    disabled={notifLoading}
                  >
                    <View style={styles.notifInfo}>
                      <Ionicons name="phone-portrait" size={20} color={theme.text} />
                      <Text style={[styles.notifLabel, { color: theme.text }]}>Tebranish</Text>
                    </View>
                    <View style={[styles.switch, { backgroundColor: notifSettings.vibration ? theme.primary : theme.border }]}>
                      <View style={[styles.switchThumb, { transform: [{ translateX: notifSettings.vibration ? 20 : 2 }] }]} />
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <Button 
              title="Yopish" 
              onPress={() => setShowNotificationSettings(false)} 
              variant="outline" 
              style={styles.modalCancelButton} 
            />
          </View>
        </View>
      </Modal>

      {/* Language Modal */}
      <Modal visible={showLangModal} transparent animationType="fade" onRequestClose={() => setShowLangModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalOverlayTouch} 
            activeOpacity={1} 
            onPress={() => setShowLangModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t.changeLanguage}</Text>
            {(['uz', 'ru', 'en'] as Language[]).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.langOption, { borderBottomColor: theme.border }]}
                onPress={() => handleLanguageChange(lang)}
                activeOpacity={0.7}
              >
                <Text style={[styles.langText, { color: theme.text }]}>
                  {lang === 'uz' ? 'O\'zbekcha' : lang === 'ru' ? 'Русский' : 'English'}
                </Text>
                {language === lang && <Ionicons name="checkmark" size={24} color={theme.primary} />}
              </TouchableOpacity>
            ))}
            <Button title={t.cancel} onPress={() => setShowLangModal(false)} variant="outline" style={styles.modalCancelButton} />
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
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    ...typography.h1,
    color: '#FFFFFF',
  },
  userName: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  userEmail: {
    ...typography.body,
  },
  statsTitle: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statValue: {
    ...typography.h2,
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  menuText: {
    ...typography.bodyMedium,
    flex: 1,
  },
  menuValue: {
    ...typography.body,
  },
  switch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  logoutButton: {
    marginTop: spacing.lg,
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
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  langOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  langText: {
    ...typography.bodyMedium,
  },
  modalCancelButton: {
    marginTop: spacing.lg,
  },
  debugText: {
    ...typography.small,
    fontStyle: 'italic',
  },
  notifSection: {
    marginBottom: spacing.lg,
  },
  notifItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  notifInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  notifLabel: {
    ...typography.bodyMedium,
    fontWeight: '500',
  },
  notifDesc: {
    ...typography.small,
    marginTop: spacing.xs / 2,
  },
});
