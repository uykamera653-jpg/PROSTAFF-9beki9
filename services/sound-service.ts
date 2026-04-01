/**
 * SoundService — buyurtma kelganda ovoz va vibratsiya
 *
 * Asosiy yondashuv: Sound ob'ekti startup da preload qilinadi va warm state da saqlanadi.
 * Realtime event kelganda darhol play qilinadi — hech qanday kechikish yo'q.
 *
 * Android APK: expo-av (preloaded WAV) + Vibration + expo-notifications (bypassDnd)
 * Web:         Web Audio API singleton AudioContext
 * iOS:         expo-av (preloaded) + playsInSilentModeIOS
 */
import { Platform, Vibration } from 'react-native';

// ─── expo-av (mobile only) ───────────────────────────────────────────────────
let Audio: any = null;
let FileSystem: any = null;
if (Platform.OS !== 'web') {
  try { Audio = require('expo-av').Audio; } catch { /* ignore */ }
  try { FileSystem = require('expo-file-system'); } catch { /* ignore */ }
}

// ─── expo-notifications (mobile only) ────────────────────────────────────────
let Notifications: any = null;
if (Platform.OS !== 'web') {
  try { Notifications = require('expo-notifications'); } catch { /* ignore */ }
}

// ─── WAV generator (pure JS, no deps) ────────────────────────────────────────
function generateBeepWav(): Uint8Array {
  const sampleRate    = 22050;
  const duration      = 0.9;
  const numSamples    = Math.floor(sampleRate * duration);
  const bitsPerSample = 16;
  const blockAlign    = bitsPerSample / 8;
  const byteRate      = sampleRate * blockAlign;
  const dataSize      = numSamples * blockAlign;
  const buf           = new ArrayBuffer(44 + dataSize);
  const view          = new DataView(buf);

  const ws = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  ws(0,  'RIFF');  view.setUint32(4,  36 + dataSize, true);
  ws(8,  'WAVE');  ws(12, 'fmt ');
  view.setUint32(16, 16,          true);
  view.setUint16(20, 1,           true); // PCM
  view.setUint16(22, 1,           true); // mono
  view.setUint32(24, sampleRate,  true);
  view.setUint32(28, byteRate,    true);
  view.setUint16(32, blockAlign,  true);
  view.setUint16(34, bitsPerSample, true);
  ws(36, 'data');  view.setUint32(40, dataSize, true);

  const beeps = [
    { freq: 880,  start: 0.00, end: 0.20 },
    { freq: 1100, start: 0.28, end: 0.48 },
    { freq: 1320, start: 0.56, end: 0.80 },
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    for (const b of beeps) {
      if (t >= b.start && t < b.end) {
        const local = t - b.start;
        const len   = b.end - b.start;
        const env   = Math.min(local / 0.015, 1, (len - local) / 0.015);
        sample = Math.sin(2 * Math.PI * b.freq * t) * env * 0.9;
        break;
      }
    }
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }
  return new Uint8Array(buf);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// ─── Preloaded sound state ────────────────────────────────────────────────────
let _preloadedSound: any  = null;   // expo-av Sound object, always warm
let _wavUri: string | null = null;   // cached file URI
let _isInitializing = false;
let _initDone = false;
let _audioModeSet = false;

async function setAudioModeOnce(): Promise<void> {
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
    console.log('[Sound] AudioMode set OK');
  } catch (e) {
    console.warn('[Sound] AudioMode error:', e);
  }
}

