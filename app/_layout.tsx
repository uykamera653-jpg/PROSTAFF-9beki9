import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SettingsProvider } from '../contexts/SettingsContext';
import { AuthProvider } from '../contexts/AuthContext';
import { JobsProvider } from '../contexts/JobsContext';
import { CompaniesProvider } from '../contexts/CompaniesContext';
import { FavoritesProvider } from '../contexts/FavoritesContext';
import { ReviewsProvider } from '../contexts/ReviewsContext';
import { WorkersProvider } from '../contexts/WorkersContext';
import { AppConfigProvider } from '../contexts/AppConfigContext';
import { NotificationSettingsProvider } from '../contexts/NotificationSettingsContext';

export default function RootLayout() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 1500);
  }, []);

  if (loading) {
    return (
      <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <AppConfigProvider>
      <SettingsProvider>
        <AuthProvider>
          <NotificationSettingsProvider>
            <JobsProvider>
              <CompaniesProvider>
                <FavoritesProvider>
                  <ReviewsProvider>
                    <WorkersProvider>
                      <StatusBar style="auto" />
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="admin-panel" />
                        <Stack.Screen name="worker-dashboard" />
                        <Stack.Screen name="company-dashboard" />
                        <Stack.Screen name="worker-onboarding" />
                        <Stack.Screen name="company-onboarding" />
                        <Stack.Screen name="worker-profile" />
                        <Stack.Screen name="company-profile" />
                        <Stack.Screen name="daily-workers" />
                        <Stack.Screen name="order-service" />
                        <Stack.Screen name="post-job" />
                        <Stack.Screen name="worker-search" />
                        <Stack.Screen name="company-detail" />
                        <Stack.Screen name="order-detail" />
                      </Stack>
                    </WorkersProvider>
                  </ReviewsProvider>
                </FavoritesProvider>
              </CompaniesProvider>
            </JobsProvider>
          </NotificationSettingsProvider>
        </AuthProvider>
      </SettingsProvider>
    </AppConfigProvider>
  );
}
