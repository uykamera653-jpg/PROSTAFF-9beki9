import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

export type UserRole = 'customer' | 'worker' | 'company' | 'admin' | 'moderator';

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

    // Real-time subscription for role changes
    const channel = supabase
      .channel(`user_profile_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && 'role' in payload.new) {
            setRole(payload.new.role as UserRole);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        setRole('customer');
      } else if (data) {
        setRole(data.role as UserRole);
      } else {
        setRole('customer');
      }
    } catch (error) {
      setRole('customer');
    } finally {
      setIsLoading(false);
    }
  };

  return { role, isLoading, refetch: fetchUserRole };
}
