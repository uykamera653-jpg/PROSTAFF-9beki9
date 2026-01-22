import React, { useEffect, useRef } from 'react';
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


  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;



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

        {/* Service Cards */}
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

        {/* Service Companies Card */}
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

});
