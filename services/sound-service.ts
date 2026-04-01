/**
 * SoundService — buyurtma kelganda ovoz va vibratsiya
 *
 * Android APK (foreground): expo-av → runtime WAV generator → to'g'ridan-to'g'ri audio
 * Android APK (background): expo-notifications (bypassDnd, MAX importance)
 * Web:                      Web Audio API singleton AudioContext
 * iOS:                      expo-av + expo-notifications
 *
 * Test tugmasi bosib AudioContext unlock qilish kerak (web uchun)
 */
import { Platform, Vibration, AppState } from 'react-native';

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

const CHANNEL_ID = 'prostaff-orders-v6';
let _channelReady = false;
let _permGranted: boolean | null = null;

// ─── WAV generator (pure JS, no deps) ────────────────────────────────────────
function generateBeepWav(): Uint8Array {
  const sampleRate = 22050;
  const duration   = 0.8; // seconds — 3 beeps
  const numSamples = Math.floor(sampleRate * duration);
  const bitsPerSample = 16;
  const blockAlign  = bitsPerSample / 8;
  const byteRate    = sampleRate * blockAlign;
  const dataSize    = numSamples * blockAlign;
  const buf         = new ArrayBuffer(44 + dataSize);
  const view        = new DataView(buf);

  const ws = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  ws(0, 'RIFF');
  view.setUint32(4,  36 + dataSize, true);
  ws(8, 'WAVE');
  ws(12, 'fmt ');
  view.setUint32(16, 16,          true);
  view.setUint16(20, 1,           true); // PCM
  view.setUint16(22, 1,           true); // mono
  view.setUint32(24, sampleRate,  true);
  view.setUint32(28, byteRate,    true);
  view.setUint16(32, blockAlign,  true);
  view.setUint16(34, bitsPerSample, true);
  ws(36, 'data');
  view.setUint32(40, dataSize,    true);

  // 3 short beeps: 800 Hz, 1000 Hz, 1200 Hz
  const beeps = [
    { freq: 800,  start: 0.00, end: 0.18 },
    { freq: 1000, start: 0.26, end: 0.44 },
    { freq: 1200, start: 0.52, end: 0.74 },
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    for (const b of beeps) {
      if (t >= b.start && t < b.end) {
        // Fade in/out envelope
        const local = t - b.start;
        const len   = b.end - b.start;
        const env   = Math.min(local / 0.02, 1, (len - local) / 0.02);
        sample = Math.sin(2 * Math.PI * b.freq * t) * env * 0.85;
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
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// Cache the generated WAV file path
let _wavFilePath: string | null = null;

async function getWavFilePath(): Promise<string | null> {
  if (!FileSystem) return null;
  if (_wavFilePath) {
    // Verify file still exists
    try {
      const info = await FileSystem.getInfoAsync(_wavFilePath);
      if (info.exists) return _wavFilePath;
    } catch { /* regenerate */ }
  }

  try {
    const wav     = generateBeepWav();
    const b64     = uint8ToBase64(wav);
    const path    = `${FileSystem.documentDirectory}prostaff_beep_v2.wav`;
    await FileSystem.writeAsStringAsync(path, b64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    _wavFilePath = path;
    return path;
  } catch (e) {
    console.warn('[Sound] WAV write failed:', e);
    return null;
  }
}

// ─── expo-av player ──────────────────────────────────────────────────────────
let _sound: any = null;

async function playViaAv(vol: number): Promise<boolean> {
  if (!Audio) return false;
  try {
    // Configure audio session
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:         false,
      staysActiveInBackground:    true,
      playsInSilentModeIOS:       true,          // iOS: play even in silent mode
      shouldDuckAndroid:          false,
      playThroughEarpieceAndroid: false,
    });

    // Unload previous sound
    if (_sound) {
      try { await _sound.unloadAsync(); } catch { /* ignore */ }
      _sound = null;
    }

    const filePath = await getWavFilePath();
    if (!filePath) return false;

    const { sound } = await Audio.Sound.createAsync(
      { uri: filePath },
      { shouldPlay: false, volume: Math.max(0.5, Math.min(1.0, vol)) }
    );
    _sound = sound;
    await sound.playAsync();

    // Auto-unload after playback
    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        _sound = null;
      }
    });
    return true;
  } catch (e) {
    console.warn('[Sound] expo-av failed:', e);
    return false;
  }
}

// ─── Notification channel ────────────────────────────────────────────────────
async function ensureNotifPermission(): Promise<boolean> {
  if (_permGranted !== null) return _permGranted;
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    _permGranted = status === 'granted';
    return _permGranted;
  } catch {
    return false;
  }
}

async function ensureChannel(): Promise<void> {
  if (_channelReady || !Notifications || Platform.OS !== 'android') return;
  try {
    // Delete all old channels
    for (const id of [
      'new-orders', 'new-orders-v2', 'new-orders-v3',
      'new-orders-v4', 'prostaff-orders-v5',
    ]) {
      try { await Notifications.deleteNotificationChannelAsync(id); } catch { /* ignore */ }
    }

    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name:              'Yangi buyurtmalar',
      description:       'Har bir yangi buyurtma uchun ovozli bildirishnoma',
      importance:        Notifications.AndroidImportance?.MAX ?? 5,
      sound:             'default',
      vibrationPattern:  [0, 300, 150, 300, 150, 500],
      enableLights:      true,
      lightColor:        '#FF6B35',
      enableVibrate:     true,
      showBadge:         true,
      bypassDnd:         true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
    });
    _channelReady = true;
  } catch (e) {
    console.warn('[Sound] channel setup error:', e);
  }
}

// Foreground handler — show alert + sound when app is open
if (Notifications && Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert:  true,
      shouldPlaySound:  true,
      shouldSetBadge:   false,
      shouldShowBanner: true,
      shouldShowList:   true,
      priority: Notifications?.AndroidNotificationPriority?.MAX ?? 5,
    }),
  });
  // Pre-warm: setup channel + request permission at startup
  Promise.all([ensureChannel(), ensureNotifPermission()]).catch(() => {});
  // Pre-generate WAV file
  getWavFilePath().catch(() => {});
}

// ─── Rate limit ───────────────────────────────────────────────────────────────
let _lastPlayTime = 0;
const MIN_INTERVAL_MS = 1500;

// ─── WEB: singleton AudioContext ─────────────────────────────────────────────
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
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(amp, start + 0.02);
      gain.gain.linearRampToValueAtTime(0, start + dur);
      osc.start(start);
      osc.stop(start + dur);
    };
    beep(800,  t,        0.18, v);
    beep(1000, t + 0.26, 0.18, v * 0.9);
    beep(1200, t + 0.52, 0.22, v);
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(go).catch(() => {});
  } else {
    go();
  }
}

// ─── Mobile main function ────────────────────────────────────────────────────
async function playMobileSound(vol: number, title: string, body: string): Promise<void> {
  const now = Date.now();
  if (now - _lastPlayTime < MIN_INTERVAL_MS) return;
  _lastPlayTime = now;

  // 1. Vibration — always, no permissions needed
  try {
    Vibration.cancel();
    Vibration.vibrate([0, 300, 150, 300, 150, 500]);
  } catch { /* ignore */ }

  // 2. expo-av (direct audio, works when app is in foreground)
  const avOk = await playViaAv(vol);
  console.log('[Sound] expo-av result:', avOk);

  // 3. expo-notifications (background / as additional sound layer)
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
    }
  } catch (e) {
    console.warn('[Sound] notification failed:', e);
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
    if (_sound) {
      try { await _sound.stopAsync(); } catch { /* ignore */ }
    }
  }
}
