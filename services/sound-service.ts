import { Platform, Vibration } from 'react-native';
import { Audio } from 'expo-av';

// ─── expo-notifications (mobile only) ───────────────────────────────────────
let Notifications: any = null;
if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch { /* ignore */ }
}

// ─── expo-av sound instance ───────────────────────────────────────────────────
let _sound: Audio.Sound | null = null;
let _isPlaying = false;
let _isPlayingTimeout: ReturnType<typeof setTimeout> | null = null;

// Android channel version — increment when channel config changes
// This forces Android to recreate the channel with new settings (bypassDnd, etc.)
const ANDROID_CHANNEL_ID = 'new-orders-v4';

// Reliable public CDN audio URLs
const SOUND_URLS = [
  'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3',
  'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3',
  'https://cdn.pixabay.com/download/audio/2022/11/17/audio_febc508520.mp3',
];

// ─── Force reset playing state ───────────────────────────────────────────────
function resetPlayingState() {
  _isPlaying = false;
  if (_isPlayingTimeout) {
    clearTimeout(_isPlayingTimeout);
    _isPlayingTimeout = null;
  }
}

// ─── Android: delete old channel and create fresh one ───────────────────────
async function ensureAndroidChannel() {
  if (!Notifications || Platform.OS !== 'android') return;

  // Delete old channels to clear cached settings
  const oldChannels = ['new-orders', 'new-orders-v2', 'new-orders-v3'];
  for (const ch of oldChannels) {
    try {
      await Notifications.deleteNotificationChannelAsync(ch);
    } catch { /* ignore if not exists */ }
  }

  // Create fresh channel with all required settings
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Yangi buyurtmalar',
    description: 'Yangi buyurtmalar uchun bildirishnomalar',
    importance: Notifications.AndroidImportance?.MAX ?? 5,
    vibrationPattern: [0, 500, 300, 500, 300, 700],
    sound: 'default',
    enableLights: true,
    lightColor: '#FF6B35',
    enableVibrate: true,
    showBadge: true,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
  }).catch((e: any) => console.warn('[SoundService] channel create failed:', e));
}

// Run channel setup once on import (mobile only)
if (Platform.OS === 'android' && Notifications) {
  ensureAndroidChannel().catch(() => {});
}

// ─── PRIMARY: OS-level local notification (bypassDnd) ────────────────────────
async function playViaLocalNotification(title: string, body: string): Promise<boolean> {
  if (!Notifications || Platform.OS === 'web') return false;
  try {
    // Ensure Android foreground handler plays sound
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        priority: Notifications.AndroidNotificationPriority?.MAX ?? 5,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: 'max',
        vibrate: [0, 500, 300, 500],
        data: { type: 'new_order', ts: Date.now() },
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
      trigger: null,
    });
    return true;
  } catch (e) {
    console.warn('[SoundService] localNotification failed:', e);
    return false;
  }
}

// ─── SECONDARY: expo-av streaming audio ──────────────────────────────────────
async function playViaAv(volume: number): Promise<boolean> {
  if (_isPlaying) resetPlayingState();

  try {
    _isPlaying = true;
    _isPlayingTimeout = setTimeout(() => { resetPlayingState(); }, 8000);

    // Set audio mode — playsInSilentModeIOS = true is KEY for iOS silent mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    // Unload previous
    if (_sound) {
      try { await _sound.stopAsync(); await _sound.unloadAsync(); } catch { /* ignore */ }
      _sound = null;
    }

    const safeVol = Math.max(0.6, Math.min(1.0, volume));

    // Try CDN URLs
    for (const url of SOUND_URLS) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true, volume: safeVol, isLooping: false },
          (status) => {
            if (status.isLoaded && status.didJustFinish) {
              sound.unloadAsync().catch(() => {});
              if (_sound === sound) _sound = null;
              resetPlayingState();
            }
          }
        );
        _sound = sound;
        console.log('[SoundService] Playing via AV:', url);
        return true;
      } catch (e) {
        console.warn('[SoundService] AV URL failed:', url, e);
        continue;
      }
    }

    resetPlayingState();
    return false;
  } catch (e) {
    resetPlayingState();
    console.warn('[SoundService] expo-av failed:', e);
    return false;
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Yangi buyurtma signali:
 * 1. Vibration (darhol, har doim)
 * 2. OS notification (bypassDnd kanal — jim rejimida ham ovoz chiqaradi)
 * 3. expo-av CDN audio (parallel)
 */
export async function playNotificationSound(
  volume = 1.0,
  title = 'Yangi buyurtma!',
  body = 'Sizga yangi buyurtma keldi'
): Promise<void> {
  console.log('[SoundService] playNotificationSound called');

  // 1. VIBRATSIYA — darhol, parallel
  if (Platform.OS !== 'web') {
    try {
      Vibration.cancel();
      Vibration.vibrate([0, 500, 200, 500, 200, 800]);
    } catch (e) {
      console.warn('[SoundService] Vibration failed:', e);
    }
  }

  // 2 & 3 — parallel (OS notification + expo-av)
  await Promise.allSettled([
    playViaLocalNotification(title, body),
    playViaAv(volume),
  ]);
}

/** Aktiv ovozni to'xtatadi */
export async function stopNotificationSound(): Promise<void> {
  resetPlayingState();
  if (Platform.OS !== 'web') Vibration.cancel();
  if (_sound) {
    try { await _sound.stopAsync(); await _sound.unloadAsync(); } catch { /* ignore */ }
    _sound = null;
  }
}
