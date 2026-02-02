# Voice Energy Practice App - Product Requirements Document (PRD)

> **Purpose**: Document all features, measurement methods, and accuracy improvement opportunities.
> **Last Updated**: 2026-02-02

---

## 1. App Overview

### 1.1 Purpose
A Vietnamese-to-English speaking practice app that measures and scores voice energy, fluency, and delivery quality in real-time. Users see a Vietnamese sentence, speak the English translation, and receive feedback on their vocal performance.

### 1.2 Target Users
- Vietnamese learners practicing English pronunciation
- Users who want to improve speaking confidence and energy

### 1.3 Core User Flow
1. User sees Vietnamese sentence prompt
2. User taps record button
3. Camera + audio recording begins (fullscreen mode)
4. Real-time energy feedback via visual meter + VAD indicator
5. User stops recording
6. Audio is analyzed across 5 metrics
7. Results displayed with overall score + detailed breakdown

---

## 2. Feature Map

| Feature | File Location | Purpose |
|---------|---------------|---------|
| Sentence Bank | `src/hooks/useSentences.ts` | Fetch random Vietnamese/English pairs from DB |
| Audio Recording | `src/hooks/useEnhancedAudioRecorder.ts` | Capture audio + VAD metrics |
| Voice Activity Detection | `src/hooks/useVAD.ts`, `useEnhancedAudioRecorder.ts` | ML-based speech detection |
| Real-time Energy Meter | `src/components/EnergyMeter.tsx` | Visual feedback during recording |
| Audio Analysis | `src/lib/audioAnalysis.ts` | Score calculation for 5 metrics |
| Results Display | `src/components/ResultsView.tsx` | Show scores + detailed metrics |
| Settings | `src/pages/Settings.tsx` | Configure weights + thresholds |
| Camera Feed | `src/components/CameraFeed.tsx` | Show user video during practice |

---

## 3. Measurement Metrics - Detailed Analysis

### 3.1 Volume / Voice Power (ENERGY)
**File**: `src/lib/audioAnalysis.ts` → `analyzeVolume()`

**What it measures**: Average loudness of the recording

**Current Method**:
```typescript
// Calculate RMS (Root Mean Square)
let sum = 0;
for (let i = 0; i < audioBuffer.length; i++) {
  sum += audioBuffer[i] * audioBuffer[i];
}
const rms = Math.sqrt(sum / audioBuffer.length);

// Convert to decibels
const db = 20 * Math.log10(Math.max(rms, 1e-10));
```

**Scoring Logic**:
| dB Range | Score |
|----------|-------|
| ≥ ideal (-15dB) | 100 → 70 (tapers toward max) |
| ≥ min (-35dB) | 70 → 100 (linear scale) |
| < min | 0 → 70 (exponential drop) |

**Default Thresholds**:
- Min: -35 dB (too quiet)
- Ideal: -15 dB (perfect)
- Max: 0 dB (too loud)
- Weight: 40%

**✅ Accuracy Assessment**: Good - RMS→dB is standard audio measurement
**🔧 Improvement Opportunities**:
- Add LUFS normalization (broadcast standard)
- Exclude silence periods from average (use VAD segments)
- Add dynamic range analysis

---

### 3.2 Speech Rate / Tempo (FLUENCY)
**File**: `src/lib/audioAnalysis.ts` → `analyzeSpeechRate()`, `detectSyllablesFromPeaks()`

**What it measures**: Words per minute (estimated)

**Current Method**:
```typescript
// Energy-based peak detection for syllable counting
const frameSize = Math.floor(sampleRate * 0.02); // 20ms frames
const energies: number[] = [];

// Calculate frame energies
for (let i = 0; i < audioBuffer.length - frameSize; i += hopSize) {
  let energy = 0;
  for (let j = 0; j < frameSize; j++) {
    energy += audioBuffer[i + j] * audioBuffer[i + j];
  }
  energies.push(energy / frameSize);
}

// Find peaks (local maxima above 15% of max energy)
const threshold = Math.max(...energies) * 0.15;
// Count peaks as syllables

// Convert: WPM = (syllables / 1.5) / duration * 60
```

