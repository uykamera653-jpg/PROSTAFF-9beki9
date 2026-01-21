import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { useJobs } from '../../hooks/useJobs';
import { useCompanies } from '../../hooks/useCompanies';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { spacing, typography, borderRadius } from '../../constants/theme';
import { Language } from '../../constants/translations';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t, language } = useTranslation();
  const { user, logout, updateProfile } = useAuth();
  const { darkMode, setDarkMode, setLanguage } = useSettings();
  const { getUserJobs } = useJobs();
  const { getUserOrders } = useCompanies();

  const myJobs = user ? getUserJobs(user.id) : [];
  const myOrders = user ? getUserOrders(user.id) : [];
  const activeJobs = myJobs.filter(job => job.status === 'active').length;
  const completedOrders = myOrders.filter(order => order.status === 'completed').length;
  
  const [showNameModal, setShowNameModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');

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
    await logout();
    router.replace('/');
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
          <Text style={[styles.statsTitle, { color: theme.text }]}>{t.stats}</Text>
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
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: theme.surface }]}
            onPress={() => setShowNameModal(true)}
          >
            <Ionicons name="person-outline" size={24} color={theme.text} />
            <Text style={[styles.menuText, { color: theme.text }]}>{t.changeName}</Text>
            <Ionicons name="chevron-forward" size={24} color={theme.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: theme.surface }]}
            onPress={() => setShowLangModal(true)}
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
          >
            <Ionicons name="moon-outline" size={24} color={theme.text} />
            <Text style={[styles.menuText, { color: theme.text }]}>{t.darkMode}</Text>
            <View style={[styles.switch, { backgroundColor: darkMode ? theme.primary : theme.border }]}>
              <View style={[styles.switchThumb, { transform: [{ translateX: darkMode ? 20 : 2 }] }]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: theme.surface }]}
            onPress={handleHelpSupport}
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
      {Platform.OS === 'web' && (
        <Modal visible={showNameModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
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
      )}

      {/* Language Modal */}
      {Platform.OS === 'web' && (
        <Modal visible={showLangModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{t.changeLanguage}</Text>
              {(['uz', 'ru', 'en'] as Language[]).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langOption, { borderBottomColor: theme.border }]}
                  onPress={() => handleLanguageChange(lang)}
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
  modalContent: {
    width: '90%',
    maxWidth: 400,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
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
});
