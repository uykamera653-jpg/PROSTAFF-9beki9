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

// ─── Embedded beep sound (base64 WAV — 440Hz, 0.4s) ─────────────────────────
// Bu lokal audio — internet shart emas, har doim ishlaydi
const BEEP_BASE64 =
  'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA' +
  'EAAQAARKwAAIhYAQACABAAZGF0YVQGAACBgH98eXZ0cnBvbm1s' +
  'a2pqaWloZ2dmZmZmZ2doaWpra2xtbm9wcXJzdHV2d3h5enx9f4' +
  'CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6Sl' +
  'pqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJys' +
  'vMzc7P0NHS09TV1tfY2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w' +
  '8fLz9PX29/j5+vv8/f7/AAECAwQFBgcICQoLDA0ODxAREhMUFRYX' +
  'GBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+' +
  'P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2Rl' +
  'ZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouM' +
  'jY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKz' +
  'tLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna' +
  '29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/wAB' +
  'AgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQlJico' +
  'KSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj9AQUJDREVGR0hJSktMTU5P' +
  'UFFSU1RVVldYWVpbXF1eX2BhYmNkZWZnaGlqa2xtbm9wcXJzdHV2' +
  'd3h5ent8fX5/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5yd' +
  'np+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExc' +
  'bHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufn6Onq6+' +
  'zt7u/w8fLz9PX29/j5+vv8/f7/';

// Reliable CDN URLs (fallback)
const SOUND_URLS = [
  'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  'https://cdn.freesound.org/previews/250/250629_4486188-lq.mp3',
  'https://www.soundjay.com/buttons/sounds/beep-01a.mp3',
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
async function playViaLocalNotification(title: string, body: string): Promise<boolean> {
  if (!Notifications || Platform.OS === 'web') return false;
  try {
    if (Platform.OS === 'android') {
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

// ─── SECONDARY: expo-av audio ────────────────────────────────────────────────
async function playViaAv(volume: number): Promise<boolean> {
  if (_isPlaying) resetPlayingState();

  try {
    _isPlaying = true;
    _isPlayingTimeout = setTimeout(() => { resetPlayingState(); }, 5000);

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,   // iOS jim rejimida ham chiqaradi
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    // Unload previous sound
    if (_sound) {
      try { await _sound.stopAsync(); await _sound.unloadAsync(); } catch { /* ignore */ }
      _sound = null;
    }

    const safeVol = Math.max(0.5, Math.min(1.0, volume));

    // 1. Try embedded base64 beep first (no internet needed)
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: BEEP_BASE64 },
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
    } catch (e1) {
      console.warn('[SoundService] base64 beep failed, trying CDN:', e1);
    }

    // 2. Fallback: CDN URLs
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
 * Yangi buyurtma uchun signal — HECH QANDAY SHART YO'Q:
 * 1. Vibration (har doim)
 * 2. OS local notification (bypassDnd — jim rejimida ham)
 * 3. expo-av: embedded beep → CDN fallback
 */
export async function playNotificationSound(
  volume = 1.0,
  title = 'Yangi buyurtma!',
  body = 'Sizga yangi buyurtma keldi'
): Promise<void> {
  // 1. VIBRATSIYA — har doim, birinchi navbatda
  if (Platform.OS !== 'web') {
    Vibration.cancel();
    Vibration.vibrate([0, 400, 150, 400, 150, 600]);
  }

  // 2. OS notification (async, parallel) — tizim ovozi, bypassDnd
  playViaLocalNotification(title, body).catch(() => {});

  // 3. expo-av (async, parallel) — embedded beep, internet shart emas
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