**Scoring Logic**:
| WPM Range | Score |
|-----------|-------|
| 90-150 WPM | 70 → 100 |
| 150-220 WPM | 100 → 70 |
| < 90 | Exponential drop |
| > 220 | Exponential drop |

**Default Thresholds**:
- Min: 90 WPM (too slow)
- Ideal: 150 WPM (perfect)
- Max: 220 WPM (too fast)
- Weight: 40%

**⚠️ Accuracy Assessment**: APPROXIMATE - Energy peaks ≠ syllables
**🔧 Improvement Opportunities**:
1. **Use VAD segments** - Only count peaks during actual speech
2. **Add Speech-to-Text** - Get actual word count (ElevenLabs, Whisper, Deepgram)
3. **Spectral flux** - Detect syllable boundaries via spectral changes
4. **Onset detection** - More sophisticated syllable onset detection

---

### 3.3 Acceleration / Energy Boost (DYNAMICS)
**File**: `src/lib/audioAnalysis.ts` → `analyzeAcceleration()`

**What it measures**: Whether energy/pace increases over the recording

**Current Method**:
```typescript
// Split audio in half
const midpoint = Math.floor(audioBuffer.length / 2);
const segment1 = audioBuffer.slice(0, midpoint);
const segment2 = audioBuffer.slice(midpoint);

// Analyze each half
const vol1 = analyzeVolume(segment1);
const vol2 = analyzeVolume(segment2);
const rate1 = analyzeSpeechRate(segment1);
const rate2 = analyzeSpeechRate(segment2);

// Check if accelerating
const isAccelerating = (vol2.averageDb - vol1.averageDb > 0) || 
                       (rate2.wordsPerMinute - rate1.wordsPerMinute > 5);

// Score based on positive change
const accelerationFactor = Math.max(0, volumeIncrease * 2 + rateIncrease * 0.5);
const score = 50 + accelerationFactor; // Capped at 100
```

**Default Thresholds**:
- Min: 0%
- Ideal: 50%
- Max: 100%
- Weight: 5%

**✅ Accuracy Assessment**: Simple but functional
**🔧 Improvement Opportunities**:
- Use more segments (4-5 instead of 2)
- Weight later segments more heavily
- Consider pitch contour for emotional engagement

---

### 3.4 Response Time / Spark (READINESS)
**File**: `src/lib/audioAnalysis.ts` → `analyzeResponseTime()`

**What it measures**: Time from recording start to first speech

**Current Method**:
```typescript
// Find first sample above noise floor
const noiseFloor = 0.01;
let firstSoundSample = 0;

for (let i = 0; i < audioBuffer.length; i++) {
  if (Math.abs(audioBuffer[i]) > noiseFloor) {
    firstSoundSample = i;
    break;
  }
}

const responseTimeMs = (firstSoundSample / sampleRate) * 1000;
```

**Scoring Logic**:
| Response Time | Score |
|---------------|-------|
| ≤ 200ms | 100 |
| 200-2000ms | 100 → 50 (linear) |
| > 2000ms | 50 → 0 (exponential) |

**Default Thresholds**:
- Min: 2000ms (too slow)
- Ideal: 200ms (perfect)
- Max: 0ms (instant)
- Weight: 5%

**⚠️ Accuracy Assessment**: Basic - fixed threshold, no noise adaptation
**🔧 Improvement Opportunities**:
1. **Use VAD** - More accurate speech onset detection vs noise
2. **Adaptive noise floor** - Calculate from first 100ms of silence
3. **Consider VAD's `onSpeechStart` timestamp** - Already available!

---

### 3.5 Pause Management / Flow (FLUIDITY)
**File**: `src/lib/audioAnalysis.ts` → `analyzePauses()`

**What it measures**: Ratio of silence to speech

**Current Method**:
```typescript
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

const pauseRatio = silentFrames / totalFrames;
```

