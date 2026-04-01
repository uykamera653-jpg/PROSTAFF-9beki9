/**
 * SoundService — buyurtma kelganda ovoz va vibratsiya
 *
 * Android APK: expo-notifications (MAX importance, bypassDnd) → har doim ishlaydi
 * Web:         Web Audio API singleton AudioContext → beep
 * iOS:         expo-notifications + Vibration
 */
import { Platform, Vibration } from 'react-native';

// ─── expo-notifications (mobile only) ────────────────────────────────────────
let Notifications: any = null;
if (Platform.OS !== 'web') {
  try { Notifications = require('expo-notifications'); } catch { /* ignore */ }
}

const CHANNEL_ID = 'prostaff-orders-v5';
let _channelReady = false;

async function ensureChannel() {
  if (_channelReady || !Notifications || Platform.OS !== 'android') return;
  try {
    // Remove old channels
    for (const id of ['new-orders', 'new-orders-v2', 'new-orders-v3', 'new-orders-v4']) {
      try { await Notifications.deleteNotificationChannelAsync(id); } catch { /* ignore */ }
    }
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Yangi buyurtmalar',
      description: 'Har bir yangi buyurtma uchun ovozli bildirishnoma',
      importance: Notifications.AndroidImportance?.MAX ?? 5,
      sound: 'default',
      vibrationPattern: [0, 400, 200, 400, 200, 600],
      enableLights: true,
      lightColor: '#FF6B35',
      enableVibrate: true,
      showBadge: true,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
    });
    _channelReady = true;
  } catch (e) {
    console.warn('[Sound] channel error:', e);
  }
}

// Set foreground handler once
if (Notifications && Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications?.AndroidNotificationPriority?.MAX ?? 5,
    }),
  });
  ensureChannel().catch(() => {});
}

// ─── WEB: singleton AudioContext beep ────────────────────────────────────────
let _webCtx: any = null;

function getCtx(): any {
  if (typeof window === 'undefined') return null;
  const Cls = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Cls) return null;
  if (!_webCtx) { try { _webCtx = new Cls(); } catch { return null; } }
  return _webCtx;
}

export function unlockWebAudio(): void {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function playWebBeep(vol = 1.0): void {
  if (typeof window === 'undefined') return;
  const ctx = getCtx();
  if (!ctx) return;

  const go = () => {
    const v = Math.max(0.3, Math.min(1.0, vol));
    const t = ctx.currentTime;
    const beep = (f: number, s: number, d: number, a: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(f, s);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(a, s + 0.02);
      g.gain.linearRampToValueAtTime(0, s + d);
      o.start(s); o.stop(s + d);
    };
    beep(880, t,        0.22, v);
    beep(660, t + 0.28, 0.22, v * 0.8);
    beep(1100, t + 0.6, 0.28, v);
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(go).catch(() => {});
  } else {
    go();
  }
}

// ─── Mobile: notification + vibration ────────────────────────────────────────
let _lastPlayTime = 0;
const MIN_INTERVAL_MS = 2000; // prevent duplicate sounds within 2s

async function playMobileSound(vol: number, title: string, body: string): Promise<void> {
  const now = Date.now();
  if (now - _lastPlayTime < MIN_INTERVAL_MS) return;
  _lastPlayTime = now;

  // 1. Vibration — always first, no permissions needed
  try {
    Vibration.cancel();
    Vibration.vibrate([0, 400, 200, 400, 200, 600]);
  } catch { /* ignore */ }

  // 2. OS notification — plays sound through system, works even in silent mode with bypassDnd
  if (!Notifications) return;
  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: 'max',
        data: { ts: now },
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[Sound] notification failed:', e);
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
export async function playNotificationSound(
  volume = 1.0,
  title = 'Yangi buyurtma! 🔔',
  body = 'Sizga yangi buyurtma keldi'
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
  }
}
