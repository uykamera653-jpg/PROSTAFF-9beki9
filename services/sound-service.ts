/**
 * SoundService v8 — Eng ishonchli yondashuv:
 * 1. Vibration (har doim ishlaydi)
 * 2. expo-av — har safar YANGI Sound ob'ekti (preload muammodan xoli)
 * 3. expo-notifications bypassDnd (ilova yopiq bo'lsa ham)
 *
 * Test vs Real farqi yo'q — ikkalasi ham bir xil kod ishlatadi.
 */
import { Platform, Vibration } from 'react-native';

// ─── Dynamic imports (mobile only) ───────────────────────────────────────────
let Audio: any = null;
let FileSystem: any = null;
let Notifications: any = null;

if (Platform.OS !== 'web') {
  try { Audio = require('expo-av').Audio; } catch (e) { console.warn('[Sound] expo-av missing'); }
  try { FileSystem = require('expo-file-system'); } catch (e) { console.warn('[Sound] expo-file-system missing'); }
  try { Notifications = require('expo-notifications'); } catch (e) { console.warn('[Sound] expo-notifications missing'); }
}

// ─── WAV Generator ───────────────────────────────────────────────────────────
function buildWavBytes(): Uint8Array {
  const sampleRate = 22050;
  const totalSec   = 1.0;
  const n          = Math.floor(sampleRate * totalSec);
  const dataBytes  = n * 2;
  const buf        = new ArrayBuffer(44 + dataBytes);
  const dv         = new DataView(buf);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF'); dv.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE'); writeStr(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);   // PCM
  dv.setUint16(22, 1, true);   // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  writeStr(36, 'data'); dv.setUint32(40, dataBytes, true);

  // 3-tone beep: 880 → 1100 → 1320 Hz
  const tones = [
    { f: 880,  s: 0.00, e: 0.22 },
    { f: 1100, s: 0.30, e: 0.52 },
    { f: 1320, s: 0.60, e: 0.85 },
  ];
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let v = 0;
    for (const tone of tones) {
      if (t >= tone.s && t < tone.e) {
        const local = t - tone.s;
        const len   = tone.e - tone.s;
        const env   = Math.min(local / 0.01, 1.0, (len - local) / 0.01);
        v = Math.sin(2 * Math.PI * tone.f * t) * env * 0.88;
        break;
      }
    }
    dv.setInt16(44 + i * 2, Math.round(v * 32767), true);
  }
  return new Uint8Array(buf);
}

function bytesToBase64(u8: Uint8Array): string {
  let s = '';
  const chunk = 8192;
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(s);
}

// ─── WAV file cache ───────────────────────────────────────────────────────────
let _wavPath: string | null = null;

async function getWavPath(): Promise<string | null> {
  if (!FileSystem) return null;

  // Check cache
  if (_wavPath) {
    try {
      const info = await FileSystem.getInfoAsync(_wavPath);
      if (info.exists) return _wavPath;
    } catch { /* fall through */ }
    _wavPath = null;
  }

  try {
    const dir  = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!dir) return null;
    const path = dir + 'prostaff_beep_v8.wav';
    const b64  = bytesToBase64(buildWavBytes());
    await FileSystem.writeAsStringAsync(path, b64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    _wavPath = path;
    console.log('[Sound] WAV written to:', path);
    return path;
  } catch (e) {
    console.warn('[Sound] WAV write error:', e);
    return null;
  }
}

// ─── Audio mode (set once) ────────────────────────────────────────────────────
let _audioModeOk = false;

async function ensureAudioMode(): Promise<void> {
  if (_audioModeOk || !Audio) return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:         false,
      staysActiveInBackground:    true,
      playsInSilentModeIOS:       true,
      shouldDuckAndroid:          false,
      playThroughEarpieceAndroid: false,
    });
    _audioModeOk = true;
    console.log('[Sound] AudioMode OK');
  } catch (e) {
    console.warn('[Sound] AudioMode err:', e);
  }
}

// ─── Notification channel ─────────────────────────────────────────────────────
const CH = 'prostaff-v8';
let _chReady = false;
let _permOk: boolean | null = null;

async function ensurePerm(): Promise<boolean> {
  if (_permOk !== null) return _permOk;
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    _permOk = status === 'granted';
    console.log('[Sound] Notif perm:', _permOk);
    return _permOk;
  } catch { return false; }
}

async function ensureChannel(): Promise<void> {
  if (_chReady || Platform.OS !== 'android' || !Notifications) return;
  try {
    // Remove old channels
    const oldChannels = [
      'new-orders','new-orders-v2','new-orders-v3','new-orders-v4',
      'prostaff-orders-v5','prostaff-orders-v6','prostaff-v7',
    ];
    for (const id of oldChannels) {
      try { await Notifications.deleteNotificationChannelAsync(id); } catch { /* ok */ }
    }
    await Notifications.setNotificationChannelAsync(CH, {
      name:             'Yangi buyurtmalar',
      importance:       Notifications.AndroidImportance?.MAX ?? 5,
      sound:            'default',
      vibrationPattern: [0, 500, 200, 500],
      enableVibrate:    true,
      enableLights:     true,
      lightColor:       '#FF6B35',
      bypassDnd:        true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
    });
    _chReady = true;
    console.log('[Sound] Channel v8 OK');
  } catch (e) {
    console.warn('[Sound] Channel err:', e);
  }
}