**Scoring Logic**:
- pauseRatio ≤ 10%: Score = 100
- pauseRatio > 10%: Score drops toward 0 based on max ratio (2.71)

**Default Thresholds**:
- Min: 0 (no pause penalty)
- Ideal: 0
- Max: 2.71 (e ≈ natural log base)
- Weight: 10%

**⚠️ Accuracy Assessment**: Basic energy threshold, no ML
**🔧 Improvement Opportunities**:
1. **Use VAD metrics directly** - `speechRatio` already calculated!
2. **Distinguish pause types** - Hesitation vs natural breath pauses
3. **Penalize long pauses** - Single 3-second pause vs multiple 0.5s pauses

---

## 4. Voice Activity Detection (VAD) System

### 4.1 Implementation
**Files**: `src/hooks/useVAD.ts`, `src/hooks/useEnhancedAudioRecorder.ts`

**Technology**: Silero VAD via `@ricky0123/vad-web`

**What it provides**:
```typescript
interface VADMetrics {
  speechSegments: SpeechSegment[];  // [{start, end, duration}, ...]
  totalSpeechTime: number;          // ms of actual speech
  totalSilenceTime: number;         // ms of silence
  speechRatio: number;              // 0-1, speech / total
  isSpeaking: boolean;              // real-time flag
  speechProbability: number;        // 0-1, ML confidence
}
```

**Current Usage**:
- ✅ Real-time `isSpeaking` indicator in EnergyMeter
- ✅ `speechProbability` for visual feedback
- ❌ **NOT YET** used in audio analysis scoring!

### 4.2 Integration Opportunities
| VAD Metric | Could Improve | How |
|------------|---------------|-----|
| `speechSegments` | Speech Rate | Count peaks only within speech segments |
| `speechRatio` | Pause Management | Direct replacement for frame-based calculation |
| `totalSpeechTime` | Volume | Normalize volume by speech time only |
| First segment `start` | Response Time | ML-based speech onset |

---

## 5. Real-time Feedback System

### 5.1 Audio Level Detection
**File**: `src/hooks/useEnhancedAudioRecorder.ts` → `updateAudioLevel()`

**Method**:
```typescript
// Get time-domain data
const dataArray = new Uint8Array(analyzerRef.current.fftSize);
analyzerRef.current.getByteTimeDomainData(dataArray);

// Calculate RMS
let sumSquares = 0;
for (let i = 0; i < dataArray.length; i++) {
  const normalized = (dataArray[i] - 128) / 128;
  sumSquares += normalized * normalized;
}
const rms = Math.sqrt(sumSquares / dataArray.length);

// Apply sensitivity + smoothing
const boostedLevel = Math.min(rms * sensitivity, 1.0);
audioLevel = previousLevel * 0.3 + boostedLevel * 0.7;
```

**Update Rate**: 50ms (20 FPS)

### 5.2 Energy Meter Display
**File**: `src/components/EnergyMeter.tsx`

**Thresholds** (configurable in Settings):
- Quiet: < 30% → 😴 "Quiet"
- Good: 30-60% → 🔥 "Good!"
- Powerful: > 60% → ⚡ "Powerful!"

**VAD Integration**:
- Shows "Speaking" badge when `isSpeaking` is true
- Uses `speechProbability` for more accurate level display

---

## 6. Configuration System

### 6.1 Database Tables

**metric_settings** (per-metric configuration):
| Column | Type | Purpose |
|--------|------|---------|
| metric_id | text | volume, speechRate, acceleration, responseTime, pauseManagement |
| weight | int | 0-100, must sum to 100 |
| min_threshold | numeric | Lower bound |
| ideal_threshold | numeric | Perfect value |
| max_threshold | numeric | Upper bound |
| method | text | Optional (e.g., "energy-peaks" for speechRate) |

**display_settings** (real-time feedback):
| Column | Type | Default |
|--------|------|---------|
| sensitivity | numeric | 2.5 |
| quiet_threshold | numeric | 0.3 |
| good_threshold | numeric | 0.6 |
| powerful_threshold | numeric | 0.8 |

