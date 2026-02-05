// Audio Analysis Metrics for Voice Energy App
// NOTE: This file contains the CORE ANALYSIS LOGIC that must NOT be changed

import { calibrateAndNormalize, calculateNoiseFloor } from './lufsNormalization';

// VAD Metrics interface (from useEnhancedAudioRecorder)
export interface SpeechSegment {
  start: number;  // ms from recording start
  end: number;
  duration: number;
}

export interface VADMetrics {
  speechSegments: SpeechSegment[];
  totalSpeechTime: number;      // ms of actual speech
  totalSilenceTime: number;     // ms of silence
  speechRatio: number;          // 0-1, speech / total
  isSpeaking: boolean;
  speechProbability: number;
}

// Types for speech rate method
export type SpeechRateMethod = "energy-peaks" | "vad-enhanced" | "deepgram-stt" | "zero-crossing-rate";

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
  normalization?: {
    originalLUFS: number;
    calibratedLUFS: number;
    finalLUFS: number;
    deviceGain: number;
    normalizationGain: number;
  };
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

/**
 * VAD-enhanced syllable detection - only counts peaks within speech segments
 * More accurate than basic energy peaks because it ignores noise/silence
 */
function detectSyllablesWithVAD(
  audioBuffer: Float32Array,
  sampleRate: number,
  vadMetrics: VADMetrics
): number {
  if (!vadMetrics.speechSegments || vadMetrics.speechSegments.length === 0) {
    // Fallback to basic method if no VAD data
    return detectSyllablesFromPeaks(audioBuffer, sampleRate);
  }

  const frameSize = Math.floor(sampleRate * 0.02); // 20ms frames
  const hopSize = Math.floor(frameSize / 2);
  const frameDurationMs = (hopSize / sampleRate) * 1000;

  // Calculate energies for all frames
  const energies: { energy: number; timeMs: number }[] = [];

  for (let i = 0; i < audioBuffer.length - frameSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      energy += audioBuffer[i + j] * audioBuffer[i + j];
    }
    energies.push({
      energy: energy / frameSize,
      timeMs: (i / sampleRate) * 1000,
    });
  }

  // Helper to check if a time falls within any speech segment
  const isWithinSpeech = (timeMs: number): boolean => {
    return vadMetrics.speechSegments.some(
      segment => timeMs >= segment.start && timeMs <= segment.end
    );
  };

  // Calculate threshold only from speech segments (more accurate)
  const speechEnergies = energies.filter(e => isWithinSpeech(e.timeMs));
  if (speechEnergies.length === 0) {
    return detectSyllablesFromPeaks(audioBuffer, sampleRate);
  }

  const maxSpeechEnergy = Math.max(...speechEnergies.map(e => e.energy));
  const threshold = maxSpeechEnergy * 0.15;

  // Count peaks only within speech segments
  let peaks = 0;
  let lastPeakIdx = -10;

  for (let i = 1; i < energies.length - 1; i++) {
    const frame = energies[i];

    // Skip if not within a speech segment
    if (!isWithinSpeech(frame.timeMs)) {
      continue;
    }

    if (
      frame.energy > threshold &&
      frame.energy > energies[i - 1].energy &&
      frame.energy > energies[i + 1].energy &&
      i - lastPeakIdx > 3
    ) {
      peaks++;
      lastPeakIdx = i;
    }
  }

  console.log(`🎯 VAD-enhanced syllable detection: ${peaks} syllables in ${vadMetrics.speechSegments.length} speech segments`);

  return peaks;
}

function analyzeSpeechRate(
  audioBuffer: Float32Array,
  sampleRate: number,
  vadMetrics?: VADMetrics
): SpeechRateResult {
  const config = getMetricConfig("speechRate") || { thresholds: { min: 90, ideal: 150, max: 220 } };
  const { min, ideal, max } = config.thresholds;

  // Determine method based on VAD availability
  const useVAD = vadMetrics && vadMetrics.speechSegments && vadMetrics.speechSegments.length > 0;
  const method: SpeechRateMethod = useVAD ? "vad-enhanced" : "energy-peaks";

  // Use actual speech duration if VAD available, otherwise total duration
  const durationSeconds = useVAD
    ? vadMetrics.totalSpeechTime / 1000  // Only count actual speech time
    : audioBuffer.length / sampleRate;

  // Use VAD-enhanced syllable detection if available
  const syllables = useVAD
    ? detectSyllablesWithVAD(audioBuffer, sampleRate, vadMetrics)
    : detectSyllablesFromPeaks(audioBuffer, sampleRate);

  // Estimate WPM (assume ~1.5 syllables per word on average)
  const words = syllables / 1.5;
  const wpm = durationSeconds > 0 ? Math.round((words / durationSeconds) * 60) : 0;

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

  if (useVAD) {
    console.log(`📊 Speech Rate (VAD-enhanced): ${wpm} WPM over ${durationSeconds.toFixed(2)}s of speech`);
  }

  return {
    wordsPerMinute: wpm,
    score: Math.min(100, Math.max(0, Math.round(score))),
    tag: "FLUENCY",
    method,
  };
}

