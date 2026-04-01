import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useUserRole } from '../hooks/useUserRole';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { spacing, typography, borderRadius } from '../constants/theme';
import { supabase } from '../lib/supabase';

export default function IndexScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const { role, isLoading: roleLoading } = useUserRole();

  // Handle navigation based on role after auth
  useEffect(() => {
    if (isLoading || roleLoading) {
      return;
    }

    if (!user) {
      return;
    }

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

  // Show loading screen while checking auth
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

  // User is logged in and role is loaded
  if (user && !roleLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.logo, { color: theme.primary }]}>Prostaff</Text>
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: spacing.lg }} />
        <Text style={[styles.subtitle, { color: theme.textSecondary, marginTop: spacing.md }]}>Kirmoqda...</Text>
      </View>
    );
  }

  const handleAuth = async () => {
    if (!email.trim()) {
      setError('Email manzilni kiriting');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError('Parol kamida 6 ta belgidan iborat bo\'lishi kerak');
      return;
    }
    if (isSignUp && !name.trim()) {
      setError('Ismingizni kiriting');
      return;
    }
    if (isSignUp && !acceptedTerms) {
      setError('Iltimos, foydalanish shartlarini o\'qib chiqing va rozilik bildiring');
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
              name: name.trim(),
            },
          },
        });

        if (error) {
          setError(error.message);
        } else if (data.user) {
          if (data.session) {
            console.log('✅ Registration successful with auto-login');
          } else {
            console.log('🔄 Registration successful, auto-logging in...');
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password: password,
            });
            
            if (signInError) {
              setError('Ro\'yxatdan o\'tdingiz! Iltimos, kirish tugmasini bosing.');
              setIsSignUp(false);
            } else {
              console.log('✅ Auto-login successful');
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
        }
      }
    } catch (err: any) {
      setError(err.message || 'Kirish xatoligi');
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
            {isSignUp ? 'Ro\'yxatdan o\'tish' : 'Xush kelibsiz!'}
          </Text>
        </View>

        <View style={styles.form}>
          {/* Kirish / Ro'yxatdan o'tish toggle */}
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
                setAcceptedTerms(false);
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
                setAcceptedTerms(false);
              }}
              disabled={loading}
            >
              <Text style={[styles.authModeText, { color: isSignUp ? '#FFFFFF' : theme.textSecondary }]}>
                Ro'yxatdan o'tish
              </Text>
            </TouchableOpacity>
          </View>

          {isSignUp && (
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Ismingiz"
              autoCapitalize="words"
              editable={!loading}
            />
          )}

          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="Email manzilingiz"
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

          {/* Omaviy oferta checkbox - faqat ro'yxatdan o'tishda */}
          {isSignUp && (
            <View style={styles.termsContainer}>
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  { borderColor: acceptedTerms ? theme.primary : theme.border },
                  acceptedTerms && { backgroundColor: theme.primary },
                ]}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                disabled={loading}
              >
                {acceptedTerms && (
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
              <Text style={[styles.termsText, { color: theme.textSecondary, flex: 1 }]}>
                Men{' '}
                <Text
                  style={[styles.termsLink, { color: theme.primary }]}
                  onPress={() => setShowTermsModal(true)}
                >
                  foydalanish shartlari va omaviy oferta
                </Text>
                {' '}bilan tanishdim va roziman
              </Text>
            </View>
          )}

          {error ? (
            <Text style={[styles.error, { color: theme.error }]}>{error}</Text>
          ) : null}

          <Button
            title={isSignUp ? "Ro'yxatdan o'tish" : "Kirish"}
            onPress={handleAuth}
            loading={loading}
            disabled={loading || (isSignUp && !acceptedTerms)}
          />

          <TouchableOpacity
            onPress={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setAcceptedTerms(false);
            }}
            disabled={loading}
          >
            <Text style={[styles.switchText, { color: theme.primary }]}>
              {isSignUp 
                ? 'Akkauntingiz bormi? Kirish' 
                : 'Akkauntingiz yo\'qmi? Ro\'yxatdan o\'tish'
              }
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Omaviy oferta modal */}
      <Modal
        visible={showTermsModal}
        animationType="slide"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View
            style={[
              styles.modalHeader,
              { paddingTop: insets.top + spacing.md, backgroundColor: theme.surface },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Foydalanish shartlari
            </Text>
            <TouchableOpacity
              onPress={() => setShowTermsModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.termsContent, { color: theme.text }]}>
              <Text style={styles.termsHeading}>1. Umumiy qoidalar{'\n\n'}</Text>
              Prostaff mobil ilovasi (keyingi o'rinlarda "Ilova") ish beruvchilar va ishchilar o'rtasida vositachilik qiluvchi xizmat hisoblanadi. Ilovadan foydalanish orqali siz quyidagi shartlarga rozilik bildirasiz:{'\n\n'}

              • Barcha kiritilgan ma'lumotlar haqiqiy va to'g'ri ekanligini tasdiqlaysiz{'\n'}
              • Ilovani qonuniy maqsadlarda foydalanishga rozilik bildirasiz{'\n'}
              • Boshqa foydalanuvchilarning huquqlarini hurmat qilasiz{'\n\n'}

              <Text style={styles.termsHeading}>2. Xizmat shartlari{'\n\n'}</Text>
              Ishchi va ish beruvchi o'rtasidagi barcha kelishuvlar, to'lovlar va shartnomalar bevosita ular o'rtasida amalga oshiriladi. Prostaff bu jarayonlarda vositachi vazifasini bajaradi va:{'\n\n'}

              • Ishchi sifati va malakasi uchun javobgar emas{'\n'}
              • To'lovlar va hisob-kitoblarda ishtirok etmaydi{'\n'}
              • Foydalanuvchilar o'rtasidagi nizolar uchun javobgar emas{'\n\n'}

              <Text style={styles.termsHeading}>3. Maxfiylik siyosati{'\n\n'}</Text>
              Sizning shaxsiy ma'lumotlaringiz qat'iy maxfiy saqlanadi va uchinchi shaxslarga berilmaydi. Biz faqat quyidagi ma'lumotlarni yig'amiz:{'\n\n'}

              • Ism va email manzil{'\n'}
              • Telefon raqami{'\n'}
              • Joylashuv ma'lumotlari (faqat xizmat ko'rsatish uchun){'\n\n'}

              <Text style={styles.termsHeading}>4. Foydalanuvchi majburiyatlari{'\n\n'}</Text>
              • Noto'g'ri yoki yolg'on ma'lumot bermaslik{'\n'}
              • Boshqa foydalanuvchilarni aldamaslik{'\n'}
              • Ilovadan spam yoki reklama maqsadida foydalanmaslik{'\n'}
              • Haqorat, tahdid yoki zo'ravonlikka oid xabarlar yubormaslik{'\n\n'}

              <Text style={styles.termsHeading}>5. Javobgarlik cheklovi{'\n\n'}</Text>
              Prostaff quyidagilar uchun javobgar bo'lmaydi:{'\n\n'}

              • Ishchilar va ish beruvchilar o'rtasidagi nizolar{'\n'}
              • Sifatsiz ish yoki xizmat ko'rsatish{'\n'}
              • To'lovlar va moliyaviy nizolar{'\n'}
              • Ma'lumotlar yo'qolishi yoki zararlanishi{'\n\n'}

              <Text style={styles.termsHeading}>6. O'zgarishlar{'\n\n'}</Text>
              Prostaff ushbu shartlarni istalgan vaqtda o'zgartirish huquqini o'zida saqlab qoladi. O'zgarishlar ilovada e'lon qilinadi va foydalanuvchilar ulardan xabardor qilinadi.{'\n\n'}

              <Text style={styles.termsHeading}>7. Aloqa{'\n\n'}</Text>
              Savollar yoki murojaatlar uchun:{'\n'}
              📞 Telefon: +998 50 101 76 95{'\n'}
              📧 Email: support@prostaff.uz{'\n\n'}

              <Text style={styles.termsFooter}>
                Oxirgi yangilanish: {new Date().toLocaleDateString('uz-UZ', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}{'\n\n'}
                © 2024 Prostaff. Barcha huquqlar himoyalangan.
              </Text>
            </Text>
          </ScrollView>

          <View style={[styles.modalFooter, { backgroundColor: theme.surface }]}>
            <Button
              title="Qabul qilish va yopish"
              onPress={() => {
                setAcceptedTerms(true);
                setShowTermsModal(false);
              }}
            />
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    justifyContent: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    ...typography.h1,
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
  switchText: {
    ...typography.body,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  authModeToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  authModeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  authModeText: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  termsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: -spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {
    ...typography.small,
    lineHeight: 20,
  },
  termsLink: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    ...typography.h3,
    flex: 1,
  },
  closeButton: {
    padding: spacing.xs,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  termsContent: {
    ...typography.body,
    lineHeight: 24,
  },
  termsHeading: {
    ...typography.h4,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  termsFooter: {
    ...typography.small,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  modalFooter: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
});
