// Audio Analysis Metrics for Voice Energy App
// NOTE: This file contains the CORE ANALYSIS LOGIC that must NOT be changed

// Types for speech rate method
export type SpeechRateMethod = "energy-peaks" | "deepgram-stt" | "zero-crossing-rate";

// Config interface matching admin settings
export interface MetricConfig {
  id: string;
  weight: number;
  thresholds: {
    min: number;
    ideal: number;
    max: number;
  };
  method?: SpeechRateMethod;
}

// Load config from localStorage or use defaults
function getConfig(): MetricConfig[] {
  try {
    const saved = localStorage.getItem("metricConfig");
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn("Failed to load metric config:", e);
  }

  // Default config (matches AdminSettings defaults)
  return [
    { id: "volume", weight: 40, thresholds: { min: -35, ideal: -15, max: 0 } },
    { id: "speechRate", weight: 40, thresholds: { min: 90, ideal: 150, max: 220 }, method: "energy-peaks" },
    { id: "acceleration", weight: 5, thresholds: { min: 0, ideal: 50, max: 100 } },
    { id: "responseTime", weight: 5, thresholds: { min: 2000, ideal: 200, max: 0 } },
    { id: "pauseManagement", weight: 10, thresholds: { min: 0, ideal: 0, max: 2.71 } },
  ];
}

function getMetricConfig(id: string): MetricConfig | undefined {
  return getConfig().find((m) => m.id === id);
}

function getSpeechRateMethod(): SpeechRateMethod {
  const config = getMetricConfig("speechRate");
  return config?.method || "energy-peaks";
}

export interface VolumeResult {
  averageDb: number;
  score: number;
  tag: "ENERGY";
}

export interface SpeechRateResult {
  wordsPerMinute: number;
  score: number;
  tag: "FLUENCY";
  method: SpeechRateMethod;
}

export interface AccelerationResult {
  isAccelerating: boolean;
  segment1Volume: number;
  segment2Volume: number;
  segment1Rate: number;
  segment2Rate: number;
  score: number;
  tag: "DYNAMICS";
}

export interface ResponseTimeResult {
  responseTimeMs: number;
  score: number;
  tag: "READINESS";
}

export interface PauseResult {
  pauseRatio: number;
  score: number;
  tag: "FLUIDITY";
}

export interface AnalysisResult {
  overallScore: number;
  emotionalFeedback: "excellent" | "good" | "poor";
  volume: VolumeResult;
  speechRate: SpeechRateResult;
  acceleration: AccelerationResult;
  responseTime: ResponseTimeResult;
  pauses: PauseResult;
}

// ============ ANALYSIS FUNCTIONS (DO NOT MODIFY) ============

function analyzeVolume(audioBuffer: Float32Array): VolumeResult {
  const config = getMetricConfig("volume") || { thresholds: { min: -35, ideal: -15, max: 0 } };
  const { min, ideal, max } = config.thresholds;

  // Calculate RMS
  let sum = 0;
  for (let i = 0; i < audioBuffer.length; i++) {
    sum += audioBuffer[i] * audioBuffer[i];
  }
  const rms = Math.sqrt(sum / audioBuffer.length);

  // Convert to dB
  const db = 20 * Math.log10(Math.max(rms, 1e-10));

  // Score calculation
  let score = 0;
  if (db >= ideal) {
    score = 100 - ((db - ideal) / (max - ideal)) * 30;
  } else if (db >= min) {
    score = 70 + ((db - min) / (ideal - min)) * 30;
  } else {
    score = Math.max(0, 70 * (1 - (min - db) / 20));
  }

  return {
    averageDb: Math.round(db * 10) / 10,
    score: Math.min(100, Math.max(0, Math.round(score))),
    tag: "ENERGY",
  };
}

