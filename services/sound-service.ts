import { Audio } from 'expo-av';

// Notification sound URL (CDN-hosted, reliable)
const NOTIFICATION_SOUND_URL =
  'https://cdn.freesound.org/previews/521/521975_1648170-lq.mp3';

let _sound: Audio.Sound | null = null;

/**
 * Play in-app notification sound using expo-av.
 * Automatically unloads the previous sound before playing a new one.
 */
export async function playNotificationSound(volume = 1.0): Promise<void> {
  try {
    // Set audio mode: play even in silent mode (iOS)
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    // Unload previous sound if any
    if (_sound) {
      try {
        await _sound.unloadAsync();
      } catch {
        // ignore
      }
      _sound = null;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: NOTIFICATION_SOUND_URL },
      { shouldPlay: true, volume: Math.max(0, Math.min(1, volume)) }
    );

    _sound = sound;

    // Auto-unload after playback finishes
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        _sound = null;
      }
    });
  } catch (e) {
    // Silent fail — never crash the app for a sound
    console.log('[SoundService] playNotificationSound failed:', e);
  }
}

/**
 * Unload any active sound immediately.
 */
export async function stopNotificationSound(): Promise<void> {
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
