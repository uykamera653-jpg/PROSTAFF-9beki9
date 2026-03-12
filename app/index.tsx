import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { spacing, typography } from '../constants/theme';
import { supabase } from '../lib/supabase';

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
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');

  if (user && !isLoading) {
    return <Redirect href="/(tabs)/home" />;
  }

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });

      if (error) {
        setError(error.message);
      }
    } catch (err: any) {
      setError(err.message || t.loginError);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setError('6 ta raqamli kodni kiriting');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: otpCode,
        type: 'signup',
      });

      if (error) {
        setError(error.message);
      } else if (data.session) {
        setShowOtpModal(false);
        alert('Email tasdiqlandi!');
        router.replace('/(tabs)/home');
      }
    } catch (err: any) {
      setError(err.message || 'Tasdiqlash xatoligi');
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
            // User is automatically logged in
            alert('Ro\'yxatdan o\'tdingiz!');
            router.replace('/(tabs)/home');
          } else {
            // Email confirmation required - show OTP modal
            setOtpEmail(email.trim());
            setShowOtpModal(true);
            setError('');
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
            title={t.signInWithGoogle}
            onPress={handleGoogleSignIn}
            variant="outline"
            loading={loading}
            disabled={loading}
          />
          <Text style={[styles.note, { color: theme.textTertiary }]}>
            * Google Sign-In uchun Supabase da Google provider yoqilgan bo'lishi kerak
          </Text>
        </View>
      </View>

      {/* OTP Verification Modal */}
      <Modal visible={showOtpModal} transparent animationType="fade" onRequestClose={() => setShowOtpModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Email ni tasdiqlang</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {otpEmail} manziliga 6 ta raqamli kod yuborildi
            </Text>
            <Input
              value={otpCode}
              onChangeText={setOtpCode}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              editable={!loading}
            />
            {error ? (
              <Text style={[styles.error, { color: theme.error }]}>{error}</Text>
            ) : null}
            <Button
              title="Tasdiqlash"
              onPress={handleVerifyOtp}
              loading={loading}
              disabled={loading}
            />
            <TouchableOpacity onPress={() => setShowOtpModal(false)} disabled={loading}>
              <Text style={[styles.cancelText, { color: theme.textTertiary }]}>Bekor qilish</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    padding: spacing.xl,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    gap: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  cancelText: {
    ...typography.body,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
