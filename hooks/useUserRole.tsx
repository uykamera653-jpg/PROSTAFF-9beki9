import { useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export type UserRole = 'customer' | 'worker' | 'company' | 'admin' | 'moderator';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>('customer');
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) {
      setRole('customer');
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchUserRole();

    // Cleanup previous channel if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Real-time subscription for role changes
    channelRef.current = supabase
      .channel(`user_role_${user.id}_${Date.now()}`)
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
            const newRole = payload.new.role as UserRole;
            setRole(newRole);
          }
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]);

  const fetchUserRole = async () => {
    try {
      setIsLoading(true);
      
      if (!user?.id) {
        setRole('customer');
        return;
      }
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !data) {
        setRole('customer');
      } else {
        setRole(data.role as UserRole);
      }
    } catch (error) {
      setRole('customer');
    } finally {
      setIsLoading(false);
    }
  };

  return { role, isLoading, refetch: fetchUserRole };
}
