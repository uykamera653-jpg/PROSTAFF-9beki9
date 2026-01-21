import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SettingsProvider } from '../contexts/SettingsContext';
import { AuthProvider } from '../contexts/AuthContext';
import { JobsProvider } from '../contexts/JobsContext';
import { CompaniesProvider } from '../contexts/CompaniesContext';
import { FavoritesProvider } from '../contexts/FavoritesContext';
import { ReviewsProvider } from '../contexts/ReviewsContext';
import { WorkersProvider } from '../contexts/WorkersContext';

export default function RootLayout() {
  return (
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
                  </Stack>
                </WorkersProvider>
              </ReviewsProvider>
            </FavoritesProvider>
          </CompaniesProvider>
        </JobsProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
