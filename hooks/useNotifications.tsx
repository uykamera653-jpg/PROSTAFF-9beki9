import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '../lib/supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface UseNotificationsReturn {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  isLoading: boolean;
  error: string | null;
  registerForPushNotifications: () => Promise<string | null>;
}

export function useNotifications(userId: string | null): UseNotificationsReturn {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Setup notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📨 Notification received:', notification);
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', response);
      // Handle navigation here based on notification data
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
    if (!userId) {
      console.log('⚠️ No user ID, skipping push registration');
      return null;
    }

    // Web doesn't support push notifications via Expo
    if (Platform.OS === 'web') {
      console.log('⚠️ Push notifications not supported on web');
      setError('Push notifications are not supported on web');
      return null;
    }

    // Only works on physical devices
    if (!Device.isDevice) {
      console.log('⚠️ Must use physical device for push notifications');
      setError('Must use physical device for push notifications');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        setError('Push notification permission denied');
        setIsLoading(false);
        return null;
      }

      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-project-id', // This will be auto-configured by Expo
      });
      const token = tokenData.data;
      console.log('✅ Push token:', token);

      // Save token to database
      const deviceType = Platform.OS;
      const { error: dbError } = await supabase
        .from('push_tokens')
        .upsert(
          {
            user_id: userId,
            token,
            device_type: deviceType,
          },
          {
            onConflict: 'user_id,token',
          }
        );

      if (dbError) {
        console.error('❌ Failed to save push token:', dbError);
        setError('Failed to save push token');
      } else {
        console.log('✅ Push token saved to database');
        setExpoPushToken(token);
      }

      setIsLoading(false);
      return token;
    } catch (err: any) {
      console.error('❌ Push notification registration error:', err);
      setError(err.message || 'Failed to register for push notifications');
      setIsLoading(false);
      return null;
    }
  };

  // Auto-register when user ID is available
  useEffect(() => {
    if (userId && !expoPushToken && Platform.OS !== 'web' && Device.isDevice) {
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
