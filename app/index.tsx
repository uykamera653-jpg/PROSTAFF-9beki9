import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Redirect } from 'expo-router';
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
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleEmailSignIn = async () => {
    if (!email.trim()) {
      setError(t.emailRequired);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
      });

      if (error) {
        setError(error.message);
      } else {
        setError('');
        alert(t.checkEmail);
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

          {error ? (
            <Text style={[styles.error, { color: theme.error }]}>{error}</Text>
          ) : null}

          <Button
            title={t.signInWithEmail}
            onPress={handleEmailSignIn}
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
            title={t.signInWithGoogle}
            onPress={handleGoogleSignIn}
            variant="outline"
            loading={loading}
            disabled={loading}
          />
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
});
