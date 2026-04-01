import { useState, useEffect, useRef } from 'react';
import { Platform, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';

// Conditionally import expo-notifications only on mobile
let Notifications: any = null;
let Device: any = null;

if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
  Device = require('expo-device');

  // Configure notification behavior (only on mobile)
  // Foreground notification handler — app ochiq bo'lsa ham ovoz chiqaradi
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority?.MAX ?? 5,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Create Android notification channels
  if (Platform.OS === 'android') {
    // HIGH priority channel — new-orders
    Notifications.setNotificationChannelAsync('new-orders', {
      name: 'Yangi buyurtmalar',
      description: 'Yangi buyurtmalar haqida bildirishnomalar',
      importance: Notifications.AndroidImportance?.MAX ?? 5,
      vibrationPattern: [0, 400, 200, 400],
      sound: 'default',          // OS default notification sound
      enableLights: true,
      lightColor: '#FF6B35',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
      bypassDnd: true,
    });

    // Default channel
    Notifications.setNotificationChannelAsync('default', {
      name: 'Umumiy',
      importance: Notifications.AndroidImportance?.MAX ?? 5,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      showBadge: true,
    });
  }
}

interface UseNotificationsReturn {
  expoPushToken: string | null;
  notification: any | null;
  isLoading: boolean;
  error: string | null;
  registerForPushNotifications: () => Promise<string | null>;
}

export function useNotifications(userId: string | null): UseNotificationsReturn {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    if (Platform.OS === 'web' || !Notifications) return;

    notificationListener.current = Notifications.addNotificationReceivedListener((notif: any) => {
      setNotification(notif);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
      // Notification tapped — could navigate here
      const data = response?.notification?.request?.content?.data;
      console.log('👆 Notification tapped, data:', data);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const registerForPushNotifications = async (): Promise<string | null> => {
    if (!userId) return null;
    if (Platform.OS === 'web') return null;
    if (!Device?.isDevice) {
      console.log('⚠️ Push notifications only work on physical devices');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check & request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowCriticalAlerts: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        setError('Push notification permission denied');
        setIsLoading(false);
        // Sozlamalarga yo'naltirish
        if (Platform.OS !== 'web') {
          Linking.openSettings().catch(() => {});
        }
        return null;
      }

      // Get project ID from Constants or use fallback
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId ??
        undefined;

      let token: string;
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : {}
        );
        token = tokenData.data;
      } catch (tokenErr: any) {
        // Fallback: try without projectId
        console.warn('Token with projectId failed, trying without:', tokenErr?.message);
        const tokenData = await Notifications.getExpoPushTokenAsync();
        token = tokenData.data;
      }

      console.log('✅ Push token:', token);

      // Save token to database (upsert)
      const { error: dbError } = await supabase
        .from('push_tokens')
        .upsert(
          {
            user_id: userId,
            token,
            device_type: Platform.OS,
          },
          { onConflict: 'user_id,token' }
        );

      if (dbError) {
        console.error('❌ Failed to save push token:', dbError);
        setError('Failed to save push token');
      } else {
        console.log('✅ Push token saved');
        setExpoPushToken(token);
      }

      return token;
    } catch (err: any) {
      console.error('❌ Push registration error:', err);
      setError(err.message || 'Failed to register for push notifications');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-register when user logs in
  useEffect(() => {
    if (userId && !expoPushToken && Platform.OS !== 'web' && Device?.isDevice) {
      registerForPushNotifications();
    }
  }, [userId]);

  return {
    expoPushToken,
    notification,
    isLoading,
    error,
    registerForPushNotifications,
  };
}
