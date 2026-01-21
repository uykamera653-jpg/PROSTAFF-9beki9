import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { useWorkers } from '../hooks/useWorkers';
import { WorkerCard } from '../components/feature/WorkerCard';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { spacing, typography } from '../constants/theme';
import { Worker } from '../types';

export default function WorkerSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { getWorkersByCategory, hireWorkers } = useWorkers();

  const category = params.category as string;
  const jobAdId = params.jobAdId as string;

  const [isSearching, setIsSearching] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set());
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isHiring, setIsHiring] = useState(false);

  useEffect(() => {
    // Simulate search delay
    const searchTimeout = setTimeout(() => {
      const foundWorkers = getWorkersByCategory(category);
      setWorkers(foundWorkers);
      setIsSearching(false);
    }, 2000);

    return () => clearTimeout(searchTimeout);
  }, [category]);

  const handleSelectWorker = (workerId: string) => {
    setSelectedWorkerIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(workerId)) {
        newSet.delete(workerId);
      } else {
        newSet.add(workerId);
      }
      return newSet;
    });
  };

  const handleConfirmSelection = () => {
    if (selectedWorkerIds.size === 0) {
      if (Platform.OS === 'web') {
        alert('Kamida bitta ishchini tanlang');
      } else {
        Alert.alert(t.appName, 'Kamida bitta ishchini tanlang');
      }
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirmHiring = async () => {
    if (!user) return;

    setIsHiring(true);
    try {
      const selectedWorkers = workers.filter((w) => selectedWorkerIds.has(w.id));
      const hiredWorkersData = selectedWorkers.map((worker) => ({
        userId: user.id,
        jobAdId,
        workerId: worker.id,
        workerName: worker.name,
        workerPhone: worker.phoneNumber,
        arrivalTime: worker.arrivalTime,
        dailyRate: worker.dailyRate,
      }));

      await hireWorkers(hiredWorkersData);

      setShowConfirmation(false);

      if (Platform.OS === 'web') {
        alert('Ishchilar muvaffaqiyatli yollandi!');
      } else {
        Alert.alert(t.appName, 'Ishchilar muvaffaqiyatli yollandi!');
      }

      router.push('/(tabs)/my-ads');
    } catch (error) {
      console.error('Failed to hire workers:', error);
    } finally {
      setIsHiring(false);
    }
  };

  const selectedWorkers = workers.filter((w) => selectedWorkerIds.has(w.id));
  const totalCost = selectedWorkers.reduce((sum, w) => sum + w.dailyRate, 0);

  if (isSearching) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {t[category as keyof typeof t] as string}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.searchingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.searchingText, { color: theme.text }]}>
            {t.searchingWorkers}
          </Text>
          <Text style={[styles.searchingSubtext, { color: theme.textSecondary }]}>
            {t.availableWorkers}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t.availableWorkers}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {workers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={64} color={theme.textTertiary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {t.noWorkersFound}
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={workers}
            renderItem={({ item }) => (
              <WorkerCard
                worker={item}
                isSelected={selectedWorkerIds.has(item.id)}
                onSelect={() => handleSelectWorker(item.id)}
              />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />

          {selectedWorkerIds.size > 0 && (
            <View style={[styles.footer, { backgroundColor: theme.surface }]}>
              <View style={styles.footerInfo}>
                <Text style={[styles.footerLabel, { color: theme.textSecondary }]}>
                  {t.selectedWorkers}: {selectedWorkerIds.size}
                </Text>
                <Text style={[styles.footerTotal, { color: theme.primary }]}>
                  {totalCost.toLocaleString()} {t.som}
                </Text>
              </View>
              <Button
                title={t.confirmHiring}
                onPress={handleConfirmSelection}
                style={styles.confirmButton}
              />
            </View>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      <Modal visible={showConfirmation} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {t.confirmHiring}
            </Text>

            <View style={styles.modalBody}>
              {selectedWorkers.map((worker) => (
                <Card key={worker.id} style={styles.workerSummary}>
                  <View style={styles.workerSummaryHeader}>
                    <View style={[styles.workerAvatar, { backgroundColor: theme.primary + '20' }]}>
                      <Ionicons name="person" size={20} color={theme.primary} />
                    </View>
                    <View style={styles.workerSummaryInfo}>
                      <Text style={[styles.workerSummaryName, { color: theme.text }]}>
                        {worker.name}
                      </Text>
                      <Text style={[styles.workerSummaryDetail, { color: theme.textSecondary }]}>
                        {worker.age} {t.years} • {worker.arrivalTime} {t.minutes}
                      </Text>
                    </View>
                    <Text style={[styles.workerSummaryPrice, { color: theme.primary }]}>
                      {worker.dailyRate.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.workerSummaryContact}>
                    <Ionicons name="call" size={16} color={theme.textSecondary} />
                    <Text style={[styles.workerSummaryPhone, { color: theme.textSecondary }]}>
                      {worker.phoneNumber}
                    </Text>
                  </View>
                </Card>
              ))}

              <View style={[styles.totalContainer, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[styles.totalLabel, { color: theme.text }]}>
                  {t.dailyRate}:
                </Text>
                <Text style={[styles.totalAmount, { color: theme.primary }]}>
                  {totalCost.toLocaleString()} {t.som}
                </Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <Button
                title={t.cancel}
                onPress={() => setShowConfirmation(false)}
                variant="outline"
                disabled={isHiring}
              />
              <Button
                title={t.confirm}
                onPress={handleConfirmHiring}
                loading={isHiring}
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
  },
  placeholder: {
    width: 40,
  },
  searchingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  searchingText: {
    ...typography.h3,
    marginTop: spacing.md,
  },
  searchingSubtext: {
    ...typography.body,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl + 80,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  footerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  footerLabel: {
    ...typography.bodyMedium,
  },
  footerTotal: {
    ...typography.h3,
  },
  confirmButton: {
    width: '100%',
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
    maxHeight: '80%',
  },
  modalTitle: {
    ...typography.h2,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalBody: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  workerSummary: {
    padding: spacing.md,
  },
  workerSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  workerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerSummaryInfo: {
    flex: 1,
  },
  workerSummaryName: {
    ...typography.bodyMedium,
    marginBottom: 2,
  },
  workerSummaryDetail: {
    ...typography.small,
  },
  workerSummaryPrice: {
    ...typography.h3,
    fontSize: 16,
  },
  workerSummaryContact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  workerSummaryPhone: {
    ...typography.caption,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
  },
  totalLabel: {
    ...typography.bodyMedium,
  },
  totalAmount: {
    ...typography.h2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