function detectSyllablesFromPeaks(audioBuffer: Float32Array, sampleRate: number): number {
  // Energy-based peak detection for syllable counting
  const frameSize = Math.floor(sampleRate * 0.02); // 20ms frames
  const hopSize = Math.floor(frameSize / 2);

  const energies: number[] = [];

  for (let i = 0; i < audioBuffer.length - frameSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      energy += audioBuffer[i + j] * audioBuffer[i + j];
    }
    energies.push(energy / frameSize);
  }

  // Find peaks (local maxima above threshold)
  const threshold = Math.max(...energies) * 0.15;
  let peaks = 0;
  let lastPeakIdx = -10;

  for (let i = 1; i < energies.length - 1; i++) {
    if (
      energies[i] > threshold &&
      energies[i] > energies[i - 1] &&
      energies[i] > energies[i + 1] &&
      i - lastPeakIdx > 3
    ) {
      peaks++;
      lastPeakIdx = i;
    }
  }

  return peaks;
}

function analyzeSpeechRate(audioBuffer: Float32Array, sampleRate: number): SpeechRateResult {
  const config = getMetricConfig("speechRate") || { thresholds: { min: 90, ideal: 150, max: 220 } };
  const { min, ideal, max } = config.thresholds;
  const method = getSpeechRateMethod();

  const durationSeconds = audioBuffer.length / sampleRate;

  // Use energy peaks method for syllable detection
  const syllables = detectSyllablesFromPeaks(audioBuffer, sampleRate);

  // Estimate WPM (assume ~1.5 syllables per word on average)
  const words = syllables / 1.5;
  const wpm = Math.round((words / durationSeconds) * 60);

  // Score calculation
  let score = 0;
  if (wpm >= min && wpm <= max) {
    if (wpm <= ideal) {
      score = 70 + ((wpm - min) / (ideal - min)) * 30;
    } else {
      score = 100 - ((wpm - ideal) / (max - ideal)) * 30;
    }
  } else if (wpm < min) {
    score = Math.max(0, 70 * (wpm / min));
  } else {
    score = Math.max(0, 70 * (1 - (wpm - max) / 50));
  }

  return {
    wordsPerMinute: wpm,
    score: Math.min(100, Math.max(0, Math.round(score))),
    tag: "FLUENCY",
    method,
  };
}

function analyzeAcceleration(audioBuffer: Float32Array, sampleRate: number): AccelerationResult {
  const config = getMetricConfig("acceleration") || { thresholds: { min: 0, ideal: 50, max: 100 } };

  const midpoint = Math.floor(audioBuffer.length / 2);
  const segment1 = audioBuffer.slice(0, midpoint);
  const segment2 = audioBuffer.slice(midpoint);

  // Analyze each segment
  const vol1 = analyzeVolume(segment1);
  const vol2 = analyzeVolume(segment2);

  const rate1 = analyzeSpeechRate(segment1, sampleRate);
  const rate2 = analyzeSpeechRate(segment2, sampleRate);

  // Check if accelerating (volume or rate increasing)
  const volumeIncrease = vol2.averageDb - vol1.averageDb;
  const rateIncrease = rate2.wordsPerMinute - rate1.wordsPerMinute;

  const isAccelerating = volumeIncrease > 0 || rateIncrease > 5;

  // Score based on positive acceleration
  const accelerationFactor = Math.max(0, volumeIncrease * 2 + rateIncrease * 0.5);
  const score = Math.min(100, Math.max(0, Math.round(50 + accelerationFactor)));

  return {
    isAccelerating,
    segment1Volume: Math.round(vol1.averageDb * 10) / 10,
    segment2Volume: Math.round(vol2.averageDb * 10) / 10,
    segment1Rate: rate1.wordsPerMinute,
    segment2Rate: rate2.wordsPerMinute,
    score,
    tag: "DYNAMICS",
  };
}

