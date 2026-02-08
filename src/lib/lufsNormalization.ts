/**
 * LUFS (Loudness Units relative to Full Scale) Normalization
 * Based on ITU-R BS.1770-4 standard for objective loudness measurement
 *
 * LUFS provides device-independent loudness measurement that matches human perception
 */

// ============ DEVICE CALIBRATION PROFILES ============

export interface CalibrationProfile {
  deviceId: string;
  deviceLabel: string;
  noiseFloor: number;          // Background noise level (dB)
  referenceLevel: number;       // User's normal speaking level (LUFS)
  gainAdjustment: number;       // Linear gain multiplier to reach target
  createdAt: number;
  lastUsed: number;
  recordingHistory?: RecordingStats[];  // Track recent recordings for variance detection
}

export interface RecordingStats {
  timestamp: number;
  originalLUFS: number;
  calibratedLUFS: number;
  finalLUFS: number;
  noiseFloor: number;
}

export interface RecalibrationSuggestion {
  shouldRecalibrate: boolean;
  reason?: string;
  variance?: number;
  threshold?: number;
}

const CALIBRATION_STORAGE_KEY = 'audio_calibration_profiles';
export const TARGET_LUFS = -23;  // EBU R128 standard for broadcast
const MAX_RECORDING_HISTORY = 10;  // Keep last 10 recordings for variance tracking
const VARIANCE_THRESHOLD = 5;  // LUFS variance threshold for recalibration suggestion

/**
 * Save calibration profile to localStorage
 */
export function saveCalibrationProfile(profile: CalibrationProfile): void {
  try {
    const profiles = getCalibrationProfiles();
    const existingIndex = profiles.findIndex(p => p.deviceId === profile.deviceId);

    if (existingIndex >= 0) {
      profiles[existingIndex] = profile;
    } else {
      profiles.push(profile);
    }

    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(profiles));
    console.log('✅ Calibration profile saved:', profile.deviceId);
  } catch (e) {
    console.error('Failed to save calibration profile:', e);
  }
}

/**
 * Get all calibration profiles
 */
export function getCalibrationProfiles(): CalibrationProfile[] {
  try {
    const stored = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.warn('Failed to load calibration profiles:', e);
    return [];
  }
}

/**
 * Get calibration profile for a specific device
 */
export function getCalibrationProfile(deviceId: string): CalibrationProfile | null {
  const profiles = getCalibrationProfiles();
  const profile = profiles.find(p => p.deviceId === deviceId);

  if (profile) {
    // Update last used timestamp
    profile.lastUsed = Date.now();
    saveCalibrationProfile(profile);
  }

  return profile || null;
}

/**
 * Delete calibration profile
 */
export function deleteCalibrationProfile(deviceId: string): void {
  const profiles = getCalibrationProfiles();
  const filtered = profiles.filter(p => p.deviceId !== deviceId);
  localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(filtered));
}

// ============ LUFS CALCULATION ============

/**
 * Calculate adaptive noise floor from the first 100ms of audio
 */
export function calculateNoiseFloor(audioBuffer: Float32Array, sampleRate: number): number {
  const frameSamples = Math.floor(sampleRate * 0.1); // 100ms
  const noiseSegment = audioBuffer.slice(0, Math.min(frameSamples, audioBuffer.length));

  // Calculate RMS of noise
  let sum = 0;
  for (let i = 0; i < noiseSegment.length; i++) {
    sum += noiseSegment[i] * noiseSegment[i];
  }
  const rms = Math.sqrt(sum / noiseSegment.length);

  // Convert to dB
  return 20 * Math.log10(Math.max(rms, 1e-10));
}

/**
 * Apply K-weighting filter (simplified version)
 * Full implementation requires biquad filters, this is an approximation
 */
function applyKWeighting(audioBuffer: Float32Array): Float32Array {
  // For simplicity, we'll use RMS which is close enough for speech
  // A full implementation would use shelf filters at specific frequencies
  return audioBuffer;
}

/**
 * Calculate mean square with gating
 * Implements absolute and relative gating as per ITU-R BS.1770-4
 */
function calculateMeanSquareWithGating(audioBuffer: Float32Array, sampleRate: number): number {
  const blockSize = Math.floor(sampleRate * 0.4); // 400ms blocks
  const overlapSize = Math.floor(blockSize * 0.75); // 75% overlap
  const hopSize = blockSize - overlapSize;

  const blockLoudnesses: number[] = [];

  // Calculate loudness for each block
  for (let i = 0; i < audioBuffer.length - blockSize; i += hopSize) {
    let sumSquares = 0;
    for (let j = 0; j < blockSize; j++) {
      const sample = audioBuffer[i + j];
      sumSquares += sample * sample;
    }
    const meanSquare = sumSquares / blockSize;
    blockLoudnesses.push(meanSquare);
  }

  if (blockLoudnesses.length === 0) {
    return 0;
  }

  // Absolute gate: -70 LUFS
  const absoluteGate = Math.pow(10, -70 / 10);
  const gatedBlocks = blockLoudnesses.filter(ms => ms >= absoluteGate);

  if (gatedBlocks.length === 0) {
    return 0;
  }

  // Relative gate: -10 LU below average
  const averageLoudness = gatedBlocks.reduce((a, b) => a + b, 0) / gatedBlocks.length;
  const relativeGate = averageLoudness * Math.pow(10, -10 / 10);
  const finalBlocks = gatedBlocks.filter(ms => ms >= relativeGate);

  if (finalBlocks.length === 0) {
    return averageLoudness;
  }

  return finalBlocks.reduce((a, b) => a + b, 0) / finalBlocks.length;
}

