import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useCompanies } from '../hooks/useCompanies';
import { useAuth } from '../hooks/useAuth';
import { useReviews } from '../hooks/useReviews';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { spacing, typography, borderRadius } from '../constants/theme';

export default function CompanyDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { getCompanyById } = useCompanies();
  const { user } = useAuth();
  const { getCompanyReviews, addReview, getAverageRating } = useReviews();

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [screenWidth, setScreenWidth] = useState(() => Math.max(375, Dimensions.get('window').width));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(Math.max(375, window.width));
    });
    return () => sub?.remove();
  }, []);

  const companyId = params.id as string;
  const company = getCompanyById(companyId);
  const reviews = getCompanyReviews(companyId);
  const averageRating = getAverageRating(companyId) || company?.rating || 0;

  if (!company) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>
          Firma topilmadi
        </Text>
      </View>
    );
  }

  const handleCall = () => {
    Linking.openURL(`tel:${company.phoneNumber}`);
  };

  const handleOrder = () => {
    router.push({
      pathname: '/order-service',
      params: {
        companyId: company.id,
        companyName: company.name,
        serviceType: company.serviceType,
      },
    });
  };

  const handleSubmitReview = async () => {
    if (!user || !reviewComment.trim()) return;
    
    await addReview({
      userId: user.id,
      userName: user.name,
      companyId,
      rating: reviewRating,
      comment: reviewComment.trim(),
    });

    setReviewComment('');
    setReviewRating(5);
    setShowReviewModal(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {company.name}
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
          {(company.photoUrls && company.photoUrls.length > 0 ? company.photoUrls : ['https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800']).map((url, index) => (
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
            <Text style={[styles.companyName, { color: theme.text }]}>
              {company.name}
            </Text>
            <View style={styles.rating}>
              <Ionicons name="star" size={20} color="#FFB800" />
              <Text style={[styles.ratingText, { color: theme.text }]}>
                {averageRating.toFixed(1)}
              </Text>
              <Text style={[styles.reviewCount, { color: theme.textSecondary }]}>
                ({reviews.length})
              </Text>
            </View>
          </View>

          <View style={[styles.serviceTag, { backgroundColor: theme.primary + '15' }]}>
            <Text style={[styles.serviceType, { color: theme.primary }]}>
              {company.serviceType}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time" size={20} color={theme.textSecondary} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {company.workingHours}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="briefcase" size={20} color={theme.textSecondary} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {t.experience}: {company.experience}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color={theme.textSecondary} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {company.address}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.phoneRow, { borderTopColor: theme.border }]}
            onPress={handleCall}
          >
            <Ionicons name="call" size={20} color={theme.primary} />
            <Text style={[styles.phoneText, { color: theme.primary }]}>
              {company.phoneNumber}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
          </TouchableOpacity>
        </Card>

        {/* About */}
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t.aboutCompany}
          </Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {company.description}
          </Text>
        </Card>

        {/* Services */}
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t.services}
          </Text>
          <View style={styles.servicesList}>
            {(company.services || []).map((service, index) => (
              <View
                key={index}
                style={[styles.serviceItem, { backgroundColor: theme.surfaceVariant }]}
              >
                <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                <Text style={[styles.serviceText, { color: theme.text }]}>
                  {service}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Reviews */}
        <Card>
          <View style={styles.reviewsHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t.reviews}
            </Text>
            <TouchableOpacity
              style={[styles.writeReviewButton, { backgroundColor: theme.primary + '15' }]}
              onPress={() => setShowReviewModal(true)}
            >
              <Ionicons name="create" size={16} color={theme.primary} />
              <Text style={[styles.writeReviewText, { color: theme.primary }]}>
                {t.writeReview}
              </Text>
            </TouchableOpacity>
          </View>

          {reviews.length === 0 ? (
            <Text style={[styles.noReviews, { color: theme.textSecondary }]}>
              {t.noOrders}
            </Text>
          ) : (
            <View style={styles.reviewsList}>
              {reviews.map((review) => (
                <View
                  key={review.id}
                  style={[styles.reviewItem, { borderBottomColor: theme.border }]}
                >
                  <View style={styles.reviewHeader}>
                    <Text style={[styles.reviewerName, { color: theme.text }]}>
                      {review.userName}
                    </Text>
                    <View style={styles.reviewRating}>
                      {[...Array(5)].map((_, i) => (
                        <Ionicons
                          key={i}
                          name={i < review.rating ? 'star' : 'star-outline'}
                          size={14}
                          color="#FFB800"
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={[styles.reviewComment, { color: theme.textSecondary }]}>
                    {review.comment}
                  </Text>
                  <Text style={[styles.reviewDate, { color: theme.textTertiary }]}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Button
          title={t.orderService}
          onPress={handleOrder}
          size="large"
          style={styles.orderButton}
        />
      </ScrollView>

      {/* Review Modal */}
      <Modal visible={showReviewModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {t.writeReview}
            </Text>

            <Text style={[styles.ratingLabel, { color: theme.text }]}>
              {t.giveRating}
            </Text>
            <View style={styles.starRating}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setReviewRating(star)}
                >
                  <Ionicons
                    name={star <= reviewRating ? 'star' : 'star-outline'}
                    size={32}
                    color="#FFB800"
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.reviewInput, { backgroundColor: theme.surfaceVariant, color: theme.text }]}
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder={t.reviewPlaceholder}
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <Button
                title={t.cancel}
                onPress={() => setShowReviewModal(false)}
                variant="outline"
              />
              <Button
                title={t.submitReview}
                onPress={handleSubmitReview}
              />
            </View>
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
    marginHorizontal: spacing.sm,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  imageGallery: {
    height: 300,
  },
  image: {
    width: 375,
    height: 300,
  },
  infoCard: {
    margin: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  companyName: {
    ...typography.h2,
    flex: 1,
    marginRight: spacing.sm,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  ratingText: {
    ...typography.h3,
    fontSize: 18,
  },
  reviewCount: {
    ...typography.caption,
    marginLeft: spacing.xs / 2,
  },
  serviceTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  serviceType: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.body,
    flex: 1,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
  },
  phoneText: {
    ...typography.bodyMedium,
    fontSize: 16,
    flex: 1,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    lineHeight: 24,
  },
  servicesList: {
    gap: spacing.sm,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  serviceText: {
    ...typography.bodyMedium,
    flex: 1,
  },
  orderButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.h3,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  writeReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  writeReviewText: {
    ...typography.small,
    fontWeight: '600',
  },
  noReviews: {
    ...typography.body,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  reviewsList: {
    gap: spacing.md,
  },
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
  reviewDate: {
    ...typography.small,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  modalTitle: {
    ...typography.h2,
    marginBottom: spacing.lg,
  },
  ratingLabel: {
    ...typography.bodyMedium,
    marginBottom: spacing.sm,
  },
  starRating: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  reviewInput: {
    ...typography.body,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 100,
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
