import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

export type UserRole = 'customer' | 'worker' | 'company' | 'admin';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>('customer');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole('customer');
      setIsLoading(false);
      return;
    }

    fetchUserRole();
  }, [user]);

  const fetchUserRole = async () => {
    try {
      setIsLoading(true);
      
      if (!user?.id) {
        setRole('customer');
        setIsLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.log('Failed to fetch user role:', error.message);
        setRole('customer');
      } else if (data) {
        console.log('User role fetched:', data.role);
        setRole(data.role as UserRole);
      } else {
        setRole('customer');
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      setRole('customer');
    } finally {
      setIsLoading(false);
    }
  };

  return { role, isLoading, refetch: fetchUserRole };
}