async function getOrCreateWavUri(): Promise<string | null> {
  if (_wavUri) {
    // Verify it still exists
    try {
      if (FileSystem) {
        const info = await FileSystem.getInfoAsync(_wavUri);
        if (info.exists) return _wavUri;
      }
    } catch { /* regenerate */ }
    _wavUri = null;
  }

  if (!FileSystem) return null;
  try {
    const wav  = generateBeepWav();
    const b64  = uint8ToBase64(wav);
    const path = `${FileSystem.documentDirectory}prostaff_v7.wav`;
    await FileSystem.writeAsStringAsync(path, b64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    _wavUri = path;
    console.log('[Sound] WAV file created:', path);
    return path;
  } catch (e) {
    console.warn('[Sound] WAV write failed:', e);
    return null;
  }
}

/**
 * Preload the sound so it's instantly ready when notification comes.
 * Called at app startup and after each play.
 */
async function preloadSound(): Promise<void> {
  if (!Audio || _isInitializing) return;
  _isInitializing = true;
  try {
    await setAudioModeOnce();

    // Unload old sound if any
    if (_preloadedSound) {
      try { await _preloadedSound.unloadAsync(); } catch { /* ignore */ }
      _preloadedSound = null;
    }

    const uri = await getOrCreateWavUri();
    if (!uri) {
      console.warn('[Sound] No WAV URI — cannot preload');
      return;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false, volume: 1.0, isLooping: false }
    );
    _preloadedSound = sound;
    _initDone = true;
    console.log('[Sound] Preload OK ✅');
  } catch (e) {
    console.warn('[Sound] Preload failed:', e);
    _preloadedSound = null;
  } finally {
    _isInitializing = false;
  }
}

/**
 * Play the preloaded sound. If not preloaded, load and play immediately.
 */
async function playPreloadedSound(vol: number): Promise<boolean> {
  if (!Audio) return false;
  try {
    // If preloaded — just replay from start
    if (_preloadedSound) {
      try {
        await _preloadedSound.setVolumeAsync(Math.max(0.6, Math.min(1.0, vol)));
        await _preloadedSound.setPositionAsync(0);
        await _preloadedSound.playAsync();
        console.log('[Sound] Played from preloaded sound ✅');
        // Reload after 2s so it's ready for next notification
        setTimeout(() => preloadSound(), 2000);
        return true;
      } catch (e) {
        console.warn('[Sound] Preloaded play failed, reloading:', e);
        _preloadedSound = null;
      }
    }

    // Fallback: load and play fresh
    console.log('[Sound] Preload not ready — loading fresh...');
    await setAudioModeOnce();
    const uri = await getOrCreateWavUri();
    if (!uri) return false;

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, volume: Math.max(0.6, Math.min(1.0, vol)) }
    );

    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        // Reload preload for next time
        setTimeout(() => preloadSound(), 500);
      }
    });
    console.log('[Sound] Played fresh ✅');
    return true;
  } catch (e) {
    console.warn('[Sound] playPreloadedSound error:', e);
    return false;
  }
}

// ─── Notification channel ─────────────────────────────────────────────────────
const CHANNEL_ID = 'prostaff-v7';
let _channelReady = false;
let _permGranted: boolean | null = null;

async function ensureNotifPermission(): Promise<boolean> {
  if (_permGranted !== null) return _permGranted;
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    _permGranted = status === 'granted';
    return _permGranted;
  } catch { return false; }
}

async function ensureChannel(): Promise<void> {
  if (_channelReady || !Notifications || Platform.OS !== 'android') return;
  try {
    // Delete old channels
    for (const id of [
      'new-orders','new-orders-v2','new-orders-v3','new-orders-v4',
      'prostaff-orders-v5','prostaff-orders-v6',
    ]) {
      try { await Notifications.deleteNotificationChannelAsync(id); } catch { /* ignore */ }
    }
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name:             'Yangi buyurtmalar',
      importance:        Notifications.AndroidImportance?.MAX ?? 5,
      sound:            'default',
      vibrationPattern: [0, 400, 200, 400],
      enableVibrate:    true,
      enableLights:     true,
      lightColor:       '#FF6B35',
      bypassDnd:        true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
    });
    _channelReady = true;
    console.log('[Sound] Channel v7 created ✅');
  } catch (e) {
    console.warn('[Sound] Channel error:', e);
  }
}

