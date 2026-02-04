import { useCallback, useRef } from 'react';

// Create audio context lazily to avoid autoplay restrictions
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Generate a cheerful "success" chime using Web Audio API
const playChime = (frequency: number, duration: number, delay: number, volume: number = 0.3) => {
  const ctx = getAudioContext();
  const now = ctx.currentTime + delay;
  
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, now);
  
  // Quick attack, gentle decay
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
  
  oscillator.start(now);
  oscillator.stop(now + duration);
};

export function useCelebrationSound() {
  const hasPlayed = useRef(false);

  const playSuccessSound = useCallback(() => {
    if (hasPlayed.current) return;
    hasPlayed.current = true;
    
    try {
      // Resume audio context if suspended
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      // Play a cheerful ascending arpeggio
      // C5 - E5 - G5 - C6 pattern
      playChime(523.25, 0.25, 0, 0.25);      // C5
      playChime(659.25, 0.25, 0.1, 0.25);    // E5  
      playChime(783.99, 0.25, 0.2, 0.25);    // G5
      playChime(1046.50, 0.4, 0.3, 0.3);     // C6 (longer, slightly louder)
      
      // Final sparkle
      playChime(1318.51, 0.3, 0.5, 0.15);    // E6 (softer sparkle)
    } catch (error) {
      console.log('Audio playback not available:', error);
    }
  }, []);

  const reset = useCallback(() => {
    hasPlayed.current = false;
  }, []);

  return { playSuccessSound, reset };
}
