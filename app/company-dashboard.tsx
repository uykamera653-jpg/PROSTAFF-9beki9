import React, { useState, useEffect, useRef } from 'react';
import { playNotificationSound } from '../services/sound-service';
import * as ImagePicker from 'expo-image-picker';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Switch,
  Linking,
  Modal,
  Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { useUserRole } from '../hooks/useUserRole';
import { useNotificationSettings } from '../hooks/useNotificationSettings';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LocationPicker } from '../components/feature/LocationPicker';
import { useAlert } from '../components/ui/WebAlert';
import { spacing, typography, borderRadius, rs } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

type TabType = 'orders' | 'profile';
type OrderStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

interface CompanyProfile {
  id: string;
  company_name: string;
  description: string;
  phone: string;
  images: string[];
  is_online: boolean;
  rating: number;
  completed_orders: number;
  latitude?: number;
  longitude?: number;
  avatar_url?: string;
}

interface CompanyOrder {
  id: string;
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  customer_phone?: string;
  status: string;
  created_at: string;
  customer_id: string;
  worker_id?: string;
  target_company_id?: string;
  rejected_by?: string[];
  category?: { name_uz: string; icon: string };
  customer?: { name: string; email: string };
}

export default function CompanyDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();
  const { showAlert, AlertComponent } = useAlert();
  const { settings: notifSettings, updateSettings: updateNotifSettings } = useNotificationSettings();

  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [ordersTab, setOrdersTab] = useState<OrderStatus>('pending');
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [orders, setOrders] = useState<CompanyOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CompanyOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);

  // Profile edit fields
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  // sound handled by sound-service

  // Check role and redirect if not company
  useEffect(() => {
    if (!roleLoading && role && role !== 'company') {
      router.replace(
        role === 'customer' ? '/(tabs)/home' : role === 'worker' ? '/worker-dashboard' : '/admin-panel'
      );
    }
  }, [role, roleLoading]);

  useEffect(() => {
    if (user && !roleLoading && role === 'company') {
      loadProfile();
    }
  }, [user, role, roleLoading]);

  useEffect(() => {
    if (profile) {
      loadOrders();
      setupRealtime();
    }
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      // sound cleanup handled by sound-service
    };
  }, [profile, ordersTab]);

  const loadProfile = async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          router.replace('/company-onboarding');
        }
        return;
      }

      if (data) {
        setProfile(data);
        setCompanyName(data.company_name);
        setDescription(data.description || '');
        setPhone(data.phone);
        setIsOnline(data.is_online);
        if (data.latitude && data.longitude) {
          setLocationCoords({ latitude: data.latitude, longitude: data.longitude });
        }
      }
    } catch (error) {
      console.error('Failed to load company profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrders = async () => {
    if (!user?.id) return;
    try {
      setOrdersLoading(true);

      let query = supabase
        .from('orders')
        .select('*, category:categories(name_uz, icon)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (ordersTab === 'pending') {
        query = query
          .eq('status', 'pending')
          .eq('order_type', 'company')
          .eq('target_company_id', user!.id);
      } else if (ordersTab === 'accepted') {
        query = query.eq('target_company_id', user!.id).in('status', ['accepted', 'in_progress']);
      } else {
        query = query.eq('target_company_id', user!.id).in('status', ['completed', 'cancelled']);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data || [];
      if (ordersTab === 'pending') {
        filtered = filtered.filter((o: any) => {
          const rejectedBy = Array.isArray(o.rejected_by) ? o.rejected_by : [];
          return !rejectedBy.includes(user!.id);
        });
      }

      const customerIds = [...new Set(filtered.map((o: any) => o.customer_id).filter(Boolean))];
      let customersMap: Record<string, any> = {};
      if (customerIds.length > 0) {
        const { data: customers } = await supabase
          .from('user_profiles')
          .select('id, name, email')
          .in('id', customerIds as string[]);
        (customers || []).forEach((c: any) => (customersMap[c.id] = c));
      }

      const enriched = filtered.map((o: any) => ({ ...o, customer: customersMap[o.customer_id] }));
      setOrders(enriched);
    } catch (error: any) {
      console.error('Failed to load orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleNotificationSound = async () => {
    if (!notifSettings.enabled || !notifSettings.sound || !notifSettings.new_orders) return;
    await playNotificationSound(notifSettings.volume ?? 1.0);
  };

  const setupRealtime = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    channelRef.current = supabase
      .channel('company-dashboard-orders-' + user?.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders',
        filter: `target_company_id=eq.${user?.id}` }, async (payload) => {
        if (payload.new?.status === 'pending') {
          if (notifSettings.enabled && notifSettings.vibration && notifSettings.new_orders) {
            Vibration.vibrate([0, 400, 200, 400]);
          }
          await handleNotificationSound();
        }
        loadOrders();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        loadOrders();
      })
      .subscribe();
  };

  const handleAcceptOrder = async (orderId: string) => {
    if (!user?.id) return;
    try {
      const { data: current, error: checkErr } = await supabase
        .from('orders')
        .select('status, worker_id')
        .eq('id', orderId)
        .single();

      if (checkErr) throw checkErr;
      if (current.status !== 'pending') {
        showAlert('Xatolik', 'Bu buyurtma allaqachon qabul qilingan');
        loadOrders();
        return;
      }

      const { error } = await supabase
        .from('orders')
        .update({ status: 'accepted' })
        .eq('id', orderId)
        .eq('status', 'pending')
        .eq('target_company_id', user.id);

      if (error) throw error;

      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setShowOrderModal(false);
      showAlert('Muvaffaqiyatli!', 'Buyurtma qabul qilindi');
      setTimeout(() => loadOrders(), 500);
    } catch (error: any) {
      showAlert('Xatolik', error.message || 'Buyurtmani qabul qilishda xatolik');
      loadOrders();
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    if (!user?.id) return;
    try {
      const { data: order, error: fetchErr } = await supabase
        .from('orders')
        .select('rejected_by, status')
        .eq('id', orderId)
        .single();

      if (fetchErr) throw fetchErr;
      if (order.status !== 'pending') {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        setShowOrderModal(false);
        return;
      }

      const rejectedBy: string[] = Array.isArray(order.rejected_by) ? [...order.rejected_by] : [];
      if (!rejectedBy.includes(user.id)) rejectedBy.push(user.id);

      const { error } = await supabase
        .from('orders')
        .update({ rejected_by: rejectedBy })
        .eq('id', orderId)
        .eq('status', 'pending');

      if (error) throw error;

      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setShowOrderModal(false);
      showAlert('Rad etildi', 'Buyurtma rad etildi');
      setTimeout(() => loadOrders(), 500);
    } catch (error: any) {
      showAlert('Xatolik', error.message || 'Buyurtmani rad etishda xatolik');
      loadOrders();
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    const doComplete = async () => {
      try {
        const { error } = await supabase
          .from('orders')
          .update({ status: 'completed' })
          .eq('id', orderId);
        if (error) throw error;
        if (profile) {
          await supabase
            .from('companies')
            .update({ completed_orders: (profile.completed_orders || 0) + 1 })
            .eq('id', user!.id);
        }
        setShowOrderModal(false);
        showAlert('Muvaffaqiyatli!', 'Buyurtma bajarildi deb belgilandi');
        loadOrders();
        loadProfile();
      } catch (error: any) {
        showAlert('Xatolik', error.message || 'Buyurtmani yakunlashda xatolik');
      }
    };
    showAlert('Tasdiqlash', 'Buyurtma bajarilganini tasdiqlaysizmi?', [
      { text: "Yo'q", style: 'cancel' },
      { text: 'Ha', onPress: doComplete },
    ]);
  };

  const handleSaveProfile = async () => {
    if (!companyName.trim() || !phone.trim()) {
      showAlert('Xatolik', "Barcha majburiy maydonlarni to'ldiring");
      return;
    }
    try {
      setIsSaving(true);
      const updateData: any = {
        company_name: companyName.trim(),
        description: description.trim(),
        phone: phone.trim(),
        is_online: isOnline,
      };
      if (locationCoords) {
        updateData.latitude = locationCoords.latitude;
        updateData.longitude = locationCoords.longitude;
      }

      const { error } = await supabase.from('companies').update(updateData).eq('id', user!.id);

      if (error) {
        showAlert('Xatolik', `Profilni yangilab bo'lmadi: ${error.message}`);
      } else {
        showAlert('Muvaffaqiyatli', 'Profil yangilandi!');
        loadProfile();
      }
    } catch (error) {
      showAlert('Xatolik', 'Profilni yangilashda xatolik');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleOnline = async (value: boolean) => {
    if (!user?.id) return;
    setIsOnline(value);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_online: value })
        .eq('id', user.id);
      if (error) {
        setIsOnline(!value);
        showAlert('Xatolik', "Holatni o'zgartirib bo'lmadi");
      } else {
        setProfile((prev) => prev ? { ...prev, is_online: value } : prev);
        if (!value) {
          showAlert('Offline rejim', "Siz offline rejimga o'tdingiz. Mijozlarga ko'rinmaysiz va yangi buyurtmalar kelmaydi.");
        }
      }
    } catch {
      setIsOnline(!value);
    }
  };

  const handleLogout = () => {
    showAlert('Chiqish', 'Hisobdan chiqmoqchimisiz?', [
      { text: "Yo'q", style: 'cancel' },
      {
        text: 'Ha',
        onPress: async () => {
          await signOut();
          router.replace('/');
        },
      },
    ]);
  };

  const handleAvatarUpload = async (source: 'gallery' | 'camera') => {
    setShowImagePickerModal(false);
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Ruxsat kerak', 'Kamera uchun ruxsat bering');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Ruxsat kerak', 'Galereya uchun ruxsat bering');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setAvatarUploading(true);

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user!.id}/avatar_${Date.now()}.${ext}`;
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, arrayBuffer, { contentType, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(fileName);

      const avatarUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('companies')
        .update({ avatar_url: avatarUrl })
        .eq('id', user!.id);

      if (updateError) throw updateError;

      setProfile((prev) => prev ? { ...prev, avatar_url: avatarUrl } : prev);
      showAlert('Muvaffaqiyatli', 'Profil rasmi yangilandi!');
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      showAlert('Xatolik', error.message || 'Rasm yuklashda xatolik');
    } finally {
      setAvatarUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'accepted': return '#3B82F6';
      case 'in_progress': return '#8B5CF6';
      case 'completed': return '#10B981';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Kutilmoqda';
      case 'accepted': return 'Qabul qilindi';
      case 'in_progress': return 'Jarayonda';
      case 'completed': return 'Bajarildi';
      case 'cancelled': return 'Bekor qilindi';
      default: return status;
    }
  };

  if (isLoading || roleLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (role && role !== 'company') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="warning" size={64} color={theme.warning} />
        <Text style={[{ color: theme.text, marginTop: spacing.lg, ...typography.body }]}>Bu sahifaga kirish uchun firma profili kerak</Text>
        <Button title="Ortga" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  const renderOrderCard = ({ item }: { item: CompanyOrder }) => {
    const sc = getStatusColor(item.status);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => { setSelectedOrder(item); setShowOrderModal(true); }}
      >
        <Card style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <Text style={{ fontSize: 20 }}>{item.category?.icon || '📋'}</Text>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[styles.orderTitle, { color: theme.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.orderSub, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.category?.name_uz || 'Kategoriya'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: sc + '20' }]}>
              <Text style={[styles.statusText, { color: sc }]}>{getStatusLabel(item.status)}</Text>
            </View>
          </View>

          <View style={styles.orderInfoRow}>
            <Ionicons name="person-outline" size={14} color={theme.primary} />
            <Text style={[styles.orderInfoText, { color: theme.text }]}>
              {item.customer?.name || "Noma'lum"}
            </Text>
          </View>
          <View style={styles.orderInfoRow}>
            <Ionicons name="location-outline" size={14} color={theme.warning} />
            <Text style={[styles.orderInfoText, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.location && !/^-?\d+\./.test(item.location)
                ? item.location
                : item.latitude
                ? `${item.latitude.toFixed(5)}, ${item.longitude?.toFixed(5)}`
                : "Manzil yo'q"}
            </Text>
          </View>
          <Text style={[styles.orderDate, { color: theme.textTertiary }]}>
            {new Date(item.created_at).toLocaleString('uz-UZ')}
          </Text>

          {item.status === 'pending' && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <TouchableOpacity
                style={[styles.quickBtn, { borderColor: '#EF4444', flex: 1 }]}
                onPress={(e) => { (e as any).stopPropagation?.(); handleRejectOrder(item.id); }}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={16} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>Rad</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickBtn, { borderColor: '#10B981', backgroundColor: '#10B981' + '15', flex: 1 }]}
                onPress={(e) => { (e as any).stopPropagation?.(); handleAcceptOrder(item.id); }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={16} color="#10B981" />
                <Text style={{ color: '#10B981', fontSize: 13, fontWeight: '600' }}>Qabul</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface }]}>
        <View style={{ width: 40 }} />
        <Text style={[styles.headerTitle, { color: theme.text }]}>Firma paneli</Text>
        <View style={styles.onlineIndicatorBox}>
          <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#10B981' : '#9CA3AF' }]} />
        </View>
      </View>

      {/* Main Tabs */}
      <View style={[styles.tabsRow, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.mainTab, activeTab === 'orders' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('orders')}
          activeOpacity={0.8}
        >
          <Ionicons name="receipt-outline" size={18} color={activeTab === 'orders' ? theme.primary : theme.textSecondary} />
          <Text style={[styles.mainTabText, { color: activeTab === 'orders' ? theme.primary : theme.textSecondary }]}>
            Buyurtmalar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainTab, activeTab === 'profile' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('profile')}
          activeOpacity={0.8}
        >
          <Ionicons name="business-outline" size={18} color={activeTab === 'profile' ? theme.primary : theme.textSecondary} />
          <Text style={[styles.mainTabText, { color: activeTab === 'profile' ? theme.primary : theme.textSecondary }]}>
            Profil
          </Text>
        </TouchableOpacity>
      </View>

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <View style={{ flex: 1 }}>
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{profile?.rating?.toFixed(1) || '0.0'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Reyting</Text>
              </View>
            </Card>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: theme.success }]}>{profile?.completed_orders || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Bajarilgan</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: isOnline ? '#10B981' : '#9CA3AF' }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Holat</Text>
            </Card>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}
          >
            {[
              { key: 'pending', label: 'Yangi', color: '#F59E0B' },
              { key: 'accepted', label: 'Aktiv', color: '#3B82F6' },
              { key: 'completed', label: 'Yakunlangan', color: '#10B981' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.subTab,
                  {
                    backgroundColor: ordersTab === tab.key ? tab.color : 'transparent',
                    borderColor: tab.color,
                  },
                ]}
                onPress={() => setOrdersTab(tab.key as OrderStatus)}
                activeOpacity={0.8}
              >
                <Text style={{ color: ordersTab === tab.key ? '#FFF' : tab.color, fontSize: 13, fontWeight: '600' }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {ordersLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={orders}
              renderItem={renderOrderCard}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onRefresh={loadOrders}
              refreshing={ordersLoading}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="receipt-outline" size={64} color={theme.textTertiary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Buyurtmalar yo'q</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Company Avatar */}
          <View style={{ alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.md }}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={() => setShowImagePickerModal(true)}
              activeOpacity={0.8}
            >
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={styles.companyAvatar}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.companyAvatar, { backgroundColor: theme.primary + '20', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="business" size={44} color={theme.primary} />
                </View>
              )}
              <View style={[styles.avatarEditBadge, { backgroundColor: theme.primary }]}>
                {avatarUploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={14} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
            <Text style={[{ color: theme.text, fontWeight: '700', fontSize: 18, marginTop: spacing.sm }]}>
              {profile?.company_name || 'Firma'}
            </Text>
          </View>

          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            {/* Online/Offline toggle */}
            <Card>
              <View style={styles.toggleRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                  <View style={[styles.onlineIconBox, { backgroundColor: isOnline ? '#10B981' + '20' : theme.surfaceVariant }]}>
                    <Ionicons name={isOnline ? 'wifi' : 'wifi-outline'} size={24} color={isOnline ? '#10B981' : theme.textSecondary} />
                  </View>
                  <View>
                    <Text style={[styles.toggleTitle, { color: theme.text }]}>Online rejim</Text>
                    <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>
                      {isOnline ? "Mijozlarga ko'rinasiz" : 'Yashirilgan'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isOnline}
                  onValueChange={handleToggleOnline}
                  trackColor={{ false: theme.border, true: '#10B981' + '80' }}
                  thumbColor={isOnline ? '#10B981' : theme.textTertiary}
                />
              </View>
            </Card>

            {/* Firma ma'lumotlari */}
            <Card>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Firma ma'lumotlari</Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Firma nomi *</Text>
                <Input value={companyName} onChangeText={setCompanyName} placeholder="Firma nomi" editable={!isSaving} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Telefon raqam *</Text>
                <Input
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+998 90 123 45 67"
                  keyboardType="phone-pad"
                  editable={!isSaving}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Firma haqida</Text>
                <Input
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Firma faoliyati haqida..."
                  multiline
                  numberOfLines={4}
                  style={{ minHeight: 100 }}
                  editable={!isSaving}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Firma manzili / Lokatsiya</Text>
                <TouchableOpacity
                  style={[
                    styles.locationButton,
                    {
                      borderColor: locationCoords ? theme.primary : theme.border,
                      backgroundColor: locationCoords ? theme.primary + '10' : theme.surfaceVariant,
                    },
                  ]}
                  onPress={() => setShowLocationPicker(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={locationCoords ? 'location' : 'location-outline'}
                    size={20}
                    color={locationCoords ? theme.primary : theme.textSecondary}
                  />
                  <Text style={[styles.locationText, { color: locationCoords ? theme.primary : theme.textSecondary }]}>
                    {locationCoords
                      ? `${locationCoords.latitude.toFixed(5)}, ${locationCoords.longitude.toFixed(5)}`
                      : 'Lokatsiya tanlash'}
                  </Text>
                  {locationCoords ? (
                    <TouchableOpacity
                      onPress={() => setLocationCoords(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
                  )}
                </TouchableOpacity>
              </View>

              <Button
                title={isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
                onPress={handleSaveProfile}
                disabled={isSaving}
                loading={isSaving}
              />
            </Card>

            {/* Bildirishnoma sozlamalari */}
            <Card>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Bildirishnoma sozlamalari</Text>

              {/* Master toggle */}
              <View style={[styles.notifRow, { borderBottomColor: theme.border }]}>
                <View style={styles.notifLeft}>
                  <View style={[styles.notifIcon, { backgroundColor: notifSettings.enabled ? theme.primary + '20' : theme.surfaceVariant }]}>
                    <Ionicons name="notifications" size={20} color={notifSettings.enabled ? theme.primary : theme.textSecondary} />
                  </View>
                  <View>
                    <Text style={[styles.notifTitle, { color: theme.text }]}>Bildirishnomalar</Text>
                    <Text style={[styles.notifSub, { color: theme.textSecondary }]}>Barcha bildirishnomalar</Text>
                  </View>
                </View>
                <Switch
                  value={notifSettings.enabled}
                  onValueChange={(v) => updateNotifSettings({ enabled: v })}
                  trackColor={{ false: theme.border, true: theme.primary + '60' }}
                  thumbColor={notifSettings.enabled ? theme.primary : theme.textTertiary}
                />
              </View>

              {/* Sound */}
              <View style={[styles.notifRow, { borderBottomColor: theme.border }]}>
                <View style={styles.notifLeft}>
                  <View style={[styles.notifIcon, { backgroundColor: '#F59E0B20' }]}>
                    <Ionicons name="volume-high" size={20} color="#F59E0B" />
                  </View>
                  <View>
                    <Text style={[styles.notifTitle, { color: theme.text }]}>Ovoz</Text>
                    <Text style={[styles.notifSub, { color: theme.textSecondary }]}>Yangi buyurtma ovozi</Text>
                  </View>
                </View>
                <Switch
                  value={notifSettings.sound}
                  onValueChange={(v) => updateNotifSettings({ sound: v })}
                  trackColor={{ false: theme.border, true: '#F59E0B60' }}
                  thumbColor={notifSettings.sound ? '#F59E0B' : theme.textTertiary}
                  disabled={!notifSettings.enabled}
                />
              </View>

              {/* Volume segments */}
              {notifSettings.sound && notifSettings.enabled && (
                <View style={[styles.volumeRow, { borderBottomColor: theme.border }]}>
                  <Ionicons name="volume-low" size={18} color={theme.textSecondary} />
                  <View style={[styles.volumeTrack, { backgroundColor: theme.surfaceVariant }]}>
                    {[0.25, 0.5, 0.75, 1.0].map((vol) => (
                      <TouchableOpacity
                        key={vol}
                        style={[
                          styles.volumeSegment,
                          { backgroundColor: (notifSettings.volume ?? 1.0) >= vol ? theme.primary : 'transparent' },
                        ]}
                        onPress={() => updateNotifSettings({ volume: vol })}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: (notifSettings.volume ?? 1.0) >= vol ? '#fff' : theme.textSecondary, fontSize: 11, fontWeight: '600' }}>
                          {vol === 1.0 ? '100%' : `${vol * 100}%`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Ionicons name="volume-high" size={18} color={theme.textSecondary} />
                </View>
              )}

              {/* Vibration */}
              <View style={[styles.notifRow, { borderBottomColor: theme.border }]}>
                <View style={styles.notifLeft}>
                  <View style={[styles.notifIcon, { backgroundColor: '#8B5CF620' }]}>
                    <Ionicons name="phone-portrait" size={20} color="#8B5CF6" />
                  </View>
                  <View>
                    <Text style={[styles.notifTitle, { color: theme.text }]}>Vibratsiya</Text>
                    <Text style={[styles.notifSub, { color: theme.textSecondary }]}>Buyurtma kelganda tebranish</Text>
                  </View>
                </View>
                <Switch
                  value={notifSettings.vibration}
                  onValueChange={(v) => updateNotifSettings({ vibration: v })}
                  trackColor={{ false: theme.border, true: '#8B5CF660' }}
                  thumbColor={notifSettings.vibration ? '#8B5CF6' : theme.textTertiary}
                  disabled={!notifSettings.enabled}
                />
              </View>

              {/* New orders */}
              <View style={[styles.notifRow, { borderBottomColor: theme.border }]}>
                <View style={styles.notifLeft}>
                  <View style={[styles.notifIcon, { backgroundColor: '#10B98120' }]}>
                    <Ionicons name="briefcase" size={20} color="#10B981" />
                  </View>
                  <View>
                    <Text style={[styles.notifTitle, { color: theme.text }]}>Yangi buyurtmalar</Text>
                    <Text style={[styles.notifSub, { color: theme.textSecondary }]}>Yangi buyurtma xabardorligi</Text>
                  </View>
                </View>
                <Switch
                  value={notifSettings.new_orders}
                  onValueChange={(v) => updateNotifSettings({ new_orders: v })}
                  trackColor={{ false: theme.border, true: '#10B98160' }}
                  thumbColor={notifSettings.new_orders ? '#10B981' : theme.textTertiary}
                  disabled={!notifSettings.enabled}
                />
              </View>

              {/* Order updates */}
              <View style={[styles.notifRow, { borderBottomColor: 'transparent' }]}>
                <View style={styles.notifLeft}>
                  <View style={[styles.notifIcon, { backgroundColor: '#3B82F620' }]}>
                    <Ionicons name="refresh-circle" size={20} color="#3B82F6" />
                  </View>
                  <View>
                    <Text style={[styles.notifTitle, { color: theme.text }]}>Buyurtma yangilanishlari</Text>
                    <Text style={[styles.notifSub, { color: theme.textSecondary }]}>Status o'zgarganda xabar</Text>
                  </View>
                </View>
                <Switch
                  value={notifSettings.order_updates}
                  onValueChange={(v) => updateNotifSettings({ order_updates: v })}
                  trackColor={{ false: theme.border, true: '#3B82F660' }}
                  thumbColor={notifSettings.order_updates ? '#3B82F6' : theme.textTertiary}
                  disabled={!notifSettings.enabled}
                />
              </View>
            </Card>

            {/* Sozlamalar */}
            <Card>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Sozlamalar</Text>

              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: theme.border }]}
                onPress={() => Linking.openURL('tel:+998501017695')}
                activeOpacity={0.7}
              >
                <Ionicons name="headset-outline" size={24} color={theme.primary} />
                <Text style={[styles.menuText, { color: theme.text }]}>Yordam xizmati</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>+998 50 101 76 95</Text>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: 'transparent' }]} onPress={handleLogout} activeOpacity={0.7}>
                <Ionicons name="log-out-outline" size={24} color={theme.error} />
                <Text style={[styles.menuText, { color: theme.error }]}>Chiqish</Text>
              </TouchableOpacity>
            </Card>
          </View>
        </ScrollView>
      )}

      {/* Order Detail Modal */}
      <Modal visible={showOrderModal} transparent animationType="fade" onRequestClose={() => setShowOrderModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowOrderModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
              <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={2}>
                {selectedOrder?.category?.icon} {selectedOrder?.title}
              </Text>
              <TouchableOpacity onPress={() => setShowOrderModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedOrder && (
                <>
                  <View style={[{ backgroundColor: getStatusColor(selectedOrder.status) + '15', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md }]}>
                    <Text style={{ color: getStatusColor(selectedOrder.status), fontWeight: '700', fontSize: 16 }}>
                      {getStatusLabel(selectedOrder.status)}
                    </Text>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>📋 Tavsif</Text>
                    <Text style={[styles.modalValue, { color: theme.text }]}>{selectedOrder.description}</Text>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>👤 Buyurtmachi</Text>
                    <Text style={[styles.modalValue, { color: theme.text }]}>{selectedOrder.customer?.name || "Noma'lum"}</Text>
                    {selectedOrder.customer?.email ? (
                      <Text style={[styles.modalSub, { color: theme.textSecondary }]}>{selectedOrder.customer.email}</Text>
                    ) : null}
                  </View>

                  {selectedOrder.customer_phone && selectedOrder.status !== 'pending' ? (
                    <TouchableOpacity
                      style={[styles.callBtn, { backgroundColor: '#10B981' + '15' }]}
                      onPress={() => Linking.openURL(`tel:${selectedOrder.customer_phone}`)}
                    >
                      <Ionicons name="call" size={18} color="#10B981" />
                      <Text style={{ color: '#10B981', fontWeight: '600', fontSize: 15 }}>{selectedOrder.customer_phone}</Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={styles.modalRow}>
                    <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>📍 Manzil</Text>
                    <Text style={[styles.modalValue, { color: theme.text }]}>
                      {selectedOrder.location && !/^-?\d+\./.test(selectedOrder.location)
                        ? selectedOrder.location
                        : selectedOrder.latitude
                        ? `${selectedOrder.latitude.toFixed(6)}, ${selectedOrder.longitude?.toFixed(6)}`
                        : "Ko'rsatilmagan"}
                    </Text>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>🕐 Sana</Text>
                    <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                      {new Date(selectedOrder.created_at).toLocaleString('uz-UZ')}
                    </Text>
                  </View>

                  {selectedOrder.status === 'pending' && (
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: '#EF4444', flex: 1 }]}
                        onPress={() => handleRejectOrder(selectedOrder.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={18} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 15 }}>Rad etish</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#10B981' + '15', borderColor: '#10B981', flex: 1 }]}
                        onPress={() => handleAcceptOrder(selectedOrder.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark" size={18} color="#10B981" />
                        <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 15 }}>Qabul qilish</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {(selectedOrder.status === 'accepted' || selectedOrder.status === 'in_progress') && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: theme.primary + '15', borderColor: theme.primary, marginTop: spacing.md }]}
                        onPress={() => handleCompleteOrder(selectedOrder.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-done" size={18} color={theme.primary} />
                        <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 15 }}>Bajarildi</Text>
                      </TouchableOpacity>
                    )}
                </>
              )}
            </ScrollView>

            <Button title="Yopish" onPress={() => setShowOrderModal(false)} style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>

      {/* Image Picker Modal */}
      <Modal
        visible={showImagePickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImagePickerModal(false)}
      >
        <TouchableOpacity
          style={styles.imagePickerOverlay}
          activeOpacity={1}
          onPress={() => setShowImagePickerModal(false)}
        >
          <View style={[styles.imagePickerSheet, { backgroundColor: theme.surface }]}>
            <Text style={[styles.imagePickerTitle, { color: theme.text }]}>Rasm tanlash</Text>
            <TouchableOpacity
              style={[styles.imagePickerOption, { borderBottomColor: theme.border }]}
              onPress={() => handleAvatarUpload('camera')}
              activeOpacity={0.7}
            >
              <Ionicons name="camera" size={24} color={theme.primary} />
              <Text style={[styles.imagePickerOptionText, { color: theme.text }]}>Kamera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imagePickerOption, { borderBottomColor: 'transparent' }]}
              onPress={() => handleAvatarUpload('gallery')}
              activeOpacity={0.7}
            >
              <Ionicons name="images" size={24} color={theme.primary} />
              <Text style={[styles.imagePickerOptionText, { color: theme.text }]}>Galereya</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imagePickerCancel, { backgroundColor: theme.surfaceVariant }]}
              onPress={() => setShowImagePickerModal(false)}
              activeOpacity={0.7}
            >
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>Bekor qilish</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Location Picker */}
      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationSelect={(coords) => {
          setShowLocationPicker(false);
          setLocationCoords(coords);
          setShowLocationPicker(false);
        }}
        initialLocation={locationCoords || undefined}
      />

      <AlertComponent />
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
  headerTitle: { ...typography.h3, flex: 1, textAlign: 'center' },
  onlineIndicatorBox: { width: 40, alignItems: 'flex-end' },
  onlineDot: { width: rs(10), height: rs(10), borderRadius: rs(5) },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  mainTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  mainTabText: { ...typography.bodyMedium, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  statCard: { flex: 1, alignItems: 'center', padding: spacing.md },
  statValue: { ...typography.h3, fontWeight: '700', fontSize: 20 },
  statLabel: { ...typography.small, textAlign: 'center', marginTop: spacing.xs / 2 },
  subTab: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  orderCard: { marginBottom: spacing.md },
  orderHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  orderTitle: { ...typography.bodyMedium, fontWeight: '600' },
  orderSub: { ...typography.small },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  statusText: { ...typography.small, fontWeight: '600' },
  orderInfoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs / 2 },
  orderInfoText: { ...typography.small, flex: 1 },
  orderDate: { ...typography.small, textAlign: 'right', marginTop: spacing.xs },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: rs(10),
    minHeight: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: spacing.md },
  emptyText: { ...typography.body },
  imagesContainer: { paddingVertical: spacing.md },
  profileImage: { width: 120, height: 120, borderRadius: borderRadius.md },
  avatarWrapper: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  companyAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  imagePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  imagePickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  imagePickerTitle: {
    ...typography.h4,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  imagePickerOptionText: {
    ...typography.bodyMedium,
    fontWeight: '500',
    fontSize: 16,
  },
  imagePickerCancel: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  onlineIconBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  toggleTitle: { ...typography.bodyMedium, fontWeight: '600' },
  toggleSub: { ...typography.small, marginTop: 2 },
  sectionTitle: { ...typography.h4, fontWeight: '600', marginBottom: spacing.md },
  inputGroup: { marginBottom: spacing.md },
  label: { ...typography.small, fontWeight: '600', marginBottom: spacing.xs },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  locationText: { ...typography.body, flex: 1 },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  notifLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: { ...typography.bodyMedium, fontWeight: '600' },
  notifSub: { ...typography.small, marginTop: 2 },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  volumeTrack: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    height: 36,
  },
  volumeSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
  },
  menuText: { ...typography.bodyMedium, flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '92%',
    maxWidth: 480,
    maxHeight: '85%',
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalTitle: { ...typography.h4, fontWeight: '700', flex: 1 },
  modalRow: { marginBottom: spacing.md },
  modalLabel: { ...typography.small, fontWeight: '600', marginBottom: spacing.xs / 2, textTransform: 'uppercase' },
  modalValue: { ...typography.bodyMedium, fontWeight: '500' },
  modalSub: { ...typography.small, marginTop: spacing.xs / 2 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
});
