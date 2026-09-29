/**
 * Helper to calculate Root Mean Square (RMS) from a Float32Array of audio samples.
 * Used for volume meters, VAD, and speech activity detection.
 */
export function calculateRMS(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Checks if the browser supports AudioContext and MediaDevices.
 */
export function isVoiceSupported(): boolean {
  return typeof window !== 'undefined' &&
    !!(window.navigator?.mediaDevices?.getUserMedia);
}
