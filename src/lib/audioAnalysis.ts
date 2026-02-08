// Audio Analysis Metrics for Voice Energy App
// NOTE: This file contains the CORE ANALYSIS LOGIC that must NOT be changed

import { calibrateAndNormalize, calculateNoiseFloor, getCalibrationProfile, TARGET_LUFS } from './lufsNormalization';
// VADMetrics is defined locally below; analyzeVAD removed (module './vad' doesn't exist)
import { transcribeAudio, calculateWPMFromTranscription } from './deepgramService';

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
export type SpeechRateMethod = "energy-peaks" | "vad-enhanced" | "spectral-flux" | "web-speech-api" | "deepgram-stt";

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
    { id: "speechRate", weight: 40, thresholds: { min: 90, ideal: 150, max: 220 }, method: "spectral-flux" },
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
  const method = config?.method || "spectral-flux";
  console.log(`🔧 [audioAnalysis] speechRate config method: ${config?.method}, resolved: ${method}`);
  return method as SpeechRateMethod;
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

function analyzeVolume(audioBuffer: Float32Array, deviceDbOffset: number = 0): VolumeResult {
  const config = getMetricConfig("volume");
  const { min, ideal, max } = config?.thresholds ?? { min: -35, ideal: -15, max: 0 };

  // Calculate RMS
  let sum = 0;
  for (let i = 0; i < audioBuffer.length; i++) {
    sum += audioBuffer[i] * audioBuffer[i];
  }
  const rms = Math.sqrt(sum / audioBuffer.length);

  // Convert to dB and apply device offset for cross-device comparability.
  // The offset compensates for mic sensitivity differences WITHOUT erasing
  // the actual loud vs quiet difference in the user's voice.
  const rawDb = 20 * Math.log10(Math.max(rms, 1e-10));
  const db = rawDb + deviceDbOffset;

  if (deviceDbOffset !== 0) {
    console.log(`🔊 Volume: rawDb=${rawDb.toFixed(1)}, offset=${deviceDbOffset.toFixed(1)}, adjustedDb=${db.toFixed(1)}`);
  }

  // Score calculation:
  // - Below min: 0 (too quiet)
  // - min to ideal: linear 0→90 (louder = better)
  // - ideal to max: 90→100 peak then back to 90 (sweet spot near ideal)
  // - Above max: drops from 90 (too loud / clipping)
  let score = 0;
  if (db >= ideal && db <= max) {
    // Near ideal = best score. Peak at midpoint between ideal and max.
    const midpoint = (ideal + max) / 2;
    if (db <= midpoint) {
      score = 90 + ((db - ideal) / (midpoint - ideal)) * 10;
    } else {
      score = 100 - ((db - midpoint) / (max - midpoint)) * 10;
    }
  } else if (db > max) {
    // Above max: penalty for clipping/too loud
    score = Math.max(0, 90 - (db - max) * 5);
  } else if (db >= min) {
    // Between min and ideal: linear climb 0→90
    score = ((db - min) / (ideal - min)) * 90;
  } else {
    // Below min: too quiet
    score = 0;
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

/**
 * Spectral Flux syllable detection.
 * Computes Short-Time Fourier Transform on raw PCM,
 * calculates onset flux, and counts syllable peaks.
 * No external dependencies — pure math on Float32Array.
 *
 * Much more accurate than energy peaks because it detects
 * spectral changes (formant transitions) rather than just amplitude.
 */
function detectSyllablesWithSpectralFlux(
  audioBuffer: Float32Array,
  sampleRate: number,
  vadMetrics?: VADMetrics
): number {
  const frameSizeSamples = Math.floor(sampleRate * 0.02); // 20ms frames
  const hopSize = Math.floor(frameSizeSamples / 2);       // 50% overlap = 10ms hop
  const fftBins = 256; // 256 bins covers ~0-8kHz at 44.1kHz (sufficient for speech)

  // Pre-compute Hann window
  const hannWindow = new Float32Array(frameSizeSamples);
  for (let i = 0; i < frameSizeSamples; i++) {
    hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameSizeSamples - 1)));
  }

  // Pre-compute cosine/sine tables for DFT (avoids recalculating trig per frame)
  const cosTable = new Float32Array(fftBins * frameSizeSamples);
  const sinTable = new Float32Array(fftBins * frameSizeSamples);
  for (let k = 0; k < fftBins; k++) {
    const freqRatio = (2 * Math.PI * k) / frameSizeSamples;
    for (let n = 0; n < frameSizeSamples; n++) {
      cosTable[k * frameSizeSamples + n] = Math.cos(freqRatio * n);
      sinTable[k * frameSizeSamples + n] = Math.sin(freqRatio * n);
    }
  }

  // Compute magnitude spectrum for a windowed frame using pre-computed tables
  function computeMagnitudeSpectrum(frame: Float32Array): Float32Array {
    const magnitudes = new Float32Array(fftBins);
    const N = frame.length;
    for (let k = 0; k < fftBins; k++) {
      let real = 0;
      let imag = 0;
      const offset = k * frameSizeSamples;
      for (let n = 0; n < N; n++) {
        real += frame[n] * cosTable[offset + n];
        imag -= frame[n] * sinTable[offset + n];
      }
      magnitudes[k] = Math.sqrt(real * real + imag * imag);
    }
    return magnitudes;
  }

  // VAD speech region lookup
  const hasVAD = vadMetrics && vadMetrics.speechSegments && vadMetrics.speechSegments.length > 0;
  const isWithinSpeech = (timeMs: number): boolean => {
    if (!hasVAD) return true;
    return vadMetrics!.speechSegments.some(
      seg => timeMs >= seg.start && timeMs <= seg.end
    );
  };

  // Compute spectral flux for each frame
  let prevSpectrum = new Float32Array(fftBins);
  const fluxValues: { flux: number; timeMs: number }[] = [];
  const windowed = new Float32Array(frameSizeSamples);

  for (let i = 0; i <= audioBuffer.length - frameSizeSamples; i += hopSize) {
    // Apply Hann window
    for (let j = 0; j < frameSizeSamples; j++) {
      windowed[j] = audioBuffer[i + j] * hannWindow[j];
    }

    const spectrum = computeMagnitudeSpectrum(windowed);

    // Half-wave rectified spectral flux (only positive changes = onsets)
    let flux = 0;
    for (let k = 0; k < fftBins; k++) {
      const diff = spectrum[k] - prevSpectrum[k];
      if (diff > 0) flux += diff;
    }

    const timeMs = (i / sampleRate) * 1000;
    fluxValues.push({ flux, timeMs });
    prevSpectrum = new Float32Array(spectrum) as Float32Array<ArrayBuffer>;
  }

  if (fluxValues.length === 0) return 0;

  // Filter to speech regions if VAD available
  const speechFlux = hasVAD
    ? fluxValues.filter(f => isWithinSpeech(f.timeMs))
    : fluxValues;

  if (speechFlux.length < 3) return Math.max(1, speechFlux.length);

  // Adaptive threshold: median * 1.5
  const sortedFlux = [...speechFlux.map(f => f.flux)].sort((a, b) => a - b);
  const median = sortedFlux[Math.floor(sortedFlux.length / 2)];
  const threshold = Math.max(
    median * 1.5,
    sortedFlux[Math.floor(sortedFlux.length * 0.75)] * 0.5
  );

  // Peak detection with minimum 40ms spacing (4 frames at 10ms hop)
  let peaks = 0;
  let lastPeakIdx = -5;

  for (let i = 1; i < speechFlux.length - 1; i++) {
    if (
      speechFlux[i].flux > threshold &&
      speechFlux[i].flux > speechFlux[i - 1].flux &&
      speechFlux[i].flux > speechFlux[i + 1].flux &&
      i - lastPeakIdx > 4
    ) {
      peaks++;
      lastPeakIdx = i;
    }
  }

  console.log(`🔬 Spectral Flux: ${peaks} syllables from ${speechFlux.length} speech frames (threshold=${threshold.toFixed(2)})`);
  return Math.max(1, peaks);
}