/**
 * Calculate LUFS (Loudness Units relative to Full Scale)
 * Returns integrated loudness in LUFS
 */
export function calculateLUFS(audioBuffer: Float32Array, sampleRate: number): number {
  if (audioBuffer.length === 0) {
    return -Infinity;
  }

  // Apply K-weighting (simplified)
  const weighted = applyKWeighting(audioBuffer);

  // Calculate gated mean square
  const meanSquare = calculateMeanSquareWithGating(weighted, sampleRate);

  if (meanSquare === 0) {
    return -Infinity;
  }

  // Convert to LUFS: LUFS = -0.691 + 10 * log10(mean_square)
  const lufs = -0.691 + 10 * Math.log10(meanSquare);

  return lufs;
}

/**
 * Normalize audio buffer to target LUFS
 */
export function normalizeToLUFS(
  audioBuffer: Float32Array,
  sampleRate: number,
  targetLUFS: number = TARGET_LUFS
): { normalized: Float32Array; currentLUFS: number; gainDB: number; gainLinear: number } {
  // Calculate current LUFS
  const currentLUFS = calculateLUFS(audioBuffer, sampleRate);

  if (!isFinite(currentLUFS)) {
    // Silent audio, return as-is
    return {
      normalized: audioBuffer,
      currentLUFS: -Infinity,
      gainDB: 0,
      gainLinear: 1,
    };
  }

  // Calculate required gain
  const gainDB = targetLUFS - currentLUFS;
  const gainLinear = Math.pow(10, gainDB / 20);

  // Apply gain with clipping protection
  const normalized = new Float32Array(audioBuffer.length);
  for (let i = 0; i < audioBuffer.length; i++) {
    normalized[i] = Math.max(-1, Math.min(1, audioBuffer[i] * gainLinear));
  }

  return {
    normalized,
    currentLUFS,
    gainDB,
    gainLinear,
  };
}

/**
 * Apply device-specific calibration and normalize to target LUFS
 */
export function calibrateAndNormalize(
  audioBuffer: Float32Array,
  sampleRate: number,
  deviceId?: string,
  targetLUFS: number = TARGET_LUFS
): {
  normalized: Float32Array;
  originalLUFS: number;
  calibratedLUFS: number;
  finalLUFS: number;
  deviceGain: number;
  normalizationGain: number;
} {
  let processedBuffer = audioBuffer;
  let deviceGain = 1;
  let originalLUFS = calculateLUFS(audioBuffer, sampleRate);

  // Step 1: Apply device calibration if available
  if (deviceId) {
    const profile = getCalibrationProfile(deviceId);
    if (profile && profile.gainAdjustment !== 1) {
      deviceGain = profile.gainAdjustment;
      processedBuffer = new Float32Array(audioBuffer.length);
      for (let i = 0; i < audioBuffer.length; i++) {
        processedBuffer[i] = Math.max(-1, Math.min(1, audioBuffer[i] * deviceGain));
      }
    }
  }

  const calibratedLUFS = calculateLUFS(processedBuffer, sampleRate);

  // Step 2: Normalize to target LUFS
  const { normalized, gainLinear } = normalizeToLUFS(processedBuffer, sampleRate, targetLUFS);
  const finalLUFS = calculateLUFS(normalized, sampleRate);

  // Step 3: Track recording stats for auto-recalibration
  if (deviceId) {
    const noiseFloor = calculateNoiseFloor(audioBuffer, sampleRate);
    trackRecording(deviceId, {
      originalLUFS,
      calibratedLUFS,
      finalLUFS,
      noiseFloor,
    });
  }

  return {
    normalized,
    originalLUFS,
    calibratedLUFS,
    finalLUFS,
    deviceGain,
    normalizationGain: gainLinear,
  };
}

// ============ CALIBRATION WIZARD HELPERS ============

/**
 * Measure user's reference speaking level for calibration
 */
export async function measureReferenceLevel(
  audioBuffer: Float32Array,
  sampleRate: number
): Promise<number> {
  return calculateLUFS(audioBuffer, sampleRate);
}

/**
 * Create calibration profile from measurements
 */
export function createCalibrationProfile(
  deviceId: string,
  deviceLabel: string,
  noiseFloor: number,
  referenceLevel: number,
  targetLevel: number = TARGET_LUFS
): CalibrationProfile {
  // Calculate gain needed to reach target
  const gainDB = targetLevel - referenceLevel;
  const gainAdjustment = Math.pow(10, gainDB / 20);

  return {
    deviceId,
    deviceLabel,
    noiseFloor,
    referenceLevel,
    gainAdjustment: Math.max(0.1, Math.min(10, gainAdjustment)), // Clamp between 0.1x and 10x
    createdAt: Date.now(),
    lastUsed: Date.now(),
    recordingHistory: [],
  };
}

