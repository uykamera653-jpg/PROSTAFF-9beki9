import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { spacing, typography } from '../constants/theme';
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


  if (user && !isLoading) {
    return <Redirect href="/(tabs)/home" />;
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
            } else if (sessionData?.session) {
              console.log('✅ Session created successfully');
              // Wait for session to propagate
              await new Promise(resolve => setTimeout(resolve, 500));
              router.replace('/(tabs)/home');
            }
          } else {
            console.error('❌ No code in callback URL');
            setError('Kirish bekor qilindi');
          }
        } else if (result.type === 'cancel') {
          console.log('⚠️ User cancelled');
          setError('Google kirish bekor qilindi');
        } else {
          console.error('❌ Auth failed:', result);
          setError('Google kirish xatoligi');
        }
      } else if (Platform.OS === 'web') {
        // Web platform: browser will redirect automatically
        console.log('🌐 Web redirect initiated');
      }
    } catch (err: any) {
      console.error('❌ Google sign in error:', err);
      setError(err.message || 'Google kirish xatoligi');
    } finally {
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
          // User registered successfully - auto login
          alert('Ro\'yxatdan o\'tdingiz!');
          router.replace('/(tabs)/home');
        }
      } else {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (error) {
          setError(error.message);
        } else if (data.user) {
          router.replace('/(tabs)/home');
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

          <TouchableOpacity
            onPress={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            disabled={loading}
          >
            <Text style={[styles.switchText, { color: theme.primary }]}>
              {isSignUp ? "Akkauntingiz bormi? Kirish" : "Akkauntingiz yo'qmi? Ro'yxatdan o'tish"}
            </Text>
          </TouchableOpacity>

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

});
