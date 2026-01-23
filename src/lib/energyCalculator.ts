/**
 * Energy Calculator - Maps audio level to emoji icons for real-time feedback
 */

export interface EnergyLevel {
  icon: string;
  label: string;
  color: string;
}

/**
 * Get energy icon based on audio level (0-1 range)
 */
export const getEnergyIcon = (audioLevel: number): string => {
  const energy = audioLevel * 100;

  if (energy < 20) return '😴';
  if (energy < 40) return '😐';
  if (energy < 60) return '😊';
  if (energy < 80) return '🔥';
  return '⚡';
};

/**
 * Get detailed energy level info
 */
export const getEnergyLevel = (audioLevel: number): EnergyLevel => {
  const energy = audioLevel * 100;

  if (energy < 20) {
    return {
      icon: '😴',
      label: 'Too quiet',
      color: 'text-muted-foreground',
    };
  }

  if (energy < 40) {
    return {
      icon: '😐',
      label: 'Low energy',
      color: 'text-energy-yellow',
    };
  }

  if (energy < 60) {
    return {
      icon: '😊',
      label: 'Getting there',
      color: 'text-primary',
    };
  }

  if (energy < 80) {
    return {
      icon: '🔥',
      label: 'Good energy!',
      color: 'text-energy-green',
    };
  }

  return {
    icon: '⚡',
    label: 'Powerful!',
    color: 'text-energy-cyan',
  };
};

/**
 * Get glow class based on audio level
 */
export const getGlowClass = (audioLevel: number): string => {
  const energy = audioLevel * 100;

  if (energy < 25) return 'camera-glow-low';
  if (energy < 50) return 'camera-glow-medium';
  if (energy < 75) return 'camera-glow-high';
  return 'camera-glow-max';
};

/**
 * Smooth audio level with exponential moving average
 */
export const smoothAudioLevel = (
  currentLevel: number,
  previousLevel: number,
  smoothingFactor: number = 0.3
): number => {
  return smoothingFactor * currentLevel + (1 - smoothingFactor) * previousLevel;
};
