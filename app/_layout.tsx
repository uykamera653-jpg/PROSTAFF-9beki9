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

export default function RootLayout() {
  return (
    <AppConfigProvider>
      <SettingsProvider>
        <AuthProvider>
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
                    </Stack>
                  </WorkersProvider>
                </ReviewsProvider>
              </FavoritesProvider>
            </CompaniesProvider>
          </JobsProvider>
        </AuthProvider>
      </SettingsProvider>
    </AppConfigProvider>
  );
}
