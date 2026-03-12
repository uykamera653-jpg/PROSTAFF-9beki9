import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useJobs } from '../../hooks/useJobs';
import { useCompanies } from '../../hooks/useCompanies';
import { useWorkers } from '../../hooks/useWorkers';
import { useUserRole } from '../../hooks/useUserRole';
import { Card } from '../../components/ui/Card';
import { spacing, typography, borderRadius, shadows } from '../../constants/theme';

const { width } = Dimensions.get('window');
const cardWidth = Math.min(width - spacing.xl * 2, 500);

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Auto-redirect based on role
  useEffect(() => {
    if (!roleLoading && user) {
      if (role === 'worker') {
        router.replace('/worker-dashboard');
      } else if (role === 'company') {
        router.replace('/company-dashboard');
      }
    }
  }, [role, roleLoading, user]);



  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Show loading while checking role
  if (roleLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t.loading || 'Yuklanmoqda...'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <Text style={[styles.appName, { color: theme.text }]}>{t.appName}</Text>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Ionicons name="person-circle" size={28} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Welcome Section */}
        <Animated.View
          style={[
            styles.welcomeSection,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={[styles.welcomeText, { color: theme.textSecondary }]}>
            {user ? `Salom, ${user.name}` : t.appName}
          </Text>
          <Text style={[styles.welcomeSubtext, { color: theme.text }]}>
            {t.chooseServiceType}
          </Text>
        </Animated.View>

        {/* Role-based interface */}
        {(role === 'admin' || role === 'moderator') ? (
          // Admin Dashboard
          <TouchableOpacity
            style={[styles.serviceCard, { maxWidth: cardWidth }]}
            onPress={() => router.push('/admin-panel')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.cardGradient, shadows.lg]}
            >
              <View style={styles.cardIconContainer}>
                <Ionicons name="shield-checkmark" size={48} color="#FFFFFF" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Admin Panel</Text>
                <Text style={styles.cardDescription}>Foydalanuvchilarni boshqarish va rollarni o'rnatish</Text>
              </View>
              <View style={styles.cardArrow}>
                <Ionicons name="arrow-forward" size={28} color="rgba(255,255,255,0.8)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : role === 'worker' ? (
          // Worker Dashboard
          <TouchableOpacity
            style={[styles.serviceCard, { maxWidth: cardWidth }]}
            onPress={() => router.push('/worker-dashboard')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.cardGradient, shadows.lg]}
            >
              <View style={styles.cardIconContainer}>
                <Ionicons name="briefcase" size={48} color="#FFFFFF" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Ishchi paneli</Text>
                <Text style={styles.cardDescription}>Buyurtmalarni ko'ring va qabul qiling</Text>
              </View>
              <View style={styles.cardArrow}>
                <Ionicons name="arrow-forward" size={28} color="rgba(255,255,255,0.8)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : role === 'company' ? (
          // Company Dashboard
          <TouchableOpacity
            style={[styles.serviceCard, { maxWidth: cardWidth }]}
            onPress={() => router.push('/company-dashboard')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.cardGradient, shadows.lg]}
            >
              <View style={styles.cardIconContainer}>
                <Ionicons name="business" size={48} color="#FFFFFF" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Firma paneli</Text>
                <Text style={styles.cardDescription}>Xizmat buyurtmalarini boshqaring</Text>
              </View>
              <View style={styles.cardArrow}>
                <Ionicons name="arrow-forward" size={28} color="rgba(255,255,255,0.8)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          // Customer Interface (default)
          <>
            <TouchableOpacity
              style={[styles.serviceCard, { maxWidth: cardWidth }]}
              onPress={() => router.push('/daily-workers')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cardGradient, shadows.lg]}
              >
                <View style={styles.cardIconContainer}>
                  <Ionicons name="hammer" size={48} color="#FFFFFF" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{t.dailyWorkers}</Text>
                  <Text style={styles.cardDescription}>{t.dailyWorkersDesc}</Text>
                </View>
                <View style={styles.cardArrow}>
                  <Ionicons name="arrow-forward" size={28} color="rgba(255,255,255,0.8)" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.serviceCard, { maxWidth: cardWidth }]}
              onPress={() => router.push('/(tabs)/companies')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cardGradient, shadows.lg]}
              >
                <View style={styles.cardIconContainer}>
                  <Ionicons name="business" size={48} color="#FFFFFF" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{t.serviceCompanies}</Text>
                  <Text style={styles.cardDescription}>{t.serviceCompaniesDesc}</Text>
                </View>
                <View style={styles.cardArrow}>
                  <Ionicons name="arrow-forward" size={28} color="rgba(255,255,255,0.8)" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
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
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  appName: {
    ...typography.h2,
    fontWeight: '700',
  },
  profileButton: {
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  serviceCard: {
    width: '100%',
  },
  cardGradient: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 140,
  },
  cardIconContainer: {
    width: 70,
    height: 70,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    ...typography.h2,
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  cardDescription: {
    ...typography.body,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
  },
  cardArrow: {
    marginLeft: spacing.md,
  },
  welcomeSection: {
    width: '100%',
    maxWidth: cardWidth,
    marginBottom: spacing.lg,
  },
  welcomeText: {
    ...typography.body,
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  welcomeSubtext: {
    ...typography.h1,
    fontSize: 28,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
  },
});
