/**
 * SoundService v10 — APK-safe: Notifications PRIMARY, expo-av SECONDARY
 *
 * Android APK da eng ishonchli tartibi:
 *  1. Vibration         — har doim, ruxsatsiz
 *  2. expo-notifications — OS-level, bypassDnd:true, channel MAX — APK da 100% ishlaydi
 *  3. expo-av           — qo'shimcha WAV audio (notification bilan bir vaqtda)
 *  4. Web AudioContext  — web uchun
 */
import { Platform, Vibration } from 'react-native';
import { BEEP_WAV_B64 } from '../assets/sounds/beep-b64';

// ─── Dynamic imports ────────────────────────────────────────────────────────
let Audio: any         = null;
let FileSystem: any    = null;
let Notifications: any = null;

if (Platform.OS !== 'web') {
  try { Audio         = require('expo-av').Audio;       } catch { console.warn('[Sound] expo-av missing'); }
  try { FileSystem    = require('expo-file-system');     } catch { console.warn('[Sound] expo-file-system missing'); }
  try { Notifications = require('expo-notifications');  } catch { console.warn('[Sound] expo-notifications missing'); }
}

// ─── Notification channel ────────────────────────────────────────────────────
const CHANNEL_ID = 'prostaff-v10';
let _channelReady  = false;
let _permGranted: boolean | null = null;

export async function checkNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    _permGranted = status === 'granted';
    return _permGranted;
  } catch { return false; }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    _permGranted = status === 'granted';
    return _permGranted;
  } catch { return false; }
}

async function ensureChannel(): Promise<void> {
  if (_channelReady || Platform.OS !== 'android' || !Notifications) return;
  try {
    // Eski kanallarni tozalash
    const OLD_CHANNELS = [
      'new-orders','new-orders-v2','new-orders-v3','new-orders-v4',
      'prostaff-orders-v5','prostaff-orders-v6','prostaff-v7','prostaff-v8','prostaff-v9',
    ];
    for (const id of OLD_CHANNELS) {
      try { await Notifications.deleteNotificationChannelAsync(id); } catch { /* ok */ }
    }

    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name:             'Yangi buyurtmalar',
      importance:       Notifications.AndroidImportance?.MAX ?? 5,
      sound:            'default',
      vibrationPattern: [0, 400, 150, 400, 150, 600],
      enableVibrate:    true,
      enableLights:     true,
      lightColor:       '#FF6B35',
      bypassDnd:        true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
    });
    _channelReady = true;
    console.log('[Sound] Channel', CHANNEL_ID, 'ready ✅');
  } catch (e) {
    console.warn('[Sound] Channel error:', e);
  }
}

// Foreground notification handler
if (Platform.OS !== 'web' && Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert:  true,
        shouldPlaySound:  true,
        shouldSetBadge:   false,
        shouldShowBanner: true,
        shouldShowList:   true,
      }),
    });
  } catch { /* ok */ }
}

// ─── WAV file (expo-av) ──────────────────────────────────────────────────────
let _cachedWavPath: string | null = null;
let _audioModeSet = false;

async function getWavPath(): Promise<string | null> {
  if (!FileSystem) return null;
  if (_cachedWavPath) {
    try {
      const info = await FileSystem.getInfoAsync(_cachedWavPath);
      if (info.exists) return _cachedWavPath;
    } catch { /* rewrite */ }
    _cachedWavPath = null;
  }
  try {
    const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!dir) return null;
    const path = `${dir}prostaff_beep_v10.wav`;
    await FileSystem.writeAsStringAsync(path, BEEP_WAV_B64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    _cachedWavPath = path;
    return path;
  } catch (e) {
    console.warn('[Sound] WAV write error:', e);
    return null;
  }
}

async function ensureAudioMode(): Promise<void> {
  if (_audioModeSet || !Audio) return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:         false,
      staysActiveInBackground:    true,
      playsInSilentModeIOS:       true,
      shouldDuckAndroid:          false,
      playThroughEarpieceAndroid: false,
    });
    _audioModeSet = true;
  } catch (e) {
    console.warn('[Sound] AudioMode error:', e);
  }
}

// ─── Startup init ────────────────────────────────────────────────────────────
if (Platform.OS !== 'web') {
  setTimeout(async () => {
    try {
      await ensureChannel();
      await checkNotificationPermission();
      await ensureAudioMode();
      await getWavPath();
      console.log('[Sound] v10 startup init done ✅');
    } catch (e) {
      console.warn('[Sound] Startup init error:', e);
    }
  }, 800);
}

