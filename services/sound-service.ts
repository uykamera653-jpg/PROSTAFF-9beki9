import { Platform, Vibration } from 'react-native';
import { Audio } from 'expo-av';

// expo-notifications (mobile only)
let Notifications: any = null;
if (Platform.OS !== 'web') {
  try { Notifications = require('expo-notifications'); } catch { /* ignore */ }
}

// expo-file-system (mobile only)
let FileSystem: any = null;
if (Platform.OS !== 'web') {
  try { FileSystem = require('expo-file-system'); } catch { /* ignore */ }
}

const ANDROID_CHANNEL_ID = 'new-orders-v4';
let _sound: Audio.Sound | null = null;
let _isPlaying = false;
let _isPlayingTimeout: ReturnType<typeof setTimeout> | null = null;
let _cachedWavUri: string | null = null;

// ─── WEB: Web Audio API beep ──────────────────────────────────────────────────
// Singleton AudioContext — bir marta user gesture da unlock qilinadi, keyin reuse
let _webAudioCtx: any = null;

function getWebAudioContext(): any {
  if (typeof window === 'undefined') return null;
  const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) return null;
  if (!_webAudioCtx) {
    try { _webAudioCtx = new AudioCtxClass(); } catch { return null; }
  }
  return _webAudioCtx;
}

// Unlock AudioContext (call on user gesture)
export function unlockWebAudio(): void {
  const ctx = getWebAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => {
      console.log('[SoundService] AudioContext unlocked ✅');
    }).catch(() => {});
  }
}

function playWebBeep(volume = 1.0): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getWebAudioContext();
    if (!ctx) return;

    // Resume if suspended
    const playBeep = () => {
      const safeVol = Math.max(0.3, Math.min(1.0, volume));
      const now = ctx.currentTime;

      const makeBeep = (freq: number, startTime: number, dur: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.02);
        gain.gain.linearRampToValueAtTime(0, startTime + dur);
        osc.start(startTime);
        osc.stop(startTime + dur);
      };

      makeBeep(880, now, 0.25, safeVol);
      makeBeep(660, now + 0.3, 0.25, safeVol * 0.8);
      makeBeep(1100, now + 0.65, 0.3, safeVol);
      console.log('[SoundService] Web Audio beep played ✅');
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(playBeep).catch((e: any) => {
        console.warn('[SoundService] AudioContext resume failed (no gesture yet):', e);
      });
    } else {
      playBeep();
    }

  } catch (e) {
    console.warn('[SoundService] Web Audio failed:', e);
  }
}

// ─── WAV generator: kod ichida 880Hz beep ─────────────────────────────────────
function generateBeepWavBase64(): string {
  const sampleRate = 8000;
  const durationSec = 0.6;
  const frequency = 880;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples;
  const fileSize = 36 + dataSize;

  const buf = new Uint8Array(44 + numSamples);

  buf[0]=82; buf[1]=73; buf[2]=70; buf[3]=70;
  buf[4]=fileSize&255; buf[5]=(fileSize>>8)&255; buf[6]=(fileSize>>16)&255; buf[7]=(fileSize>>24)&255;
  buf[8]=87; buf[9]=65; buf[10]=86; buf[11]=69;
  buf[12]=102; buf[13]=109; buf[14]=116; buf[15]=32;
  buf[16]=16; buf[17]=0; buf[18]=0; buf[19]=0;
  buf[20]=1; buf[21]=0;
  buf[22]=1; buf[23]=0;
  buf[24]=64; buf[25]=31; buf[26]=0; buf[27]=0;
  buf[28]=64; buf[29]=31; buf[30]=0; buf[31]=0;
  buf[32]=1; buf[33]=0;
  buf[34]=8; buf[35]=0;
  buf[36]=100; buf[37]=97; buf[38]=116; buf[39]=97;
  buf[40]=dataSize&255; buf[41]=(dataSize>>8)&255; buf[42]=(dataSize>>16)&255; buf[43]=(dataSize>>24)&255;

  const fadeSamples = Math.floor(sampleRate * 0.05);
  for (let i = 0; i < numSamples; i++) {
    let amplitude = 110;
    if (i < fadeSamples) amplitude = Math.round(amplitude * (i / fadeSamples));
    else if (i > numSamples - fadeSamples) amplitude = Math.round(amplitude * ((numSamples - i) / fadeSamples));
    const sample = 128 + Math.round(amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate));
    buf[44 + i] = Math.max(0, Math.min(255, sample));
  }

  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < buf.length; i += chunkSize) {
    binary += String.fromCharCode(...buf.subarray(i, Math.min(i + chunkSize, buf.length)));
  }
  return btoa(binary);
}

