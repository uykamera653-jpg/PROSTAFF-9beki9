import React, { createContext, useState, ReactNode, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (name: string, photoUrl?: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const profileChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    checkAuth();
    
    // Listen to Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      if (session?.user) {
        await loadUserProfile(session.user.id, session.user.email || '');
        setupProfileListener(session.user.id);
      } else {
        setUser(null);
        cleanupProfileListener();
      }
    });

    return () => {
      subscription.unsubscribe();
      cleanupProfileListener();
    };
  }, []);

  const setupProfileListener = (userId: string) => {
    // Cleanup existing listener
    cleanupProfileListener();

    // Setup real-time listener for profile changes
    profileChannelRef.current = supabase
      .channel(`profile_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log('✅ Profile updated:', payload.new);
          const updatedProfile = payload.new as any;
          setUser((prevUser) => {
            if (!prevUser) return null;
            return {
              ...prevUser,
              name: updatedProfile.name || prevUser.name,
              role: updatedProfile.role || prevUser.role,
            };
          });
        }
      )
      .subscribe();

    console.log('🎧 Profile listener setup for user:', userId);
  };

  const cleanupProfileListener = () => {
    if (profileChannelRef.current) {
      supabase.removeChannel(profileChannelRef.current);
      profileChannelRef.current = null;
      console.log('🔇 Profile listener cleaned up');
    }
  };

  const loadUserProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('User profile not found, creating...');
        // Create profile if not exists
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            email: email,
            name: email.split('@')[0],
            role: 'customer',
          })
          .select()
          .single();

        if (createError) {
          console.error('Failed to create profile:', createError);
          setUser({ id: userId, email, name: email.split('@')[0] });
        } else if (newProfile) {
          setUser({ id: newProfile.id, email: newProfile.email, name: newProfile.name, role: newProfile.role });
        }
      } else if (data) {
        setUser({ id: data.id, email: data.email, name: data.name, role: data.role });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUser({ id: userId, email, name: email.split('@')[0] });
    }
  };

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      
      // Check Supabase session first
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session error:', error);
      }
      
      if (session?.user) {
        await loadUserProfile(session.user.id, session.user.email || '');
      } else {
        // Fallback to local storage for backward compatibility
        const userJson = await AsyncStorage.getItem('user');
        if (userJson) {
          const localUser = JSON.parse(userJson);
          setUser(localUser);
        }
      }
    } catch (error) {
      console.error('Failed to check auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string) => {
    try {
      // Check if user already has Supabase account
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Already logged in via Supabase
        await loadUserProfile(session.user.id, session.user.email || '');
        return;
      }
      
      // Local login (mock)
      const newUser: User = {
        id: Date.now().toString(),
        email,
        name: email.split('@')[0],
      };
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
    } catch (error) {
      console.error('Failed to login:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log('🔓 Logging out...');
      
      // Cleanup profile listener first
      cleanupProfileListener();
      
      // Immediately clear user state to prevent redirect
      setUser(null);
      
      // Logout from Supabase if logged in
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase logout error:', error);
      }
      
      // Clear local storage
      await AsyncStorage.removeItem('user');
      
      console.log('✅ Logout complete');
    } catch (error) {
      console.error('Failed to logout:', error);
      cleanupProfileListener();
      setUser(null); // Still clear user even on error
      throw error;
    }
  };

  const logout = signOut; // Alias for backward compatibility

  const updateProfile = async (name: string, photoUrl?: string) => {
    try {
      if (!user) return;
      
      // Update in Supabase if user has Supabase account
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { error } = await supabase
          .from('user_profiles')
          .update({ name })
          .eq('id', user.id);
          
        if (error) {
          console.error('Failed to update Supabase profile:', error);
        }
      }
      
      // Update local state
      const updatedUser = { ...user, name, photoUrl };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