function analyzeResponseTime(audioBuffer: Float32Array, sampleRate: number): ResponseTimeResult {
  const config = getMetricConfig("responseTime") || { thresholds: { min: 2000, ideal: 200, max: 0 } };
  const { min: maxMs, ideal: idealMs } = config.thresholds;

  // Find first significant audio (above noise floor)
  const noiseFloor = 0.01;
  let firstSoundSample = 0;

  for (let i = 0; i < audioBuffer.length; i++) {
    if (Math.abs(audioBuffer[i]) > noiseFloor) {
      firstSoundSample = i;
      break;
    }
  }

  const responseTimeMs = Math.round((firstSoundSample / sampleRate) * 1000);

  // Score calculation (faster is better)
  let score = 0;
  if (responseTimeMs <= idealMs) {
    score = 100;
  } else if (responseTimeMs <= maxMs) {
    score = 100 - ((responseTimeMs - idealMs) / (maxMs - idealMs)) * 50;
  } else {
    score = Math.max(0, 50 * (1 - (responseTimeMs - maxMs) / 3000));
  }

  return {
    responseTimeMs,
    score: Math.min(100, Math.max(0, Math.round(score))),
    tag: "READINESS",
  };
}

function analyzePauses(audioBuffer: Float32Array, sampleRate: number): PauseResult {
  const config = getMetricConfig("pauseManagement") || { thresholds: { min: 0, ideal: 0, max: 2.71 } };
  const maxRatio = config.thresholds.max;

  const frameSize = Math.floor(sampleRate * 0.05); // 50ms frames
  const silenceThreshold = 0.01;

  let silentFrames = 0;
  let totalFrames = 0;

  for (let i = 0; i < audioBuffer.length - frameSize; i += frameSize) {
    let frameEnergy = 0;
    for (let j = 0; j < frameSize; j++) {
      frameEnergy += Math.abs(audioBuffer[i + j]);
    }
    frameEnergy /= frameSize;

    if (frameEnergy < silenceThreshold) {
      silentFrames++;
    }
    totalFrames++;
  }

  const pauseRatio = silentFrames / Math.max(1, totalFrames);

  // Score: less pause is better (up to a point)
  let score = 100;
  if (pauseRatio > 0.1) {
    score = Math.max(0, 100 - ((pauseRatio - 0.1) / maxRatio) * 100);
  }

  return {
    pauseRatio: Math.round(pauseRatio * 100) / 100,
    score: Math.min(100, Math.max(0, Math.round(score))),
    tag: "FLUIDITY",
  };
}

function calculateOverallScore(results: {
  volume: VolumeResult;
  speechRate: SpeechRateResult;
  acceleration: AccelerationResult;
  responseTime: ResponseTimeResult;
  pauses: PauseResult;
}): number {
  const config = getConfig();

  const weights = {
    volume: config.find((c) => c.id === "volume")?.weight || 40,
    speechRate: config.find((c) => c.id === "speechRate")?.weight || 40,
    acceleration: config.find((c) => c.id === "acceleration")?.weight || 5,
    responseTime: config.find((c) => c.id === "responseTime")?.weight || 5,
    pauseManagement: config.find((c) => c.id === "pauseManagement")?.weight || 10,
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const weightedSum =
    results.volume.score * weights.volume +
    results.speechRate.score * weights.speechRate +
    results.acceleration.score * weights.acceleration +
    results.responseTime.score * weights.responseTime +
    results.pauses.score * weights.pauseManagement;

  return Math.round(weightedSum / totalWeight);
}

function getEmotionalFeedback(score: number): "excellent" | "good" | "poor" {
  if (score >= 70) return "excellent";
  if (score >= 40) return "good";
  return "poor";
}

// ============ MAIN EXPORT ============

export async function analyzeAudioAsync(
  audioBuffer: Float32Array,
  sampleRate: number,
  _audioBase64?: string
): Promise<AnalysisResult> {
  // Perform all analyses
  const volume = analyzeVolume(audioBuffer);
  const speechRate = analyzeSpeechRate(audioBuffer, sampleRate);
  const acceleration = analyzeAcceleration(audioBuffer, sampleRate);
  const responseTime = analyzeResponseTime(audioBuffer, sampleRate);
  const pauses = analyzePauses(audioBuffer, sampleRate);

  const overallScore = calculateOverallScore({
    volume,
    speechRate,
    acceleration,
    responseTime,
    pauses,
  });

  return {
    overallScore,
    emotionalFeedback: getEmotionalFeedback(overallScore),
    volume,
    speechRate,
    acceleration,
    responseTime,
    pauses,
  };
}
