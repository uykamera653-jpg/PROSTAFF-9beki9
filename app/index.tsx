import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

export default function IndexScreen() {
  const { user, login, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      login('demo@prostaff.uz').catch(() => {});
    }
  }, [isLoading, user]);

  return <Redirect href="/(tabs)/home" />;
}
