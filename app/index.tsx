import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useUserRole } from '../hooks/useUserRole';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { spacing, typography, borderRadius } from '../constants/theme';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function IndexScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');


  const { role, isLoading: roleLoading } = useUserRole();

  // Web platform: Handle OAuth callback from URL
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Check if we have OAuth callback params
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);
      
      if (hashParams.has('access_token') || queryParams.has('code')) {
        console.log('🔐 OAuth callback detected');
        setLoading(true);
        // Wait a bit for Supabase to process the session
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('✅ Session after OAuth:', !!session);
            setLoading(false);
            // AuthContext will handle the redirect via onAuthStateChange
          });
        }, 1000);
      }
    }
  }, []);

  // Handle navigation based on role after auth
  useEffect(() => {
    // Wait for both auth and role to finish loading
    if (isLoading || roleLoading) {
      return;
    }

    // No user - stay on login page
    if (!user) {
      return;
    }

    // User exists - redirect based on role (only once)
    const timeout = setTimeout(() => {
      switch (role) {
        case 'admin':
        case 'moderator':
          router.replace('/admin-panel');
          break;
        case 'worker':
          router.replace('/worker-dashboard');
          break;
        case 'company':
          router.replace('/company-dashboard');
          break;
        default:
          router.replace('/(tabs)/home');
          break;
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [isLoading, user, roleLoading, role]);

  // Show loading screen while checking auth or role
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.logo, { color: theme.primary }]}>Prostaff</Text>
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: spacing.lg }} />
        <Text style={[styles.subtitle, { color: theme.textSecondary, marginTop: spacing.md }]}>Yuklanmoqda...</Text>
      </View>
    );
  }

  // User is logged in, show loading while role is being determined
  if (user && roleLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.logo, { color: theme.primary }]}>Prostaff</Text>
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: spacing.lg }} />
        <Text style={[styles.subtitle, { color: theme.textSecondary, marginTop: spacing.md }]}>Profil yuklanmoqda...</Text>
      </View>
    );
  }

  // User is logged in and role is loaded, show loading while navigating
  if (user && !roleLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.logo, { color: theme.primary }]}>Prostaff</Text>
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: spacing.lg }} />
        <Text style={[styles.subtitle, { color: theme.textSecondary, marginTop: spacing.md }]}>Kirmoqda...</Text>
      </View>
    );
  }

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');

      // Generate redirect URL for all platforms
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'onspaceapp',
        path: 'auth',
      });

      console.log('🔗 Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) {
        console.error('OAuth error:', error);
        setError(error.message);
        setLoading(false);
        return;
      }

      // For mobile: Open browser and wait for callback
      if (Platform.OS !== 'web' && data?.url) {
        console.log('📱 Opening browser...');
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success') {
          console.log('✅ Browser returned:', result.url);
          
          // Extract code from callback URL
          const url = new URL(result.url);
          const code = url.searchParams.get('code');
          
          if (code) {
            console.log('🔑 Exchanging code for session...');
            const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
            
            if (sessionError) {
              console.error('❌ Session exchange error:', sessionError);
              setError(sessionError.message);
              setLoading(false);
            } else if (sessionData?.session) {
              console.log('✅ Session created successfully');
              // Navigation handled by useEffect
            }
          } else {
            console.error('❌ No code in callback URL');
            setError('Kirish bekor qilindi');
            setLoading(false);
          }
        } else if (result.type === 'cancel') {
          console.log('⚠️ User cancelled');
          setError('Google kirish bekor qilindi');
          setLoading(false);
        } else {
          console.error('❌ Auth failed:', result);
          setError('Google kirish xatoligi');
          setLoading(false);
        }
      } else if (Platform.OS === 'web') {
        // Web platform: browser will redirect automatically
        console.log('🌐 Web redirect initiated - browser will handle callback');
        // Don't set loading to false - let the callback handler manage it
      }
    } catch (err: any) {
      console.error('❌ Google sign in error:', err);
      setError(err.message || 'Google kirish xatoligi');
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    try {
      setLoading(true);
      setError('');
      
      const demoEmail = 'demo@prostaff.uz';
      const demoPassword = 'demo123456';
      
      // Direct sign in - no signup fallback to avoid email rate limits
      const { data, error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (error) {
        // Show clear error message
        if (error.message.includes('rate limit')) {
          setError('Email rate limit - bir necha daqiqa kuting yoki boshqa akkaunt bilan kiring');
        } else {
          setError('Demo kirish xatoligi: ' + error.message);
        }
        console.error('Demo login error:', error);
      } else if (data.user) {
        // Successful login
        router.replace('/(tabs)/home');
      }
    } catch (err: any) {
      setError(err.message || 'Demo kirish xatoligi');
    } finally {
      setLoading(false);
    }
  };





  const handleEmailAuth = async () => {
    if (!email.trim()) {
      setError(t.emailRequired);
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError('Parol kamida 6 ta belgidan iborat bo\'lishi kerak');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      if (isSignUp) {
        // Registration
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              name: email.split('@')[0],
            },
          },
        });

        if (error) {
          setError(error.message);
        } else if (data.user) {
          // Check if email confirmation is required
          if (data.session) {
            // Email confirmation disabled - user is auto-logged in
            console.log('✅ Registration successful with auto-login');
            // Navigation handled by AuthContext
          } else {
            // Email confirmation required
            // Auto-login after registration
            console.log('🔄 Registration successful, auto-logging in...');
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password: password,
            });
            
            if (signInError) {
              // If can't auto-login, show message and switch to login tab
              if (Platform.OS === 'web') {
                alert('Ro\'yxatdan o\'tdingiz! Iltimos, kirish tugmasini bosing.');
              } else {
                Alert.alert('Ro\'yxatdan o\'tdingiz!', 'Iltimos, kirish tugmasini bosing.');
              }
              setIsSignUp(false);
            } else {
              console.log('✅ Auto-login successful');
              // Navigation handled by AuthContext
            }
          }
        }
      } else {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (error) {
          setError(error.message);
        } else {
          console.log('✅ Login successful');
          // Navigation handled by AuthContext
        }
      }
    } catch (err: any) {
      setError(err.message || t.loginError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.logo, { color: theme.primary }]}>Prostaff</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t.welcomeBack}
          </Text>
        </View>

        <View style={styles.form}>
          {/* Kirish/Ro'yxatdan o'tish toggle */}
          <View style={styles.authModeToggle}>
            <TouchableOpacity
              style={[
                styles.authModeButton,
                { borderColor: theme.border },
                !isSignUp && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => {
                setIsSignUp(false);
                setError('');
              }}
              disabled={loading}
            >
              <Text style={[styles.authModeText, { color: !isSignUp ? '#FFFFFF' : theme.textSecondary }]}>
                Kirish
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.authModeButton,
                { borderColor: theme.border },
                isSignUp && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => {
                setIsSignUp(true);
                setError('');
              }}
              disabled={loading}
            >
              <Text style={[styles.authModeText, { color: isSignUp ? '#FFFFFF' : theme.textSecondary }]}>
                Ro'yxatdan o'tish
              </Text>
            </TouchableOpacity>
          </View>

          <Input
            value={email}
            onChangeText={setEmail}
            placeholder={t.emailPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />

          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="Parol (kamida 6 ta belgi)"
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

          {error ? (
            <Text style={[styles.error, { color: theme.error }]}>{error}</Text>
          ) : null}

          <Button
            title={isSignUp ? "Ro'yxatdan o'tish" : "Kirish"}
            onPress={handleEmailAuth}
            loading={loading}
            disabled={loading}
          />

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.textTertiary }]}>
              {t.or}
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <Button
            title="🎭 Demo profil bilan kirish"
            onPress={handleDemoLogin}
            variant="outline"
            loading={loading}
            disabled={loading}
          />

          <Button
            title={t.signInWithGoogle}
            onPress={handleGoogleSignIn}
            variant="outline"
            loading={loading}
            disabled={loading}
          />
          <Text style={[styles.note, { color: theme.textTertiary }]}>
            * Demo: demo@prostaff.uz / demo123456
          </Text>
        </View>
      </View>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    ...typography.h1,
    fontSize: 48,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  form: {
    gap: spacing.lg,
  },
  error: {
    ...typography.small,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...typography.small,
  },
  note: {
    ...typography.small,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: -spacing.sm,
  },
  switchText: {
    ...typography.body,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  authModeToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  authModeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  authModeText: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },

});