function analyzeAcceleration(
  audioBuffer: Float32Array,
  sampleRate: number,
  vadMetrics?: VADMetrics
): AccelerationResult {
  const config = getMetricConfig("acceleration") || { thresholds: { min: 0, ideal: 50, max: 100 } };

  const midpoint = Math.floor(audioBuffer.length / 2);
  const segment1 = audioBuffer.slice(0, midpoint);
  const segment2 = audioBuffer.slice(midpoint);

  // Split VAD segments for each half if available
  let vadSegment1: VADMetrics | undefined;
  let vadSegment2: VADMetrics | undefined;

  if (vadMetrics && vadMetrics.speechSegments) {
    const totalDurationMs = (audioBuffer.length / sampleRate) * 1000;
    const midpointMs = totalDurationMs / 2;

    const segments1 = vadMetrics.speechSegments.filter(s => s.end <= midpointMs);
    const segments2 = vadMetrics.speechSegments.filter(s => s.start >= midpointMs)
      .map(s => ({ ...s, start: s.start - midpointMs, end: s.end - midpointMs }));

    if (segments1.length > 0) {
      const totalSpeech1 = segments1.reduce((sum, s) => sum + s.duration, 0);
      vadSegment1 = {
        ...vadMetrics,
        speechSegments: segments1,
        totalSpeechTime: totalSpeech1,
        totalSilenceTime: midpointMs - totalSpeech1,
        speechRatio: totalSpeech1 / midpointMs,
      };
    }

    if (segments2.length > 0) {
      const totalSpeech2 = segments2.reduce((sum, s) => sum + s.duration, 0);
      vadSegment2 = {
        ...vadMetrics,
        speechSegments: segments2,
        totalSpeechTime: totalSpeech2,
        totalSilenceTime: midpointMs - totalSpeech2,
        speechRatio: totalSpeech2 / midpointMs,
      };
    }
  }

  // Analyze each segment
  const vol1 = analyzeVolume(segment1);
  const vol2 = analyzeVolume(segment2);

  const rate1 = analyzeSpeechRate(segment1, sampleRate, vadSegment1);
  const rate2 = analyzeSpeechRate(segment2, sampleRate, vadSegment2);

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

  // Calculate adaptive noise floor from first 100ms
  const adaptiveNoiseFloor = calculateAdaptiveNoiseFloor(audioBuffer, sampleRate);
  let firstSoundSample = 0;

  for (let i = 0; i < audioBuffer.length; i++) {
    if (Math.abs(audioBuffer[i]) > adaptiveNoiseFloor) {
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

/**
 * Calculate adaptive noise floor based on first 100ms of audio
 */
function calculateAdaptiveNoiseFloor(audioBuffer: Float32Array, sampleRate: number): number {
  const frameSamples = Math.floor(sampleRate * 0.1); // 100ms
  const noiseSegment = audioBuffer.slice(0, Math.min(frameSamples, audioBuffer.length));

  if (noiseSegment.length === 0) {
    return 0.01; // Fallback to default
  }

  // Calculate RMS of noise segment
  let sum = 0;
  for (let i = 0; i < noiseSegment.length; i++) {
    sum += noiseSegment[i] * noiseSegment[i];
  }
  const rms = Math.sqrt(sum / noiseSegment.length);

  // Set threshold 3x above noise floor (3 standard deviations)
  return Math.max(0.005, rms * 3); // Minimum 0.005 to avoid false positives
}

function analyzePauses(
  audioBuffer: Float32Array,
  sampleRate: number,
  vadMetrics?: VADMetrics
): PauseResult {
  const config = getMetricConfig("pauseManagement") || { thresholds: { min: 0, ideal: 0, max: 2.71 } };
  const maxRatio = config.thresholds.max;

  let pauseRatio: number;
  let method: string;

  // Use VAD speechRatio if available (ML-based, more accurate)
  if (vadMetrics && typeof vadMetrics.speechRatio === 'number') {
    // VAD gives speech ratio, we need pause ratio
    pauseRatio = 1 - vadMetrics.speechRatio;
    method = 'vad';
    console.log(`⏸️ Pause Analysis (VAD): speechRatio=${vadMetrics.speechRatio.toFixed(2)}, pauseRatio=${pauseRatio.toFixed(2)}`);
  } else {
    // Fallback to frame-based energy detection
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

    pauseRatio = silentFrames / Math.max(1, totalFrames);
    method = 'energy';
  }

  // Score: less pause is better (up to a point)
  // Natural speech should have 10-30% pauses for breathing
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
  // Try to load custom metric settings first
  let weights = {
    volume: 0.40,
    speechRate: 0.40,
    acceleration: 0.05,
    responseTime: 0.05,
    pauses: 0.10,
  };

  try {
    // Load from new metric settings if available
    const metricSettingsStr = localStorage.getItem('audio_metric_settings');
    if (metricSettingsStr) {
      const metricSettings = JSON.parse(metricSettingsStr) as Record<string, any>;
      // Convert to normalized weights (0-1)
      const enabledTotal: number = (Object.values(metricSettings) as any[])
        .filter((config) => !!config?.enabled)
        .reduce((sum, config) => sum + (Number(config?.weight) || 0), 0);

      if (enabledTotal > 0) {
        weights = {
          volume: metricSettings.volume.enabled ? metricSettings.volume.weight / 100 : 0,
          speechRate: metricSettings.speechRate.enabled ? metricSettings.speechRate.weight / 100 : 0,
          acceleration: metricSettings.acceleration.enabled ? metricSettings.acceleration.weight / 100 : 0,
          responseTime: metricSettings.responseTime.enabled ? metricSettings.responseTime.weight / 100 : 0,
          pauses: metricSettings.pauses.enabled ? metricSettings.pauses.weight / 100 : 0,
        };
      }
    } else {
      // Fall back to old metricConfig from database if new settings not available
      const config = getConfig();
      const oldWeights = {
        volume: config.find((c) => c.id === "volume")?.weight ?? 40,
        speechRate: config.find((c) => c.id === "speechRate")?.weight ?? 40,
        acceleration: config.find((c) => c.id === "acceleration")?.weight ?? 5,
        responseTime: config.find((c) => c.id === "responseTime")?.weight ?? 5,
        pauseManagement: config.find((c) => c.id === "pauseManagement")?.weight ?? 10,
      };
      const oldTotal = Object.values(oldWeights).reduce((a, b) => a + b, 0);

      // Avoid division by zero if all metrics are disabled
      if (oldTotal === 0) {
        weights = {
          volume: 0,
          speechRate: 0,
          acceleration: 0,
          responseTime: 0,
          pauses: 0,
        };
      } else {
        weights = {
          volume: oldWeights.volume / oldTotal,
          speechRate: oldWeights.speechRate / oldTotal,
          acceleration: oldWeights.acceleration / oldTotal,
          responseTime: oldWeights.responseTime / oldTotal,
          pauses: oldWeights.pauseManagement / oldTotal,
        };
      }
    }
  } catch (error) {
    console.error('Failed to load metric weights, using defaults:', error);
  }

  const weightedSum =
    results.volume.score * weights.volume +
    results.speechRate.score * weights.speechRate +
    results.acceleration.score * weights.acceleration +
    results.responseTime.score * weights.responseTime +
    results.pauses.score * weights.pauses;

  return Math.round(weightedSum);
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
  _audioBase64?: string,
  deviceId?: string,
  vadMetrics?: VADMetrics
): Promise<AnalysisResult> {
  let processedBuffer = audioBuffer;
  let normalizationInfo = undefined;

  // Apply LUFS normalization with device calibration if deviceId is provided
  if (deviceId) {
    const result = calibrateAndNormalize(audioBuffer, sampleRate, deviceId);
    processedBuffer = result.normalized;
    normalizationInfo = {
      originalLUFS: Math.round(result.originalLUFS * 10) / 10,
      calibratedLUFS: Math.round(result.calibratedLUFS * 10) / 10,
      finalLUFS: Math.round(result.finalLUFS * 10) / 10,
      deviceGain: Math.round(result.deviceGain * 100) / 100,
      normalizationGain: Math.round(result.normalizationGain * 100) / 100,
    };

    console.log('🎚️ LUFS Normalization Applied:', normalizationInfo);
  }

  // Log VAD metrics if available
  if (vadMetrics) {
    console.log('🎤 VAD Metrics:', {
      speechSegments: vadMetrics.speechSegments?.length || 0,
      speechRatio: vadMetrics.speechRatio?.toFixed(2),
      totalSpeechTime: `${vadMetrics.totalSpeechTime}ms`,
    });
  }

  // Perform all analyses on normalized audio with VAD enhancement
  const volume = analyzeVolume(processedBuffer);
  const speechRate = analyzeSpeechRate(processedBuffer, sampleRate, vadMetrics);
  const acceleration = analyzeAcceleration(processedBuffer, sampleRate, vadMetrics);
  const responseTime = analyzeResponseTime(processedBuffer, sampleRate);
  const pauses = analyzePauses(processedBuffer, sampleRate, vadMetrics);

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
    normalization: normalizationInfo,
  };
}
