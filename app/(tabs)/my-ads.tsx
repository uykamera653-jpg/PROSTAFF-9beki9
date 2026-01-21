import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  Linking,
  ActionSheetIOS,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useJobs } from '../../hooks/useJobs';
import { useCompanies } from '../../hooks/useCompanies';
import { useWorkers } from '../../hooks/useWorkers';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

import { spacing, typography, borderRadius } from '../../constants/theme';
import { JobAd, ServiceOrder } from '../../types';

export default function MyAdsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { getUserJobs } = useJobs();
  const { getUserOrders } = useCompanies();

  const [activeTab, setActiveTab] = useState<'jobs' | 'orders' | 'hired'>('jobs');
  const { getUserHiredWorkers, updateWorkerStatus, rateWorker } = useWorkers();

  const myJobs = user ? getUserJobs(user.id) : [];
  const myOrders = user ? getUserOrders(user.id) : [];
  const myHiredWorkers = user ? getUserHiredWorkers(user.id) : [];
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedWorkerForRating, setSelectedWorkerForRating] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleSMS = (phoneNumber: string) => {
    Linking.openURL(`sms:${phoneNumber}`);
  };

  const handleChangeStatus = (workerId: string, currentStatus: string) => {
    const statuses = ['pending', 'confirmed', 'completed'];
    const currentIndex = statuses.indexOf(currentStatus);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length] as 'pending' | 'confirmed' | 'completed';

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t.cancel, t.pending, t.confirmed, t.completed],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            const selectedStatus = statuses[buttonIndex - 1] as 'pending' | 'confirmed' | 'completed';
            updateWorkerStatus(workerId, selectedStatus);
          }
        }
      );
    } else {
      updateWorkerStatus(workerId, nextStatus);
    }
  };

  const handleRateWorker = (workerId: string) => {
    setSelectedWorkerForRating(workerId);
    setSelectedRating(0);
    setRatingModalVisible(true);
  };

  const submitRating = async () => {
    if (selectedRating === 0 || !selectedWorkerForRating) return;
    await rateWorker(selectedWorkerForRating, selectedRating);
    setRatingModalVisible(false);
    if (Platform.OS === 'web') {
      alert(t.thankYou);
    } else {
      Alert.alert(t.appName, t.thankYou);
    }
  };

  const renderJobItem = ({ item }: { item: JobAd }) => (
    <Card style={styles.jobCard}>
      <View style={styles.jobHeader}>
        <Text style={[styles.category, { color: theme.primary }]}>
          {t[item.category as keyof typeof t] as string}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: theme.success + '15' }]}>
          <Text style={[styles.statusText, { color: theme.success }]}>
            {item.status}
          </Text>
        </View>
      </View>
      
      <Text style={[styles.description, { color: theme.text }]} numberOfLines={2}>
        {item.description}
      </Text>
      
      <View style={styles.jobDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="call" size={16} color={theme.textSecondary} />
          <Text style={[styles.detailText, { color: theme.textSecondary }]}>
            {item.phoneNumber}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color={theme.textSecondary} />
          <Text style={[styles.detailText, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.location}
          </Text>
        </View>
      </View>
      
      <Text style={[styles.date, { color: theme.textTertiary }]}>
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </Card>
  );

  const renderOrderItem = ({ item }: { item: ServiceOrder }) => (
    <Card style={styles.jobCard}>
      <View style={styles.jobHeader}>
        <Text style={[styles.category, { color: theme.primary }]}>
          {item.companyName}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: theme.primary + '15' }]}>
          <Text style={[styles.statusText, { color: theme.primary }]}>
            {item.status}
          </Text>
        </View>
      </View>
      
      <Text style={[styles.serviceTypeText, { color: theme.textSecondary }]}>
        {item.serviceType}
      </Text>
      
      <View style={styles.jobDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person" size={16} color={theme.textSecondary} />
          <Text style={[styles.detailText, { color: theme.textSecondary }]}>
            {item.customerName}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="call" size={16} color={theme.textSecondary} />
          <Text style={[styles.detailText, { color: theme.textSecondary }]}>
            {item.phoneNumber}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location" size={16} color={theme.textSecondary} />
          <Text style={[styles.detailText, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.location}
          </Text>
        </View>
      </View>
      
      <Text style={[styles.date, { color: theme.textTertiary }]}>
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{t.myAds}</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'jobs' && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('jobs')}
        >
          <Ionicons
            name="hammer"
            size={20}
            color={activeTab === 'jobs' ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'jobs' ? theme.primary : theme.textSecondary },
            ]}
          >
            {t.dailyWorkers}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'orders' && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('orders')}
        >
          <Ionicons
            name="business"
            size={20}
            color={activeTab === 'orders' ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'orders' ? theme.primary : theme.textSecondary },
            ]}
          >
            {t.myOrders}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'hired' && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('hired')}
        >
          <Ionicons
            name="people"
            size={20}
            color={activeTab === 'hired' ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'hired' ? theme.primary : theme.textSecondary },
            ]}
          >
            {t.hiredWorkers}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'hired' ? (
        myHiredWorkers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t.noHiredWorkers}
            </Text>
          </View>
        ) : (
          <FlatList
            data={myHiredWorkers}
            renderItem={({ item }) => (
              <Card style={styles.jobCard}>
                <View style={styles.jobHeader}>
                  <Text style={[styles.category, { color: theme.primary }]}>
                    {item.workerName}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          item.status === 'completed'
                            ? theme.success + '15'
                            : item.status === 'confirmed'
                            ? theme.primary + '15'
                            : theme.textTertiary + '15',
                      },
                    ]}
                    onPress={() => handleChangeStatus(item.id, item.status)}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            item.status === 'completed'
                              ? theme.success
                              : item.status === 'confirmed'
                              ? theme.primary
                              : theme.textSecondary,
                        },
                      ]}
                    >
                      {t[item.status as keyof typeof t] as string}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.jobDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="call" size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                      {item.workerPhone}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="time" size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                      {t.arrivalTime}: {item.arrivalTime} {t.minutes}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="cash" size={16} color={theme.textSecondary} />
                    <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                      {item.dailyRate.toLocaleString()} {t.som}
                    </Text>
                  </View>
                </View>

                {/* Contact and Rating Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.primary + '15' }]}
                    onPress={() => handleCall(item.workerPhone)}
                  >
                    <Ionicons name="call" size={18} color={theme.primary} />
                    <Text style={[styles.actionButtonText, { color: theme.primary }]}>
                      {t.call}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.success + '15' }]}
                    onPress={() => handleSMS(item.workerPhone)}
                  >
                    <Ionicons name="chatbubble" size={18} color={theme.success} />
                    <Text style={[styles.actionButtonText, { color: theme.success }]}>
                      {t.sendSMS}
                    </Text>
                  </TouchableOpacity>

                  {item.status === 'completed' && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#F59E0B' + '15' }]}
                      onPress={() => handleRateWorker(item.id)}
                    >
                      <Ionicons name="star" size={18} color="#F59E0B" />
                      <Text style={[styles.actionButtonText, { color: '#F59E0B' }]}>
                        {t.giveRating}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                <Text style={[styles.date, { color: theme.textTertiary }]}>
                  {new Date(item.hiredAt).toLocaleDateString()}
                </Text>
              </Card>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : activeTab === 'jobs' ? (
        myJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="newspaper-outline" size={64} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t.noOrders}
            </Text>
          </View>
        ) : (
          <FlatList
            data={myJobs}
            renderItem={renderJobItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        myOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cart-outline" size={64} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t.noOrders}
            </Text>
          </View>
        ) : (
          <FlatList
            data={myOrders}
            renderItem={renderOrderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )
      )}



      {/* Rating Modal */}
      <Modal visible={ratingModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {t.howWasWork}
            </Text>
            
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSelectedRating(star)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= selectedRating ? 'star' : 'star-outline'}
                    size={48}
                    color="#F59E0B"
                  />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <Button
                title={t.cancel}
                onPress={() => setRatingModalVisible(false)}
                variant="outline"
              />
              <Button
                title={t.leaveRating}
                onPress={submitRating}
                disabled={selectedRating === 0}
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
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  jobCard: {
    marginBottom: spacing.md,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  category: {
    ...typography.h3,
    fontSize: 18,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  statusText: {
    ...typography.small,
    fontWeight: '600',
  },
  description: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  jobDetails: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    ...typography.caption,
  },
  date: {
    ...typography.small,
    textAlign: 'right',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  tabText: {
    ...typography.bodyMedium,
    fontSize: 14,
  },
  serviceTypeText: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
  },
  actionButtonText: {
    ...typography.small,
    fontWeight: '600',
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
    borderRadius: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xl,
  },
  starButton: {
    padding: spacing.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