// ─── Write WAV to temp file and cache URI ─────────────────────────────────────
async function getBeepUri(): Promise<string | null> {
  if (Platform.OS === 'web' || !FileSystem) return null;
  if (_cachedWavUri) return _cachedWavUri;
  try {
    const base64 = generateBeepWavBase64();
    const uri = FileSystem.cacheDirectory + 'notification_beep.wav';
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    _cachedWavUri = uri;
    console.log('[SoundService] WAV written to:', uri);
    return uri;
  } catch (e) {
    console.warn('[SoundService] WAV write failed:', e);
    return null;
  }
}

// ─── Android channel setup ─────────────────────────────────────────────────────
async function ensureAndroidChannel() {
  if (!Notifications || Platform.OS !== 'android') return;
  const oldChannels = ['new-orders', 'new-orders-v2', 'new-orders-v3'];
  for (const ch of oldChannels) {
    try { await Notifications.deleteNotificationChannelAsync(ch); } catch { /* ignore */ }
  }
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

if (Platform.OS === 'android' && Notifications) {
  ensureAndroidChannel().catch(() => {});
}

if (Platform.OS !== 'web') {
  getBeepUri().catch(() => {});
}

// ─── OS Notification ──────────────────────────────────────────────────────────
function resetPlayingState() {
  _isPlaying = false;
  if (_isPlayingTimeout) { clearTimeout(_isPlayingTimeout); _isPlayingTimeout = null; }
}

async function playViaLocalNotification(title: string, body: string): Promise<boolean> {
  if (!Notifications || Platform.OS === 'web') return false;
  try {
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

// ─── expo-av: play generated WAV (mobile only) ───────────────────────────────
async function playViaAv(volume: number): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (_isPlaying) resetPlayingState();
  try {
    _isPlaying = true;
    _isPlayingTimeout = setTimeout(() => { resetPlayingState(); }, 6000);

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    if (_sound) {
      try { await _sound.stopAsync(); await _sound.unloadAsync(); } catch { /* ignore */ }
      _sound = null;
    }

    const safeVol = Math.max(0.6, Math.min(1.0, volume));

    // 1. Try generated local WAV
    const localUri = await getBeepUri();
    if (localUri) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: localUri },
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
        console.log('[SoundService] Playing local WAV beep ✅');
        return true;
      } catch (e) {
        console.warn('[SoundService] local WAV failed, trying CDN:', e);
      }
    }

    // 2. CDN fallback
    const SOUND_URLS = [
      'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3',
      'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3',
    ];
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
        console.log('[SoundService] Playing CDN:', url);
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
export async function playNotificationSound(
  volume = 1.0,
  title = 'Yangi buyurtma!',
  body = 'Sizga yangi buyurtma keldi'
): Promise<void> {
  console.log('[SoundService] playNotificationSound called, platform:', Platform.OS);

  if (Platform.OS === 'web') {
    // Web: Web Audio API — hech narsa o'rnatish shart emas
    playWebBeep(volume);
    return;
  }

  // Mobile: Vibration + OS notification + expo-av
  try {
    Vibration.cancel();
    Vibration.vibrate([0, 500, 200, 500, 200, 800]);
  } catch { /* ignore */ }

  await Promise.allSettled([
    playViaLocalNotification(title, body),
    playViaAv(volume),
  ]);
}

export async function stopNotificationSound(): Promise<void> {
  resetPlayingState();
  if (Platform.OS !== 'web') {
    Vibration.cancel();
    if (_sound) {
      try { await _sound.stopAsync(); await _sound.unloadAsync(); } catch { /* ignore */ }
      _sound = null;
    }
  }
}