### 6.2 Settings Flow
1. Settings saved to Supabase tables
2. Also saved to localStorage for `audioAnalysis.ts` (runs client-side)
3. Real-time components read from localStorage on each render

---

## 7. Accuracy Improvement Roadmap

### Priority 1: Use VAD Metrics in Analysis ⭐
**Impact**: High | **Effort**: Low

Already have VAD data, just need to use it:
```typescript
// In analyzeAudioAsync, receive VAD metrics
export async function analyzeAudioAsync(
  audioBuffer: Float32Array,
  sampleRate: number,
  audioBase64?: string,
  vadMetrics?: VADMetrics  // NEW
): Promise<AnalysisResult>
```

- **Response Time**: Use first segment's `start` time
- **Pause Management**: Use `speechRatio` directly
- **Speech Rate**: Only analyze audio within speech segments

### Priority 2: Improve Speech Rate ⭐
**Impact**: High | **Effort**: Medium

Options:
1. **Segment-aware peak detection** - Only count peaks in VAD segments
2. **Spectral flux** - Detect syllables via frequency changes
3. **Add STT** - Whisper API / Deepgram for actual word count

### Priority 3: Add Transcription Verification
**Impact**: Medium | **Effort**: Medium

- Verify user actually said the correct translation
- Use Whisper/Deepgram to transcribe
- Compare with expected English sentence
- Add "Accuracy" metric

### Priority 4: Pitch/Intonation Analysis
**Impact**: Medium | **Effort**: High

- Detect pitch contour (fundamental frequency)
- Measure pitch variation (monotone vs expressive)
- Compare to native speaker patterns

---

## 8. Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Index.tsx                            │
│  (Main page orchestrating recording, display, and results)  │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  useSentences   │  │ useEnhanced     │  │  CameraFeed     │
│  (DB → prompts) │  │ AudioRecorder   │  │  (Video display)│
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
           ┌─────────────────┐  ┌─────────────────┐
           │ MediaRecorder   │  │   Silero VAD    │
           │ (audio capture) │  │ (speech detect) │
           └─────────────────┘  └─────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    ┌─────────────────┐
                    │  audioAnalysis  │
                    │  (5 metrics)    │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   ResultsView   │
                    │  (score display)│
                    └─────────────────┘
```

---

## 9. File Reference

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/lib/audioAnalysis.ts` | Core scoring logic | `analyzeVolume`, `analyzeSpeechRate`, `analyzeAcceleration`, `analyzeResponseTime`, `analyzePauses`, `analyzeAudioAsync` |
| `src/hooks/useEnhancedAudioRecorder.ts` | Recording + VAD integration | `startRecording`, `stopRecording`, `getAudioLevel`, `getSpeechProbability` |
| `src/hooks/useVAD.ts` | Standalone VAD hook | `startListening`, `stopListening`, `getSpeechRatio` |
| `src/hooks/useAudioRecorder.ts` | Legacy recorder (backup) | Same as enhanced, minus VAD |
| `src/lib/energyCalculator.ts` | Emoji/label mapping | `getEnergyIcon`, `getEnergyLevel`, `getGlowClass` |
| `src/components/EnergyMeter.tsx` | Real-time visual feedback | Uses `audioLevel` + `speechProbability` |
| `src/components/ResultsView.tsx` | Score display | Maps `AnalysisResult` to UI cards |
| `src/pages/Settings.tsx` | Configuration UI | Weights, thresholds, display settings |
| `src/hooks/useSentences.ts` | Sentence management | Fetches from Supabase `sentences` table |

---

## 10. Testing Checklist

When validating accuracy improvements:

- [ ] Record with **known WPM** (use metronome) → verify speechRate
- [ ] Record with **varying volume** → verify volume scoring
- [ ] Record with **intentional pauses** → verify pause detection
- [ ] Record after **delay** → verify response time
- [ ] Record with **increasing energy** → verify acceleration
- [ ] Compare **VAD segments** to actual speech timing
- [ ] Test with **background noise** → verify noise rejection

---

*This document should be updated whenever measurement methods change.*
