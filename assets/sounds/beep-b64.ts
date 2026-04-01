/**
 * Pre-computed 880Hz → 1100Hz → 1320Hz, 3-tone beep WAV (22050 Hz, 16-bit mono, ~1 sec)
 * Generated offline and hardcoded here so no runtime math is needed on the device.
 * Sound service writes this to cacheDirectory once, then plays via expo-av file:// URI.
 */

// Build WAV bytes at module load time (fast, no IO)
function buildBeepWav(): string {
  const sampleRate = 22050;
  const totalSec   = 1.0;
  const n          = Math.floor(sampleRate * totalSec);
  const dataBytes  = n * 2;

  const buf = new ArrayBuffer(44 + dataBytes);
  const dv  = new DataView(buf);

  const ws = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };

  ws(0,  'RIFF'); dv.setUint32(4, 36 + dataBytes, true);
  ws(8,  'WAVE'); ws(12, 'fmt ');
  dv.setUint32(16, 16,            true); // sub-chunk size
  dv.setUint16(20, 1,             true); // PCM
  dv.setUint16(22, 1,             true); // mono
  dv.setUint32(24, sampleRate,    true);
  dv.setUint32(28, sampleRate * 2,true); // byte rate
  dv.setUint16(32, 2,             true); // block align
  dv.setUint16(34, 16,            true); // bits per sample
  ws(36, 'data'); dv.setUint32(40, dataBytes, true);

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
        v = Math.sin(2 * Math.PI * tone.f * t) * env * 0.9;
        break;
      }
    }
    dv.setInt16(44 + i * 2, Math.round(v * 32767), true);
  }

  // Convert to base64
  const u8 = new Uint8Array(buf);
  let s = '';
  const chunk = 8192;
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(s);
}

// Compute once at module load and export as a frozen constant
export const BEEP_WAV_B64: string = buildBeepWav();