// Foreground notification handler
if (Notifications && Platform.OS !== 'web') {
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

// ─── Startup initialization ───────────────────────────────────────────────────
if (Platform.OS !== 'web') {
  // Run after a short delay so app has time to mount
  setTimeout(() => {
    console.log('[Sound] Starting initialization...');
    Promise.all([
      preloadSound(),
      ensureChannel(),
      ensureNotifPermission(),
    ]).then(() => {
      console.log('[Sound] All initialized ✅');
    }).catch((e) => {
      console.warn('[Sound] Init error:', e);
    });
  }, 1000);
}

// ─── Rate limit ───────────────────────────────────────────────────────────────
let _lastPlayTime = 0;
const MIN_INTERVAL_MS = 2000;

// ─── Mobile main function ─────────────────────────────────────────────────────
async function playMobileSound(vol: number, title: string, body: string): Promise<void> {
  const now = Date.now();
  if (now - _lastPlayTime < MIN_INTERVAL_MS) {
    console.log('[Sound] Rate limited, skipping');
    return;
  }
  _lastPlayTime = now;

  console.log('[Sound] playMobileSound called, preloadReady:', !!_preloadedSound);

  // 1. Vibration — always first, no permissions needed
  try {
    Vibration.cancel();
    Vibration.vibrate([0, 400, 200, 400, 200, 600]);
    console.log('[Sound] Vibration OK');
  } catch (e) {
    console.warn('[Sound] Vibration error:', e);
  }

  // 2. expo-av (preloaded — instant playback)
  const avOk = await playPreloadedSound(vol);
  console.log('[Sound] expo-av result:', avOk);

  // 3. expo-notifications (OS-level sound — works even if av fails)
  try {
    const granted = await ensureNotifPermission();
    if (granted && Notifications) {
      await ensureChannel();
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound:    'default',
          priority: 'max',
          data:     { ts: now },
          ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
        },
        trigger: null,
      });
      console.log('[Sound] Notification scheduled ✅');
    }
  } catch (e) {
    console.warn('[Sound] Notification error:', e);
  }
}

// ─── WEB: singleton AudioContext ──────────────────────────────────────────────
let _webCtx: any = null;

function getWebCtx(): any {
  if (typeof window === 'undefined') return null;
  const Cls = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Cls) return null;
  if (!_webCtx) { try { _webCtx = new Cls(); } catch { return null; } }
  return _webCtx;
}

export function unlockWebAudio(): void {
  const ctx = getWebCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function playWebBeep(vol = 1.0): void {
  const ctx = getWebCtx();
  if (!ctx) return;

  const go = () => {
    const v = Math.max(0.3, Math.min(1.0, vol));
    const t = ctx.currentTime;
    const beep = (freq: number, start: number, dur: number, amp: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(amp, start + 0.015);
      gain.gain.linearRampToValueAtTime(0, start + dur);
      osc.start(start);
      osc.stop(start + dur);
    };
    beep(880,  t,        0.20, v);
    beep(1100, t + 0.28, 0.20, v * 0.9);
    beep(1320, t + 0.56, 0.24, v);
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(go).catch(() => {});
  } else {
    go();
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
export async function playNotificationSound(
  volume = 1.0,
  title  = 'Yangi buyurtma! 🔔',
  body   = 'Sizga yangi buyurtma keldi'
): Promise<void> {
  if (Platform.OS === 'web') {
    playWebBeep(volume);
    return;
  }
  await playMobileSound(volume, title, body);
}

export async function stopNotificationSound(): Promise<void> {
  if (Platform.OS !== 'web') {
    try { Vibration.cancel(); } catch { /* ignore */ }
    if (_preloadedSound) {
      try { await _preloadedSound.stopAsync(); } catch { /* ignore */ }
    }
  }
}

/**
 * Call this from test button — also triggers preload if not done yet
 */
export async function testAndPreloadSound(volume = 1.0): Promise<void> {
  if (Platform.OS === 'web') {
    unlockWebAudio();
    playWebBeep(volume);
    return;
  }
  // Ensure preload is done
  if (!_initDone || !_preloadedSound) {
    await preloadSound();
    await ensureChannel();
    await ensureNotifPermission();
  }
  await playMobileSound(volume, 'Test! 🔔', 'Ovoz ishlayapdi ✅');
}
