import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// Ishonchli CDN URL lar — birinchisi ishlamasa keyingisi urinadi
const SOUND_URLS = [
  'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  'https://assets.mixkit.co/active_storage/sfx/2309/2309-preview.mp3',
  'https://assets.mixkit.co/active_storage/sfx/1820/1820-preview.mp3',
  'https://assets.mixkit.co/active_storage/sfx/2462/2462-preview.mp3',
];

let _sound: Audio.Sound | null = null;
let _isPlaying = false;

/**
 * In-app bildirishnoma ovozini chaladi (expo-av).
 * MODIFY_AUDIO_SETTINGS ruxsati app.json da bo'lishi shart.
 */
export async function playNotificationSound(volume = 1.0): Promise<void> {
  if (_isPlaying) return;

  try {
    _isPlaying = true;

    // Audio session sozlash — bu MODIFY_AUDIO_SETTINGS talab qiladi Android da
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,       // iOS silent modeda ham chaladi
      staysActiveInBackground: false,
      shouldDuckAndroid: false,          // boshqa ovozlarni pasaytirmaydi
      playThroughEarpieceAndroid: false, // karnaydan chiqadi
    });

    // Oldingi soundni tozalash
    if (_sound) {
      try {
        await _sound.stopAsync();
        await _sound.unloadAsync();
      } catch { /* ignore */ }
      _sound = null;
    }

    const safeVolume = Math.max(0.1, Math.min(1.0, volume));
    let loaded = false;

    for (const url of SOUND_URLS) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          {
            shouldPlay: true,
            volume: safeVolume,
            isLooping: false,
            progressUpdateIntervalMillis: 500,
          },
          (status) => {
            if (status.isLoaded && status.didJustFinish) {
              sound.unloadAsync().catch(() => {});
              if (_sound === sound) _sound = null;
              _isPlaying = false;
            }
          }
        );
        _sound = sound;
        loaded = true;
        break;
      } catch (urlErr) {
        // Keyingi URL ga o'tadi
        continue;
      }
    }

    if (!loaded) {
      _isPlaying = false;
    }

    // 12 soniyadan so'ng majburiy reset (qo'shimcha xavfsizlik)
    setTimeout(() => {
      _isPlaying = false;
    }, 12000);

  } catch (e) {
    _isPlaying = false;
  }
}

/**
 * Aktiv ovozni to'xtatadi va xotiradan bo'shatadi.
 */
export async function stopNotificationSound(): Promise<void> {
  _isPlaying = false;
  if (_sound) {
    try {
      await _sound.stopAsync();
      await _sound.unloadAsync();
    } catch { /* ignore */ }
    _sound = null;
  }
}