function analyzeSpeechRate(
  audioBuffer: Float32Array,
  sampleRate: number,
  vadMetrics?: VADMetrics,
  sttWordCount?: number
): SpeechRateResult {
  const config = getMetricConfig("speechRate");
  const { min, ideal, max } = config?.thresholds ?? { min: 90, ideal: 150, max: 220 };

  // If sttWordCount was explicitly not provided (e.g. from acceleration sub-analysis),
  // force spectral-flux — we can't split STT words across audio halves
  const configuredMethod = sttWordCount === undefined
    ? "spectral-flux" as SpeechRateMethod
    : getSpeechRateMethod();

  // Calculate duration using hybrid approach:
  // - Pure speech-only duration gives inflated WPM (300 WPM for short clips)
  // - Pure total duration is too slow
  // - Hybrid: totalDuration - (silenceTime / 2) = accounts for natural pauses but not all silence
  const totalDuration = audioBuffer.length / sampleRate;
  const useVAD = vadMetrics && vadMetrics.speechSegments && vadMetrics.speechSegments.length > 0;

  let durationSeconds: number;
  if (useVAD) {
    const speechDuration = vadMetrics.totalSpeechTime / 1000;
    const silenceTime = totalDuration - speechDuration;
    // Hybrid: subtract half of silence time from total
    durationSeconds = totalDuration - (silenceTime / 2);
    console.log(`⏱️ Duration (hybrid): total=${totalDuration.toFixed(2)}s, speech=${speechDuration.toFixed(2)}s, silence=${silenceTime.toFixed(2)}s, adjusted=${durationSeconds.toFixed(2)}s`);
  } else {
    durationSeconds = totalDuration;
    console.log(`⏱️ Duration (no VAD): ${durationSeconds.toFixed(2)}s`);
  }

  let wpm = 0;
  let actualMethod: SpeechRateMethod = configuredMethod;

  switch (configuredMethod) {
    case "deepgram-stt": {
      if (sttWordCount != null && sttWordCount > 0) {
        // Direct word count from Deepgram transcription — most accurate
        wpm = durationSeconds > 0 ? Math.round((sttWordCount / durationSeconds) * 60) : 0;
        actualMethod = "deepgram-stt";
        console.log(`🎙️ Speech Rate (Deepgram STT): ${sttWordCount} words, ${wpm} WPM over ${durationSeconds.toFixed(2)}s`);
      } else {
        // Fallback: Deepgram failed or unavailable → use spectral flux
        console.warn('⚠️ Deepgram STT produced no words, falling back to spectral-flux');
        const syllables = detectSyllablesWithSpectralFlux(audioBuffer, sampleRate, vadMetrics);
        wpm = durationSeconds > 0 ? Math.round((syllables / 1.5 / durationSeconds) * 60) : 0;
        actualMethod = "spectral-flux";
      }
      break;
    }

    case "web-speech-api": {
      if (sttWordCount != null && sttWordCount > 0) {
        // Direct word count from browser STT — most accurate
        wpm = durationSeconds > 0 ? Math.round((sttWordCount / durationSeconds) * 60) : 0;
        actualMethod = "web-speech-api";
        console.log(`🗣️ Speech Rate (Web Speech API): ${sttWordCount} words, ${wpm} WPM over ${durationSeconds.toFixed(2)}s`);
      } else {
        // Fallback: STT failed or unavailable → use spectral flux
        console.warn('⚠️ Web Speech API produced no words, falling back to spectral-flux');
        const syllables = detectSyllablesWithSpectralFlux(audioBuffer, sampleRate, vadMetrics);
        wpm = durationSeconds > 0 ? Math.round((syllables / 1.5 / durationSeconds) * 60) : 0;
        actualMethod = "spectral-flux";
      }
      break;
    }


    case "spectral-flux": {
      const syllables = detectSyllablesWithSpectralFlux(audioBuffer, sampleRate, vadMetrics);
      wpm = durationSeconds > 0 ? Math.round((syllables / 1.5 / durationSeconds) * 60) : 0;
      actualMethod = "spectral-flux";
      console.log(`🔬 Speech Rate (Spectral Flux): ${wpm} WPM over ${durationSeconds.toFixed(2)}s`);
      break;
    }

    case "energy-peaks":
    default: {
      // Original behavior: use VAD-enhanced if available, otherwise basic energy peaks
      const syllables = useVAD
        ? detectSyllablesWithVAD(audioBuffer, sampleRate, vadMetrics)
        : detectSyllablesFromPeaks(audioBuffer, sampleRate);
      wpm = durationSeconds > 0 ? Math.round((syllables / 1.5 / durationSeconds) * 60) : 0;
      actualMethod = useVAD ? "vad-enhanced" : "energy-peaks";
      if (useVAD) {
        console.log(`📊 Speech Rate (VAD-enhanced): ${wpm} WPM over ${durationSeconds.toFixed(2)}s`);
      }
      break;
    }
  }

  // Score calculation for Speech Rate (energy-based):
  // Faster = more energy = better score. Only slow speech is penalized.
  // below min → 0 (too slow, no energy)
  // min → ideal → linear 0 → 100
  // ideal and above → always 100 (fast speech = high energy = perfect)
  let score = 0;
  if (wpm <= 0) {
    score = 0;
  } else if (wpm < min) {
    // Below minimum: too slow = no energy
    score = 0;
  } else if (wpm >= min && wpm < ideal) {
    // min → ideal: linear 0 → 100
    score = ((wpm - min) / (ideal - min)) * 100;
  } else {
    // ideal and above: fast speech = high energy = 100%
    score = 100;
  }

  return {
    wordsPerMinute: wpm,
    score: Math.min(100, Math.max(0, Math.round(score))),
    tag: "FLUENCY",
    method: actualMethod,
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

  // For acceleration sub-analysis, don't pass sttWordCount (can't split words per half)
  // This forces spectral-flux fallback which is appropriate for comparing halves
  const rate1 = analyzeSpeechRate(segment1, sampleRate, vadSegment1, undefined);
  const rate2 = analyzeSpeechRate(segment2, sampleRate, vadSegment2, undefined);

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
  const config = getMetricConfig("responseTime");
  const { min: maxMs, ideal: idealMs } = config?.thresholds ?? { min: 2000, ideal: 200, max: 0 };

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
  const config = getMetricConfig("pauseManagement");
  const maxRatio = config?.thresholds?.max ?? 2.71;

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
    // Load from metricConfig (saved by admin panel)
    const metricConfigStr = localStorage.getItem('metricConfig');
    console.log('🔍 Loading weights from localStorage (metricConfig):', metricConfigStr ? 'FOUND' : 'NOT FOUND');

    if (metricConfigStr) {
      const metricConfigArray = JSON.parse(metricConfigStr) as any[];
      console.log('📋 Metric config from localStorage:', metricConfigArray);

      // Convert array to object for easier access
      const metricSettings: Record<string, any> = {};
      metricConfigArray.forEach((config: any) => {
        metricSettings[config.id] = config;
      });

      // Calculate total weight from enabled metrics
      const enabledTotal: number = metricConfigArray
        .filter((config) => !!config?.enabled)
        .reduce((sum, config) => sum + (Number(config?.weight) || 0), 0);

      console.log('📊 Enabled total weight:', enabledTotal);

      if (enabledTotal > 0) {
        weights = {
          volume: metricSettings.volume?.enabled ? metricSettings.volume.weight / enabledTotal : 0,
          speechRate: metricSettings.speechRate?.enabled ? metricSettings.speechRate.weight / enabledTotal : 0,
          acceleration: metricSettings.acceleration?.enabled ? metricSettings.acceleration.weight / enabledTotal : 0,
          responseTime: metricSettings.responseTime?.enabled ? metricSettings.responseTime.weight / enabledTotal : 0,
          pauses: (metricSettings.pauses || metricSettings.pauseManagement)?.enabled
            ? ((metricSettings.pauses || metricSettings.pauseManagement).weight / enabledTotal)
            : 0,
        };
        console.log('✅ Using weights from localStorage (normalized):', weights);
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

  const finalScore = Math.round(weightedSum);

  // Debug logging to understand score breakdown
  console.log('📊 SCORE BREAKDOWN:');
  console.log(`  Volume: ${results.volume.score} × ${(weights.volume * 100).toFixed(0)}% = ${(results.volume.score * weights.volume).toFixed(1)} points`);
  console.log(`  Speech Rate: ${results.speechRate.score} × ${(weights.speechRate * 100).toFixed(0)}% = ${(results.speechRate.score * weights.speechRate).toFixed(1)} points`);
  console.log(`  Acceleration: ${results.acceleration.score} × ${(weights.acceleration * 100).toFixed(0)}% = ${(results.acceleration.score * weights.acceleration).toFixed(1)} points`);
  console.log(`  Response Time: ${results.responseTime.score} × ${(weights.responseTime * 100).toFixed(0)}% = ${(results.responseTime.score * weights.responseTime).toFixed(1)} points`);
  console.log(`  Pauses: ${results.pauses.score} × ${(weights.pauses * 100).toFixed(0)}% = ${(results.pauses.score * weights.pauses).toFixed(1)} points`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  TOTAL: ${finalScore}/100`);

  return finalScore;
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
  vadMetrics?: VADMetrics,
  sttWordCount?: number,
  audioBlob?: Blob
): Promise<AnalysisResult> {
  // Guard: if VAD detected no speech at all, short-circuit to score 0
  const hasSpeech = vadMetrics
    ? vadMetrics.speechRatio > 0.02 && vadMetrics.totalSpeechTime > 200
    : true; // assume speech if no VAD

  if (!hasSpeech) {
    console.log('🔇 No speech detected by VAD — returning zero scores');
    const zeroResult: AnalysisResult = {
      overallScore: 0,
      emotionalFeedback: 'poor',
      volume: { averageDb: -Infinity, score: 0, tag: 'ENERGY' },
      speechRate: { wordsPerMinute: 0, score: 0, tag: 'FLUENCY', method: getSpeechRateMethod() },
      acceleration: { isAccelerating: false, segment1Volume: 0, segment2Volume: 0, segment1Rate: 0, segment2Rate: 0, score: 0, tag: 'DYNAMICS' },
      responseTime: { responseTimeMs: 0, score: 0, tag: 'READINESS' },
      pauses: { pauseRatio: 1, score: 0, tag: 'FLUIDITY' },
    };
    return zeroResult;
  }

  let processedBuffer = audioBuffer;
  let normalizationInfo = undefined;

  // Apply LUFS normalization with device calibration if deviceId is provided
  // The normalized buffer is used for speech rate, acceleration, pauses, response time
  // but NOT for volume scoring (see below)
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

  // Calculate device dB offset for volume scoring.
  // This compensates for mic sensitivity (quiet mic vs loud mic) so the same
  // actual voice energy produces the same score on any device.
  // Unlike full LUFS normalization, this preserves loud vs quiet differences.
  let deviceDbOffset = 0;
  if (deviceId) {
    const profile = getCalibrationProfile(deviceId);
    if (profile) {
      deviceDbOffset = TARGET_LUFS - profile.referenceLevel;
      console.log(`🎚️ Volume offset: ${deviceDbOffset.toFixed(1)} dB (ref=${profile.referenceLevel.toFixed(1)} LUFS, target=${TARGET_LUFS} LUFS)`);
    }
  }

  // Volume: analyze on RAW audio buffer + device offset (NOT LUFS-normalized)
  // This ensures loud speech = high score, quiet speech = low score
  const volume = analyzeVolume(audioBuffer, deviceDbOffset);

  // Other metrics: use LUFS-normalized buffer (they benefit from consistent levels)
  // Check if Deepgram STT method is selected
  const method = getSpeechRateMethod();
  let deepgramWordCount: number | undefined;

  console.log(`🔍 Speech Rate Method: "${method}", audioBlob: ${audioBlob ? 'PROVIDED' : 'MISSING'}`);

  if (method === 'deepgram-stt' && audioBlob) {
    try {
      console.log('🎙️ [analyzeAudioAsync] Using Deepgram STT for speech rate...');
      console.log(`📦 Audio blob size: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
      const transcription = await transcribeAudio(audioBlob);
      deepgramWordCount = transcription.words.length;
      console.log(`✅ [analyzeAudioAsync] Deepgram transcribed ${deepgramWordCount} words`);
      console.log(`📝 Transcript: "${transcription.transcript.substring(0, 100)}${transcription.transcript.length > 100 ? '...' : ''}"`);
    } catch (error) {
      console.error('❌ [analyzeAudioAsync] Deepgram transcription failed:', error);
      console.warn('⚠️ Falling back to spectral-flux method');
      // deepgramWordCount remains undefined, will fall back to spectral-flux
    }
  } else if (method === 'deepgram-stt' && !audioBlob) {
    console.warn('⚠️ Deepgram STT selected but audioBlob not provided - falling back to spectral-flux');
  }

  // Use Deepgram word count if available, otherwise use sttWordCount from Web Speech API
  const finalSttWordCount = deepgramWordCount ?? sttWordCount;
  console.log(`🔢 Final STT word count: ${finalSttWordCount ?? 'undefined'} (deepgram: ${deepgramWordCount ?? 'N/A'}, webSpeech: ${sttWordCount ?? 'N/A'})`);

  const speechRate = analyzeSpeechRate(processedBuffer, sampleRate, vadMetrics, finalSttWordCount);
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
