/**
 * Metric Settings Configuration
 * Allows users to enable/disable metrics and adjust their weights
 */

export interface MetricConfig {
  enabled: boolean;
  weight: number;
}

export interface MetricSettings {
  volume: MetricConfig;
  speechRate: MetricConfig;
  acceleration: MetricConfig;
  responseTime: MetricConfig;
  pauses: MetricConfig;
}

export const DEFAULT_METRIC_SETTINGS: MetricSettings = {
  volume: { enabled: true, weight: 40 },
  speechRate: { enabled: true, weight: 40 },
  acceleration: { enabled: true, weight: 5 },
  responseTime: { enabled: true, weight: 5 },
  pauses: { enabled: true, weight: 10 },
};

const STORAGE_KEY = 'audio_metric_settings';

/**
 * Load metric settings from localStorage
 */
export function loadMetricSettings(): MetricSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate that all required metrics exist
      if (
        parsed.volume &&
        parsed.speechRate &&
        parsed.acceleration &&
        parsed.responseTime &&
        parsed.pauses
      ) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load metric settings:', error);
  }
  return DEFAULT_METRIC_SETTINGS;
}

/**
 * Save metric settings to localStorage
 */
export function saveMetricSettings(settings: MetricSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save metric settings:', error);
  }
}

/**
 * Rebalance weights to ensure they sum to 100%
 * Only rebalances enabled metrics
 */
export function rebalanceWeights(settings: MetricSettings): MetricSettings {
  const enabledMetrics = Object.entries(settings).filter(
    ([_, config]) => config.enabled
  );

  if (enabledMetrics.length === 0) {
    // If no metrics enabled, enable all with default weights
    return DEFAULT_METRIC_SETTINGS;
  }

  const totalWeight = enabledMetrics.reduce(
    (sum, [_, config]) => sum + config.weight,
    0
  );

  if (totalWeight === 100) {
    return settings; // Already balanced
  }

  // Proportionally adjust weights to sum to 100
  const rebalanced = { ...settings };
  enabledMetrics.forEach(([key]) => {
    const metricKey = key as keyof MetricSettings;
    const currentWeight = settings[metricKey].weight;
    rebalanced[metricKey] = {
      ...settings[metricKey],
      weight: Math.round((currentWeight / totalWeight) * 100),
    };
  });

  // Handle rounding errors - ensure total is exactly 100
  const newTotal = Object.entries(rebalanced)
    .filter(([_, config]) => config.enabled)
    .reduce((sum, [_, config]) => sum + config.weight, 0);

  if (newTotal !== 100 && enabledMetrics.length > 0) {
    // Add difference to first enabled metric
    const firstEnabled = enabledMetrics[0][0] as keyof MetricSettings;
    rebalanced[firstEnabled].weight += 100 - newTotal;
  }

  return rebalanced;
}

/**
 * Get normalized weights for calculation
 * Returns weights as decimals (0-1) that sum to 1
 */
export function getNormalizedWeights(settings: MetricSettings): {
  volume: number;
  speechRate: number;
  acceleration: number;
  responseTime: number;
  pauses: number;
} {
  const balanced = rebalanceWeights(settings);
  return {
    volume: balanced.volume.enabled ? balanced.volume.weight / 100 : 0,
    speechRate: balanced.speechRate.enabled ? balanced.speechRate.weight / 100 : 0,
    acceleration: balanced.acceleration.enabled ? balanced.acceleration.weight / 100 : 0,
    responseTime: balanced.responseTime.enabled ? balanced.responseTime.weight / 100 : 0,
    pauses: balanced.pauses.enabled ? balanced.pauses.weight / 100 : 0,
  };
}

/**
 * Metric display names for UI
 */
export const METRIC_LABELS: Record<keyof MetricSettings, string> = {
  volume: 'Volume',
  speechRate: 'Speech Rate',
  acceleration: 'Acceleration',
  responseTime: 'Response Time',
  pauses: 'Pause Management',
};

/**
 * Metric descriptions for UI
 */
export const METRIC_DESCRIPTIONS: Record<keyof MetricSettings, string> = {
  volume: 'Measures speaking volume and energy level',
  speechRate: 'Analyzes speech clarity and syllable rate',
  acceleration: 'Detects sudden changes in speaking speed',
  responseTime: 'Measures how quickly you start speaking',
  pauses: 'Evaluates natural pausing and silence ratio',
};
