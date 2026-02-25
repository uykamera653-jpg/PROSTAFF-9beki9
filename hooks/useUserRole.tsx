import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export type UserRole = 'customer' | 'worker' | 'company' | 'admin';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>('customer');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In future, fetch from Supabase user_profiles.role
    // For now, default to customer
    setRole('customer');
    setIsLoading(false);
  }, [user]);

  return { role, isLoading };
}