// ─── Mobile playback ─────────────────────────────────────────────────────────
async function playOnMobile(vol: number, title: string, body: string): Promise<void> {
  console.log('[Sound] playOnMobile v10 vol=', vol, 'platform=', Platform.OS);

  // 1. Vibration — har doim
  try {
    Vibration.cancel();
    Vibration.vibrate([0, 300, 100, 300, 100, 500]);
    console.log('[Sound] Vibration ✅');
  } catch (e) {
    console.warn('[Sound] Vibration error:', e);
  }

  // 2. expo-notifications — PRIMARY (APK da bypassDnd kanal orqali ishlaydi)
  try {
    await ensureChannel();
    const granted = _permGranted ?? (await checkNotificationPermission());
    if (granted && Notifications) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound:    'default',
          priority: 'max',
          data:     { type: 'new-order', ts: Date.now() },
          ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
        },
        trigger: null,
      });
      console.log('[Sound] Notification scheduled ✅');
    } else {
      console.warn('[Sound] Notification permission not granted');
    }
  } catch (e) {
    console.warn('[Sound] Notification error:', e);
  }

  // 3. expo-av — SECONDARY (qo'shimcha audio)
  let sound: any = null;
  try {
    await ensureAudioMode();
    const wavPath = await getWavPath();
    if (wavPath && Audio) {
      const uri = Platform.OS === 'android' && !wavPath.startsWith('file://')
        ? 'file://' + wavPath
        : wavPath;

      const result = await Audio.Sound.createAsync(
        { uri },
        {
          shouldPlay:  true,
          volume:      Math.max(0.7, Math.min(1.0, vol)),
          isLooping:   false,
          isMuted:     false,
        }
      );
      sound = result.sound;
      console.log('[Sound] expo-av playing ✅');

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
        if (status.error) {
          console.warn('[Sound] expo-av playback error:', status.error);
          _cachedWavPath = null; // Force rewrite next time
          sound.unloadAsync().catch(() => {});
        }
      });

      setTimeout(() => { sound?.unloadAsync().catch(() => {}); }, 8000);
    }
  } catch (e) {
    console.warn('[Sound] expo-av error:', e);
    _cachedWavPath = null;
  }
}

// ─── Web AudioContext ────────────────────────────────────────────────────────
let _webCtx: any = null;

function getWebCtx(): any {
  if (typeof window === 'undefined') return null;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!_webCtx) { try { _webCtx = new AC(); } catch { return null; } }
  return _webCtx;
}

export function unlockWebAudio(): void {
  const ctx = getWebCtx();
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
}

function webBeep(vol = 1.0): void {
  const ctx = getWebCtx();
  if (!ctx) return;
  const play = () => {
    const amp = Math.max(0.3, Math.min(1.0, vol));
    const t   = ctx.currentTime;
    const tone = (freq: number, start: number, dur: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(amp, start + 0.012);
      gain.gain.linearRampToValueAtTime(0, start + dur);
      osc.start(start); osc.stop(start + dur + 0.01);
    };
    tone(880,  t,        0.22);
    tone(1100, t + 0.30, 0.22);
    tone(1320, t + 0.60, 0.26);
  };
  ctx.state === 'suspended' ? ctx.resume().then(play).catch(() => {}) : play();
}

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

export async function playNotificationSound(
  volume = 1.0,
  title  = 'Yangi buyurtma! 🔔',
  body   = 'Sizga yangi buyurtma keldi'
): Promise<void> {
  console.log('[Sound] playNotificationSound platform:', Platform.OS);
  if (Platform.OS === 'web') { webBeep(volume); return; }
  await playOnMobile(volume, title, body);
}

export async function stopNotificationSound(): Promise<void> {
  if (Platform.OS !== 'web') {
    try { Vibration.cancel(); } catch { /* ok */ }
  }
}

export async function testAndPreloadSound(volume = 1.0): Promise<void> {
  console.log('[Sound] testAndPreloadSound called');
  if (Platform.OS === 'web') { unlockWebAudio(); webBeep(volume); return; }

  // Re-init fresh
  _channelReady  = false;
  _permGranted   = null;
  _audioModeSet  = false;
  _cachedWavPath = null;

  await ensureChannel();
  await checkNotificationPermission();
  await ensureAudioMode();
  await getWavPath();
  await playOnMobile(volume, '🔔 Test ovozi', 'Ovoz ishlayapdi — buyurtma ovozi shunday chiqadi');
}
