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

// Reliable CDN URLs
const SOUND_URLS = [
  'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  'https://assets.mixkit.co/active_storage/sfx/2309/2309-preview.mp3',
  'https://assets.mixkit.co/active_storage/sfx/1820/1820-preview.mp3',
];

// ─── Force reset playing state ───────────────────────────────────────────────
function resetPlayingState() {
  _isPlaying = false;
  if (_isPlayingTimeout) {
    clearTimeout(_isPlayingTimeout);
    _isPlayingTimeout = null;
  }
}

// ─── PRIMARY: OS-level local notification ────────────────────────────────────
// Android bypassDnd:true → jim/tebranish rejimida ham ovoz chiqaradi
async function playViaLocalNotification(title: string, body: string): Promise<boolean> {
  if (!Notifications || Platform.OS === 'web') return false;
  try {
    if (Platform.OS === 'android') {
      // Re-create channel every time to ensure bypassDnd is applied
      await Notifications.setNotificationChannelAsync('new-orders', {
        name: 'Yangi buyurtmalar',
        importance: Notifications.AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 500, 200, 500],
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
      }).catch(() => {});
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: 'max',
        vibrate: [0, 500, 200, 500],
        data: { type: 'new_order' },
        ...(Platform.OS === 'android' ? { channelId: 'new-orders' } : {}),
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
  // Reset stale playing state before trying
  if (_isPlaying) {
    resetPlayingState();
  }
  try {
    _isPlaying = true;

    // Safety auto-reset after 4 seconds
    _isPlayingTimeout = setTimeout(() => { resetPlayingState(); }, 4000);

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    // Unload previous sound
    if (_sound) {
      try { await _sound.stopAsync(); await _sound.unloadAsync(); } catch { /* ignore */ }
      _sound = null;
    }

    const safeVol = Math.max(0.1, Math.min(1.0, volume));

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
        return true;
      } catch { continue; }
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
 * Yangi buyurtma uchun signal — HECH QANDAY SHART YO'Q, har doim chaqiriladi:
 * 1. Vibration (eng ishonchli — har doim ishlaydi)
 * 2. OS local notification (tizim ovozi, bypassDnd)
 * 3. expo-av streaming audio
 */
export async function playNotificationSound(
  volume = 1.0,
  title = 'Yangi buyurtma!',
  body = 'Sizga yangi buyurtma keldi'
): Promise<void> {
  // 1. VIBRATSIYA — har doim, birinchi navbatda
  if (Platform.OS !== 'web') {
    Vibration.cancel();
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
  }

  // 2. OS notification (async, parallel)
  playViaLocalNotification(title, body).catch(() => {});

  // 3. expo-av audio (async, parallel)
  playViaAv(volume).catch(() => {});
}

/** Aktiv ovozni to'xtatadi */
export async function stopNotificationSound(): Promise<void> {
  resetPlayingState();
  Vibration.cancel();
  if (_sound) {
    try { await _sound.stopAsync(); await _sound.unloadAsync(); } catch { /* ignore */ }
    _sound = null;
  }
}
