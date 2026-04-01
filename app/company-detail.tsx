import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { spacing, typography, borderRadius } from '../constants/theme';
import { supabase } from '../lib/supabase';

interface CompanyData {
  id: string;
  company_name: string;
  description: string;
  phone: string;
  images: string[];
  rating: number;
  completed_orders: number;
  is_online: boolean;
  avatar_url?: string;
  latitude?: number;
  longitude?: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  customer_id: string;
  customer_name?: string;
}

export default function CompanyDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'reviews'>('info');
  const [screenWidth, setScreenWidth] = useState(() => Math.max(375, Dimensions.get('window').width));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(Math.max(375, window.width));
    });
    return () => sub?.remove();
  }, []);

  const companyId = params.id as string;

  useEffect(() => {
    if (companyId) {
      loadCompany();
      loadReviews();
    }
  }, [companyId]);

  const loadCompany = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (error) throw error;
      setCompany(data);
    } catch (e) {
      setCompany(null);
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('company_reviews')
        .select('*, user_profiles(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const mapped = (data || []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment || '',
        created_at: r.created_at,
        customer_id: r.customer_id,
        customer_name: r.user_profiles?.name || 'Foydalanuvchi',
      }));
      setReviews(mapped);
    } catch {
      setReviews([]);
    }
  };

  const handleCall = () => {
    if (company?.phone) Linking.openURL(`tel:${company.phone}`);
  };

  const handleOrder = () => {
    if (!company) return;
    router.push({
      pathname: '/order-service',
      params: {
        companyId: company.id,
        companyName: company.company_name,
        serviceType: 'Xizmat buyurtmasi',
      },
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!company) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="business-outline" size={64} color={theme.textTertiary} />
        <Text style={[styles.errorText, { color: theme.text, marginTop: spacing.md }]}>
          Firma topilmadi
        </Text>
        <Button title="Ortga" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  const photoUrls = Array.isArray(company.images) && company.images.length > 0
    ? company.images
    : ['https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800'];

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : company.rating || 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {company.company_name}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Gallery */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.imageGallery}
        >
          {photoUrls.map((url, index) => (
            <Image
              key={index}
              source={{ uri: url }}
              style={[styles.image, { width: screenWidth }]}
              contentFit="cover"
            />
          ))}
        </ScrollView>

        {/* Company Info */}
        <Card style={styles.infoCard}>
          <View style={styles.titleRow}>
            {company.avatar_url ? (
              <Image
                source={{ uri: company.avatar_url }}
                style={styles.avatar}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="business" size={28} color={theme.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.companyName, { color: theme.text }]}>
                {company.company_name}
              </Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color="#FFB800" />
                <Text style={[styles.ratingText, { color: theme.text }]}>
                  {averageRating.toFixed(1)}
                </Text>
                <Text style={[styles.reviewCount, { color: theme.textSecondary }]}>
                  ({reviews.length} sharh)
                </Text>
                <View style={[
                  styles.onlineBadge,
                  { backgroundColor: company.is_online ? '#10B981' + '20' : '#9CA3AF20' }
                ]}>
                  <View style={[
                    styles.onlineDot,
                    { backgroundColor: company.is_online ? '#10B981' : '#9CA3AF' }
                  ]} />
                  <Text style={[styles.onlineText, { color: company.is_online ? '#10B981' : '#9CA3AF' }]}>
                    {company.is_online ? 'Online' : 'Offline'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
              <Ionicons name="checkmark-circle" size={20} color={theme.success} />
              <Text style={[styles.statValue, { color: theme.text }]}>{company.completed_orders || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Bajarilgan</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
              <Ionicons name="star" size={20} color="#FFB800" />
              <Text style={[styles.statValue, { color: theme.text }]}>{averageRating.toFixed(1)}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Reyting</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: theme.surfaceVariant }]}>
              <Ionicons name="chatbubble" size={20} color={theme.primary} />
              <Text style={[styles.statValue, { color: theme.text }]}>{reviews.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Sharh</Text>
            </View>
          </View>

          {company.phone ? (
            <TouchableOpacity
              style={[styles.phoneRow, { borderColor: theme.primary + '30', backgroundColor: theme.primary + '08' }]}
              onPress={handleCall}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={20} color={theme.primary} />
              <Text style={[styles.phoneText, { color: theme.primary }]}>
                {company.phone}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.primary} />
            </TouchableOpacity>
          ) : null}
        </Card>

        {/* Tabs */}
        <View style={[styles.tabsRow, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'info' && { borderBottomColor: theme.primary, borderBottomWidth: 2.5 }]}
            onPress={() => setActiveTab('info')}
            activeOpacity={0.8}
          >
            <Ionicons name="information-circle-outline" size={18} color={activeTab === 'info' ? theme.primary : theme.textSecondary} />
            <Text style={[styles.tabBtnText, { color: activeTab === 'info' ? theme.primary : theme.textSecondary }]}>
              Ma'lumot
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'reviews' && { borderBottomColor: theme.primary, borderBottomWidth: 2.5 }]}
            onPress={() => setActiveTab('reviews')}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-outline" size={18} color={activeTab === 'reviews' ? theme.primary : theme.textSecondary} />
            <Text style={[styles.tabBtnText, { color: activeTab === 'reviews' ? theme.primary : theme.textSecondary }]}>
              {reviews.length > 0 ? `Sharhlar (${reviews.length})` : 'Sharhlar'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info Tab Content */}
        {activeTab === 'info' ? (
          company.description ? (
            <Card style={styles.tabCard}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Firma haqida</Text>
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                {company.description}
              </Text>
            </Card>
          ) : (
            <View style={styles.emptyTab}>
              <Ionicons name="information-circle-outline" size={48} color={theme.textTertiary} />
              <Text style={[styles.emptyTabText, { color: theme.textSecondary }]}>
                Firma haqida ma'lumot yo'q
              </Text>
            </View>
          )
        ) : null}

        {/* Reviews Tab Content */}
        {activeTab === 'reviews' ? (
          <Card style={styles.tabCard}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Sharhlar</Text>
            {reviews.length === 0 ? (
              <View style={styles.emptyReviews}>
                <Ionicons name="chatbubble-outline" size={48} color={theme.textTertiary} />
                <Text style={[styles.noReviews, { color: theme.textSecondary }]}>
                  Hali sharh qoldirilmagan
                </Text>
              </View>
            ) : (
              <View style={styles.reviewsList}>
                {reviews.map((review) => (
                  <View
                    key={review.id}
                    style={[styles.reviewItem, { borderBottomColor: theme.border }]}
                  >
                    <View style={styles.reviewHeader}>
                      <Text style={[styles.reviewerName, { color: theme.text }]}>
                        {review.customer_name}
                      </Text>
                      <View style={styles.reviewRating}>
                        {[...Array(5)].map((_, i) => (
                          <Ionicons
                            key={i}
                            name={i < review.rating ? 'star' : 'star-outline'}
                            size={13}
                            color="#FFB800"
                          />
                        ))}
                      </View>
                    </View>
                    {review.comment ? (
                      <Text style={[styles.reviewComment, { color: theme.textSecondary }]}>
                        {review.comment}
                      </Text>
                    ) : null}
                    <Text style={[styles.reviewDate, { color: theme.textTertiary }]}>
                      {new Date(review.created_at).toLocaleDateString('uz-UZ')}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        ) : null}

        {/* Order button */}
        {company.is_online ? (
          <Button
            title="Xizmat buyurtma qilish"
            onPress={handleOrder}
            size="large"
            style={styles.orderButton}
          />
        ) : (
          <Card style={[styles.offlineCard, { backgroundColor: '#9CA3AF15' }]}>
            <Ionicons name="wifi-outline" size={24} color="#9CA3AF" />
            <Text style={[styles.offlineText, { color: theme.textSecondary }]}>
              Firma hozir offline — buyurtma berish mumkin emas
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: { width: 40 },
  headerTitle: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  placeholder: { width: 40 },
  content: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  imageGallery: { height: 260 },
  image: { height: 260 },
  infoCard: { margin: spacing.lg },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyName: {
    ...typography.h3,
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  ratingText: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  reviewCount: {
    ...typography.small,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  onlineText: {
    ...typography.small,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs / 2,
  },
  statValue: {
    ...typography.h4,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.small,
    textAlign: 'center',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  phoneText: {
    ...typography.bodyMedium,
    fontWeight: '600',
    flex: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  tabBtnText: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  tabCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  emptyTab: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyTabText: {
    ...typography.body,
    textAlign: 'center',
  },
  emptyReviews: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    lineHeight: 24,
  },
  errorText: {
    ...typography.h3,
    textAlign: 'center',
  },
  noReviews: {
    ...typography.body,
    textAlign: 'center',
  },
  reviewsList: { gap: spacing.md },
  reviewItem: {
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  reviewerName: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    ...typography.body,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  reviewDate: { ...typography.small },
  orderButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  offlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  offlineText: {
    ...typography.body,
    flex: 1,
  },
});
