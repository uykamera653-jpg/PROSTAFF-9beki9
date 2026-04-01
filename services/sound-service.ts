import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// Multiple fallback URLs for reliability
const SOUND_URLS = [
  'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  'https://assets.mixkit.co/active_storage/sfx/2309/2309-preview.mp3',
  'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3',
];

let _sound: Audio.Sound | null = null;
let _isPlaying = false;

/**
 * Play in-app notification sound using expo-av.
 * Tries multiple CDN URLs as fallback.
 */
export async function playNotificationSound(volume = 1.0): Promise<void> {
  if (_isPlaying) return; // Prevent overlapping sounds

  try {
    _isPlaying = true;

    // Configure audio session for Android and iOS
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    // Unload previous sound
    if (_sound) {
      try {
        await _sound.stopAsync();
        await _sound.unloadAsync();
      } catch {
        // ignore
      }
      _sound = null;
    }

    // Try each URL until one works
    let loaded = false;
    for (const url of SOUND_URLS) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          {
            shouldPlay: true,
            volume: Math.max(0, Math.min(1, volume)),
            isLooping: false,
          },
          (status) => {
            if (status.isLoaded && status.didJustFinish) {
              sound.unloadAsync().catch(() => {});
              _sound = null;
              _isPlaying = false;
            }
          }
        );
        _sound = sound;
        loaded = true;
        break; // Success — stop trying other URLs
      } catch (urlErr) {
        console.log(`[SoundService] URL failed (${url}):`, urlErr);
        // Try next URL
      }
    }

    if (!loaded) {
      console.warn('[SoundService] All sound URLs failed');
      _isPlaying = false;
    }

    // Safety reset after 10 seconds
    setTimeout(() => {
      _isPlaying = false;
    }, 10000);

  } catch (e) {
    console.log('[SoundService] playNotificationSound failed:', e);
    _isPlaying = false;
  }
}

/**
 * Stop and unload any active sound.
 */
export async function stopNotificationSound(): Promise<void> {
  _isPlaying = false;
  if (_sound) {
    try {
      await _sound.stopAsync();
      await _sound.unloadAsync();
    } catch {
      // ignore
    }
    _sound = null;
  }
}