// Foreground notification handler — must be set before any notification fires
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
      await getWavPath(); // pre-write WAV file so it's ready
      console.log('[Sound] Startup init done ✅');
    } catch (e) {
      console.warn('[Sound] Startup init err:', e);
    }
  }, 800);
}

// ─── Core play function ───────────────────────────────────────────────────────
let _playing = false;

async function playOnMobile(vol: number, title: string, body: string): Promise<void> {
  // Don't skip even if _playing — just log
  if (_playing) {
    console.log('[Sound] Already playing, but continuing anyway...');
  }

  console.log('[Sound] === playOnMobile START ===');

  // 1. Vibration — 100% reliable, no permissions
  try {
    Vibration.cancel();
    Vibration.vibrate([0, 500, 150, 500, 150, 700]);
    console.log('[Sound] Vibration fired');
  } catch (e) {
    console.warn('[Sound] Vibration err:', e);
  }

  // 2. expo-av — create fresh Sound each time (most reliable approach)
  _playing = true;
  let avSuccess = false;
  try {
    await ensureAudioMode();
    const wavPath = await getWavPath();
    console.log('[Sound] WAV path:', wavPath);

    if (wavPath && Audio) {
      // Use file:// URI explicitly for Android
      const uri = Platform.OS === 'android' && !wavPath.startsWith('file://')
        ? 'file://' + wavPath
        : wavPath;

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        {
          shouldPlay:  true,
          volume:      Math.max(0.7, Math.min(1.0, vol)),
          isLooping:   false,
          isMuted:     false,
        }
      );

      console.log('[Sound] expo-av playAsync called ✅');
      avSuccess = true;

      // Auto-unload when done
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          _playing = false;
          console.log('[Sound] expo-av done, unloaded');
        }
        if (status.error) {
          console.warn('[Sound] Playback error:', status.error);
          _playing = false;
        }
      });

      // Safety timeout — release after 5s regardless
      setTimeout(() => {
        _playing = false;
        try { sound.unloadAsync(); } catch { /* ok */ }
      }, 5000);
    }
  } catch (e) {
    console.warn('[Sound] expo-av error:', e);
    _playing = false;
  }

  console.log('[Sound] expo-av success:', avSuccess);

  // 3. expo-notifications — OS-level sound (works even if app is background/closed)
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
          ...(Platform.OS === 'android' ? { channelId: CH } : {}),
        },
        trigger: null,
      });
      console.log('[Sound] Notification scheduled ✅');
    }
  } catch (e) {
    console.warn('[Sound] Notification err:', e);
  }

  console.log('[Sound] === playOnMobile END ===');
}

// ─── Web AudioContext ─────────────────────────────────────────────────────────
let _webAudioCtx: any = null;

function getWebCtx(): any {
  if (typeof window === 'undefined') return null;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!_webAudioCtx) {
    try { _webAudioCtx = new AC(); } catch { return null; }
  }
  return _webAudioCtx;
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
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(amp, start + 0.012);
      gain.gain.linearRampToValueAtTime(0, start + dur);
      osc.start(start);
      osc.stop(start + dur + 0.01);
    };
    tone(880,  t,        0.22);
    tone(1100, t + 0.30, 0.22);
    tone(1320, t + 0.60, 0.26);
  };
  if (ctx.state === 'suspended') {
    ctx.resume().then(play).catch(() => {});
  } else {
    play();
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export async function playNotificationSound(
  volume = 1.0,
  title  = 'Yangi buyurtma! 🔔',
  body   = 'Sizga yangi buyurtma keldi'
): Promise<void> {
  console.log('[Sound] playNotificationSound called, platform:', Platform.OS);
  if (Platform.OS === 'web') {
    webBeep(volume);
    return;
  }
  await playOnMobile(volume, title, body);
}

export async function stopNotificationSound(): Promise<void> {
  if (Platform.OS !== 'web') {
    try { Vibration.cancel(); } catch { /* ok */ }
    _playing = false;
  }
}

export async function testAndPreloadSound(volume = 1.0): Promise<void> {
  console.log('[Sound] testAndPreloadSound called');
  if (Platform.OS === 'web') {
    unlockWebAudio();
    webBeep(volume);
    return;
  }
  // Re-initialize if needed
  await Promise.all([ensureAudioMode(), ensureChannel(), ensurePerm()]);
  await getWavPath();
  await playOnMobile(volume, '🔔 Test ovozi', 'Ovoz ishlayapdi — buyurtma ovozi shunday chiqadi');
}