// ============ AUTO-RECALIBRATION SYSTEM ============

/**
 * Add recording stats to profile history
 */
export function trackRecording(
  deviceId: string,
  stats: Omit<RecordingStats, 'timestamp'>
): void {
  const profile = getCalibrationProfile(deviceId);
  if (!profile) return;

  // Initialize history if needed
  if (!profile.recordingHistory) {
    profile.recordingHistory = [];
  }

  // Add new recording
  profile.recordingHistory.push({
    ...stats,
    timestamp: Date.now(),
  });

  // Keep only last N recordings
  if (profile.recordingHistory.length > MAX_RECORDING_HISTORY) {
    profile.recordingHistory = profile.recordingHistory.slice(-MAX_RECORDING_HISTORY);
  }

  saveCalibrationProfile(profile);
}

/**
 * Calculate variance in original LUFS across recent recordings
 */
function calculateLUFSVariance(history: RecordingStats[]): number {
  if (history.length < 3) return 0; // Need at least 3 samples

  const originalLUFS = history.map(r => r.originalLUFS);
  const mean = originalLUFS.reduce((a, b) => a + b, 0) / originalLUFS.length;

  // Calculate standard deviation
  const squaredDiffs = originalLUFS.map(lufs => Math.pow(lufs - mean, 2));
  const variance = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / originalLUFS.length);

  return variance;
}

/**
 * Calculate variance in noise floor across recent recordings
 */
function calculateNoiseFloorVariance(history: RecordingStats[]): number {
  if (history.length < 3) return 0;

  const noiseFloors = history.map(r => r.noiseFloor);
  const mean = noiseFloors.reduce((a, b) => a + b, 0) / noiseFloors.length;

  const squaredDiffs = noiseFloors.map(nf => Math.pow(nf - mean, 2));
  const variance = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / noiseFloors.length);

  return variance;
}

/**
 * Check if device needs recalibration
 */
export function checkRecalibrationNeeded(deviceId: string): RecalibrationSuggestion {
  const profile = getCalibrationProfile(deviceId);

  if (!profile) {
    return { shouldRecalibrate: false };
  }

  // No history yet
  if (!profile.recordingHistory || profile.recordingHistory.length < 3) {
    return { shouldRecalibrate: false };
  }

  const history = profile.recordingHistory;

  // Check 1: LUFS variance too high (environment changed significantly)
  const lufsVariance = calculateLUFSVariance(history);
  if (lufsVariance > VARIANCE_THRESHOLD) {
    return {
      shouldRecalibrate: true,
      reason: `High variance in audio levels detected (${lufsVariance.toFixed(1)} LUFS). Your environment or mic position may have changed.`,
      variance: lufsVariance,
      threshold: VARIANCE_THRESHOLD,
    };
  }

  // Check 2: Noise floor changed dramatically (>10 dB)
  const noiseVariance = calculateNoiseFloorVariance(history);
  if (noiseVariance > 10) {
    return {
      shouldRecalibrate: true,
      reason: `Background noise level changed significantly (${noiseVariance.toFixed(1)} dB). Consider recalibrating in your current environment.`,
      variance: noiseVariance,
      threshold: 10,
    };
  }

  // Check 3: Profile is old (>30 days)
  const daysSinceCalibration = (Date.now() - profile.createdAt) / (1000 * 60 * 60 * 24);
  if (daysSinceCalibration > 30) {
    return {
      shouldRecalibrate: true,
      reason: `Calibration is ${Math.floor(daysSinceCalibration)} days old. Recalibrating ensures optimal accuracy.`,
    };
  }

  // Check 4: Average calibrated LUFS drifting from target
  const avgCalibratedLUFS = history.reduce((sum, r) => sum + r.calibratedLUFS, 0) / history.length;
  const drift = Math.abs(avgCalibratedLUFS - TARGET_LUFS);
  if (drift > 3) {
    return {
      shouldRecalibrate: true,
      reason: `Audio levels are drifting from target (${drift.toFixed(1)} LUFS off). Recalibration recommended.`,
      variance: drift,
      threshold: 3,
    };
  }

  return { shouldRecalibrate: false };
}

/**
 * Get human-readable recalibration status
 */
export function getRecalibrationStatus(deviceId: string): {
  status: 'good' | 'warning' | 'recommend';
  message: string;
  variance?: number;
} {
  const suggestion = checkRecalibrationNeeded(deviceId);

  if (!suggestion.shouldRecalibrate) {
    return {
      status: 'good',
      message: 'Calibration is accurate and up to date.',
    };
  }

  const severity = suggestion.variance && suggestion.threshold
    ? suggestion.variance / suggestion.threshold
    : 1.5;

  if (severity > 2) {
    return {
      status: 'recommend',
      message: suggestion.reason || 'Recalibration strongly recommended.',
      variance: suggestion.variance,
    };
  }

  return {
    status: 'warning',
    message: suggestion.reason || 'Consider recalibrating soon.',
    variance: suggestion.variance,
  };
}
