/**
 * SoundService v9 — Bundled WAV asset + expo-av
 *
 * Flow:
 *  1. Vibration        — always, no permission needed
 *  2. expo-av          — plays from cacheDirectory WAV (written from bundled base64 once)
 *  3. expo-notifications — OS-level fallback (bypassDnd, works when app is bg/closed)
 *
 * Key improvements over v8:
 *  - WAV base64 is imported from a bundled JS module (no runtime math)
 *  - File written to cache on first call, path cached for subsequent calls
 *  - Fresh Sound object each call (avoids stale state from preload)
 *  - No rate-limiting flag that could silently swallow playback
 */
import { Platform, Vibration } from 'react-native';
import { BEEP_WAV_B64 } from '../assets/sounds/beep-b64';

// ─── Dynamic imports (mobile only) ────────────────────────────────────────────
let Audio: any         = null;
let FileSystem: any    = null;
let Notifications: any = null;

if (Platform.OS !== 'web') {
  try { Audio         = require('expo-av').Audio;          } catch { console.warn('[Sound] expo-av missing'); }
  try { FileSystem    = require('expo-file-system');        } catch { console.warn('[Sound] expo-file-system missing'); }
  try { Notifications = require('expo-notifications');     } catch { console.warn('[Sound] expo-notifications missing'); }
}

// ─── WAV file path (cached after first write) ─────────────────────────────────
let _cachedWavPath: string | null = null;

async function getWavPath(): Promise<string | null> {
  if (!FileSystem) return null;

  // Return cached path if file still exists
  if (_cachedWavPath) {
    try {
      const info = await FileSystem.getInfoAsync(_cachedWavPath);
      if (info.exists) return _cachedWavPath;
    } catch { /* fall through and rewrite */ }
    _cachedWavPath = null;
  }

  try {
    const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!dir) { console.warn('[Sound] No writable directory'); return null; }

    const path = `${dir}prostaff_beep_v9.wav`;

    // Write bundled base64 → WAV file
    await FileSystem.writeAsStringAsync(path, BEEP_WAV_B64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    _cachedWavPath = path;
    console.log('[Sound] WAV written (bundled b64) →', path);
    return path;
  } catch (e) {
    console.warn('[Sound] WAV write error:', e);
    return null;
  }
}

// ─── Audio mode ───────────────────────────────────────────────────────────────
let _audioModeSet = false;

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
    console.log('[Sound] AudioMode set ✅');
  } catch (e) {
    console.warn('[Sound] AudioMode err:', e);
  }
}

// ─── Notification channel ─────────────────────────────────────────────────────
const CHANNEL_ID = 'prostaff-v9';
let _channelReady = false;
let _permGranted: boolean | null = null;

async function ensurePerm(): Promise<boolean> {
  if (_permGranted !== null) return _permGranted;
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
    // Clean up old channels
    const OLD = [
      'new-orders','new-orders-v2','new-orders-v3','new-orders-v4',
      'prostaff-orders-v5','prostaff-orders-v6','prostaff-v7','prostaff-v8',
    ];
    for (const id of OLD) {
      try { await Notifications.deleteNotificationChannelAsync(id); } catch { /* ok */ }
    }

    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name:             'Yangi buyurtmalar',
      importance:       Notifications.AndroidImportance?.MAX ?? 5,
      sound:            'default',
      vibrationPattern: [0, 400, 150, 400],
      enableVibrate:    true,
      enableLights:     true,
      lightColor:       '#FF6B35',
      bypassDnd:        true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
    });
    _channelReady = true;
    console.log('[Sound] Channel', CHANNEL_ID, 'ready ✅');
  } catch (e) {
    console.warn('[Sound] Channel err:', e);
  }
}

// Foreground notification handler
if (Platform.OS !== 'web' && Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert:  true,
      shouldPlaySound:  true,
      shouldSetBadge:   false,
      shouldShowBanner: true,
      shouldShowList:   true,
    }),
  });
}

// ─── Startup init ─────────────────────────────────────────────────────────────
if (Platform.OS !== 'web') {
  setTimeout(async () => {
    try {
      await Promise.all([ensureAudioMode(), ensureChannel(), ensurePerm()]);
      await getWavPath(); // Pre-write WAV so first notification is instant
      console.log('[Sound] Startup init done ✅');
    } catch (e) {
      console.warn('[Sound] Startup init err:', e);
    }
  }, 600);
}

// ─── Mobile playback ──────────────────────────────────────────────────────────
async function playOnMobile(vol: number, title: string, body: string): Promise<void> {
  console.log('[Sound] playOnMobile called vol=', vol);

  // 1. Vibration — always works, no permissions required
  try {
    Vibration.cancel();
    Vibration.vibrate([0, 400, 120, 400, 120, 600]);
    console.log('[Sound] Vibration ✅');
  } catch (e) {
    console.warn('[Sound] Vibration err:', e);
  }

  // 2. expo-av with bundled WAV
  let avOk = false;
  let sound: any = null;
  try {
    await ensureAudioMode();
    const wavPath = await getWavPath();
    console.log('[Sound] wavPath:', wavPath);

    if (wavPath && Audio) {
      // Ensure file:// prefix on Android
      const uri = Platform.OS === 'android' && !wavPath.startsWith('file://')
        ? 'file://' + wavPath
        : wavPath;

      console.log('[Sound] createAsync uri:', uri);

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
      avOk = true;
      console.log('[Sound] expo-av playing ✅');

      // Auto-unload
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          console.log('[Sound] expo-av finished, unloaded');
        }
        if (status.error) {
          console.warn('[Sound] Playback status error:', status.error);
          sound.unloadAsync().catch(() => {});
        }
      });

      // Safety unload after 6s
      setTimeout(() => {
        sound?.unloadAsync().catch(() => {});
      }, 6000);
    }
  } catch (e) {
    console.warn('[Sound] expo-av error:', e);
    // Invalidate cached path so it gets rewritten next time
    _cachedWavPath = null;
  }

  console.log('[Sound] expo-av result:', avOk);

  // 3. expo-notifications — OS-level sound (app background / closed)
  try {
    const granted = await ensurePerm();
    if (granted && Notifications) {
      await ensureChannel();
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
    }
  } catch (e) {
    console.warn('[Sound] Notification err:', e);
  }
}

// ─── Web AudioContext ──────────────────────────────────────────────────────────
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

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

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

  // Re-init everything fresh
  _audioModeSet  = false;
  _channelReady  = false;
  _permGranted   = null;
  _cachedWavPath = null;

  await Promise.all([ensureAudioMode(), ensureChannel(), ensurePerm()]);
  await getWavPath(); // Rewrite WAV
  await playOnMobile(volume, '🔔 Test ovozi', 'Ovoz ishlayapdi — buyurtma ovozi shunday chiqadi');
}
