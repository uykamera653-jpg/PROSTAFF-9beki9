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

// Fallback CDN URLs (used only if OS notification also fails)
const SOUND_URLS = [
  'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  'https://assets.mixkit.co/active_storage/sfx/2309/2309-preview.mp3',
  'https://assets.mixkit.co/active_storage/sfx/1820/1820-preview.mp3',
];

// ─── PRIMARY: OS-level local notification (guaranteed sound on device) ────────
async function playViaLocalNotification(title: string, body: string): Promise<boolean> {
  if (!Notifications || Platform.OS === 'web') return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: 'max',
        vibrate: [0, 400, 200, 400],
        data: { type: 'new_order' },
      },
      trigger: null, // fire immediately
    });
    return true;
  } catch (e) {
    console.warn('[SoundService] localNotification failed:', e);
    return false;
  }
}

// ─── SECONDARY: expo-av streaming audio ───────────────────────────────────────
async function playViaAv(volume: number): Promise<boolean> {
  if (_isPlaying) return false;
  try {
    _isPlaying = true;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

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
              _isPlaying = false;
            }
          }
        );
        _sound = sound;
        // Safety reset after 12 s
        setTimeout(() => { _isPlaying = false; }, 12000);
        return true;
      } catch { continue; }
    }

    _isPlaying = false;
    return false;
  } catch (e) {
    _isPlaying = false;
    console.warn('[SoundService] expo-av failed:', e);
    return false;
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Yangi buyurtma uchun ovozli signal.
 * 1. OS local notification (kafolatlangan tizim ovozi)
 * 2. expo-av streaming (in-app ovoz)
 * 3. Vibration fallback (har doim)
 */
export async function playNotificationSound(
  volume = 1.0,
  title = 'Yangi buyurtma!',
  body = 'Sizga yangi buyurtma keldi'
): Promise<void> {
  // 1. OS notification — primary (triggers device ringtone/notification sound)
  const notifOk = await playViaLocalNotification(title, body);

  // 2. expo-av — in-app audio layer
  playViaAv(volume).catch(() => {});

  // 3. Vibration — always guaranteed
  if (Platform.OS !== 'web') {
    Vibration.vibrate([0, 400, 200, 400]);
  }
}

/** Aktiv ovozni to'xtatadi */
export async function stopNotificationSound(): Promise<void> {
  _isPlaying = false;
  if (_sound) {
    try { await _sound.stopAsync(); await _sound.unloadAsync(); } catch { /* ignore */ }
    _sound = null;
  }
}
