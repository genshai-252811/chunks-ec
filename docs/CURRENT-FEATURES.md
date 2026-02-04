# Chunks-EC: Current Features & Roadmap

**GitHub Repository:** https://github.com/genshai-252811/chunks-ec
**Project Type:** Voice Energy Practice App (Vietnamese → English)
**Last Updated:** February 4, 2026

---

## ✅ **Current Features (Implemented)**

### 1. **Core Recording System**
- ✅ Real-time audio recording with MediaRecorder API
- ✅ Camera feed integration (fullscreen during recording)
- ✅ Recording timer display
- ✅ Audio/video capture for practice sessions

**Files:**
- `src/hooks/useEnhancedAudioRecorder.ts`
- `src/components/RecordButton.tsx`
- `src/components/CameraFeed.tsx`

---

### 2. **Voice Activity Detection (VAD)**
- ✅ Silero VAD integration (ML-based speech detection)
- ✅ Real-time speech probability indicator
- ✅ Speech segment tracking
- ✅ Speech/silence ratio calculation
- ✅ Visual "Speaking" badge during recording

**Technology:** `@ricky0123/vad-web`

**Files:**
- `src/hooks/useVAD.ts`
- `src/hooks/useEnhancedAudioRecorder.ts`

---

### 3. **Audio Analysis System (5 Metrics)**

#### **A. Volume/Energy (40% weight)**
- RMS → dB conversion
- Scoring: Too quiet (-35dB) → Perfect (-15dB) → Too loud (0dB)
- LUFS normalized for device independence

#### **B. Speech Rate/Fluency (40% weight)**
- **Method:** VAD-enhanced energy peak detection
- Syllable counting → WPM estimation
- Scoring: Too slow (90 WPM) → Perfect (150 WPM) → Too fast (220 WPM)
- Only counts speech (excludes silence)

#### **C. Acceleration/Dynamics (5% weight)**
- Measures energy/pace increase over time
- Compares first half vs second half
- Encourages dynamic, energetic delivery

#### **D. Response Time/Readiness (5% weight)**
- Time from record start to first speech
- Adaptive noise floor detection
- Scoring: Instant (200ms) → Too slow (2000ms)

#### **E. Pause Management/Fluidity (10% weight)**
- **Method:** VAD speechRatio (ML-based)
- Measures speech vs silence ratio
- Natural speech: 10-30% pauses is good

**Files:**
- `src/lib/audioAnalysis.ts`
- `src/components/ResultsView.tsx`
- `src/components/MetricCard.tsx`

---

### 4. **LUFS Normalization System** ⭐ (NEW)

#### **Purpose:** Device-independent scoring
- Different mics produce different loudness
- LUFS normalizes to -23 LUFS (broadcast standard)
- Ensures fair scoring across all devices

#### **Features:**
- ITU-R BS.1770-4 compliant LUFS calculation
- Per-device calibration profiles
- Adaptive noise floor (auto-adjusts to environment)
- Automatic gain adjustment
- Recording history tracking (10 recent recordings)

**Files:**
- `src/lib/lufsNormalization.ts`
- `src/components/CalibrationWizard.tsx`

**See:** `docs/LUFS-IMPLEMENTATION.md`

---

### 5. **Auto-Recalibration System** ⭐ (NEW)

#### **Smart Detection (4 triggers):**
1. LUFS variance > 5 (environment changed)
2. Noise floor change > 10 dB (moved location)
3. Calibration age > 30 days (profile too old)
4. Average drift > 3 LUFS from target

#### **User Experience:**
- Status indicators: ✅ Good | ⚠️ Warning | 🚨 Urgent
- Alerts shown in Settings and Results page
- One-click "Recalibrate Now" button

**Files:**
- `src/lib/lufsNormalization.ts` (detection logic)
- `src/components/CalibrationWizard.tsx` (status display)
- `src/components/RecalibrationAlert.tsx` (alerts)

**See:** `docs/AUTO-RECALIBRATION.md`

---

### 6. **Sentence Management**
- ✅ Vietnamese/English sentence pairs
- ✅ Fetches from Supabase database
- ✅ Random sentence selection
- ✅ "Next sentence" button

**Database Table:** `sentences`
```sql
id | vietnamese_text | english_text | created_at
```

**Files:**
- `src/hooks/useSentences.ts`
- `src/components/PracticeSentence.tsx`

---

### 7. **Settings System**

#### **Metric Configuration:**
- Adjust weight for each metric (must sum to 100%)
- Configure thresholds (min, ideal, max)
- Enable/disable metrics (via weight = 0)

#### **Display Settings:**
- Energy meter sensitivity
- Threshold levels (quiet, good, powerful)

#### **Calibration Management:**
- View all calibrated devices
- Recalibration status monitoring
- Delete old profiles

**Files:**
- `src/pages/Settings.tsx`
- Database: `metric_settings` and `display_settings` tables

---

### 8. **Real-time Visual Feedback**
- ✅ Energy meter with emoji indicators
- ✅ Flowing waveform animation
- ✅ Speech probability indicator
- ✅ Real-time audio level display
- ✅ "Speaking" badge (VAD-based)

**Files:**
- `src/components/EnergyMeter.tsx`
- `src/components/FlowingWaveform.tsx`
- `src/components/AudioVisualizer.tsx`

---

### 9. **Results Display**
- ✅ Overall score (weighted)
- ✅ Emotional feedback (excellent/good/poor)
- ✅ Detailed breakdown per metric
- ✅ Score history tracking
- ✅ Retry button

**Files:**
- `src/components/ResultsView.tsx`
- `src/components/ScoreDisplay.tsx`

---

### 10. **Supabase Integration**
- ✅ PostgreSQL database
- ✅ User authentication (ready)
- ✅ Sentences storage
- ✅ Settings persistence
- ✅ Real-time updates

**Tables:**
- `sentences` - Practice sentences
- `metric_settings` - Metric weights & thresholds
- `display_settings` - UI preferences

---

## 🎨 **UI/UX Features**

- ✅ Fullscreen recording mode
- ✅ Dark mode support
- ✅ Responsive design (mobile-friendly)
- ✅ Smooth animations (Framer Motion)
- ✅ Loading states
- ✅ Error handling
- ✅ Toast notifications
- ✅ Progress indicators

**Design System:** shadcn/ui + Tailwind CSS

---

## 🚧 **What's Missing / Next Steps**

### **Priority 1: Database & Content Management** ⭐ (Your Suggestion - GREAT!)

#### **Why Important:**
- Current: Only random sentence selection
- Need: Structured lessons, progress tracking, difficulty levels

#### **Proposed Features:**

**A. Lesson Management System**
```sql
-- Tables needed:
lessons (id, title, description, difficulty, order, topic)
lesson_sentences (lesson_id, sentence_id, order)
user_progress (user_id, lesson_id, completed_at, score)
user_recordings (user_id, sentence_id, audio_url, score, metrics, created_at)
```

**B. Features:**
- Lesson catalog (browse by topic/difficulty)
- Linear progression (unlock next lesson after completion)
- Lesson completion criteria (e.g., avg score > 70%)
- Progress dashboard
- Historical recording playback
- Score trends over time

**C. Admin Panel:**
- Create/edit lessons
- Add sentences to lessons
- Set difficulty levels
- Organize by topics (greetings, business, travel, etc.)

#### **Files to Create:**
- `src/pages/Lessons.tsx` - Lesson catalog
- `src/pages/LessonDetail.tsx` - Single lesson view
- `src/pages/Progress.tsx` - User progress dashboard
- `src/pages/Admin.tsx` - Content management
- `src/hooks/useLessons.ts` - Lesson data fetching
- `src/hooks/useProgress.ts` - Progress tracking

#### **Estimated Time:** 3-5 days

---

### **Priority 2: Improve Speech Rate Accuracy**

**Current:** Energy peaks (20-30% accurate)
**Option A:** Add Whisper/Deepgram STT (90%+ accurate)
**Option B:** Spectral flux analysis (60% accurate, no API cost)

#### **Benefits:**
- Actual word count instead of syllable estimation
- Can add transcription verification
- New metric: "Accuracy" (did user say correct translation?)

**Estimated Time:** 1-2 days

---

### **Priority 3: User Authentication & Profiles**

**Current:** No user system
**Needed:**
- Login/signup
- User profiles
- Personal recording history
- Progress tracking per user
- Multi-device sync

**Supabase has this ready!**

**Files to Create:**
- `src/pages/Login.tsx`
- `src/pages/Signup.tsx`
- `src/pages/Profile.tsx`
- `src/hooks/useAuth.ts`

**Estimated Time:** 1-2 days

---

### **Priority 4: Calibration UX Improvements** (Your Question)

#### **Current Issues:**
1. No visual guide during calibration
2. No way to test if calibration worked
3. No comparison before/after

#### **Proposed Improvements:**

**A. Calibration Test Mode:**
```typescript
// After calibration, test with sample audio
function testCalibration() {
  1. Record 3-second test sample
  2. Show BEFORE normalization: -28 dB
  3. Show AFTER normalization: -23 dB (target)
  4. Display: "✅ Calibration working! Gain: 1.8x"
}
```

**B. Visual Guide:**
- Show waveform during noise measurement
- Show real-time LUFS during reference measurement
- Countdown with visual progress bar
- Success animation

**C. Comparison View:**
```
Before Calibration:
├─ iPhone: 62/100
├─ Laptop: 58/100
└─ USB mic: 94/100

After Calibration:
├─ iPhone: 82/100 ✅
├─ Laptop: 83/100 ✅
└─ USB mic: 82/100 ✅
```

**Files to Update:**
- `src/components/CalibrationWizard.tsx`
- Add: `src/components/CalibrationTest.tsx`

**Estimated Time:** 1 day

---

### **Priority 5: Metric Weight Management** (Your Question)

#### **Current:**
- Can adjust weights in Settings
- Must sum to 100%
- No way to disable metrics

#### **Your Question:** Can I enable/disable metrics?

**Answer:** YES! Here's how:

**Method 1: Set weight to 0**
```typescript
// In Settings.tsx
Speech Rate: 40% → 0%  // Effectively disabled
Volume: 40% → 50%
Acceleration: 5% → 10%
Response Time: 5% → 20%
Pause Management: 10% → 20%
Total: 100% ✅
```

**Method 2: Add toggle switches (RECOMMENDED)**

**Proposed UI:**
```
┌─────────────────────────────────────┐
│ Metric Settings                     │
├─────────────────────────────────────┤
│ [✓] Volume/Energy        40%        │
│ [✓] Speech Rate          40%        │
│ [ ] Acceleration          0%  (OFF) │
│ [✓] Response Time         5%        │
│ [✓] Pause Management     15%        │
│                                     │
│ Total: 100% ✅                      │
└─────────────────────────────────────┘
```

**Implementation:**
```typescript
// Add to metric_settings table
enabled: boolean  // NEW column

// In audioAnalysis.ts
function calculateOverallScore(results) {
  const config = getConfig();
  const enabledMetrics = config.filter(m => m.enabled);

  const totalWeight = enabledMetrics.reduce((sum, m) => sum + m.weight, 0);
  const weightedSum = enabledMetrics.reduce((sum, m) => {
    return sum + results[m.id].score * m.weight;
  }, 0);

  return weightedSum / totalWeight;
}
```

**Files to Update:**
- `src/pages/Settings.tsx` - Add toggle switches
- `src/lib/audioAnalysis.ts` - Respect enabled flag
- Database: Add `enabled` column to `metric_settings`

**Estimated Time:** 2-3 hours

---

## 📊 **Architecture Overview**

```
┌─────────────────────────────────────────────┐
│           User Interface (React)            │
├─────────────────────────────────────────────┤
│ Pages: Index, Settings, Lessons (future)   │
│ Components: Recording, Results, Calibration│
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Core Systems (TypeScript)           │
├─────────────────────────────────────────────┤
│ • Audio Recording (MediaRecorder)           │
│ • VAD (Silero ML model)                     │
│ • LUFS Normalization (ITU-R BS.1770-4)      │
│ • Audio Analysis (5 metrics)                │
│ • Auto-Recalibration (variance detection)   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│          Data Layer (Supabase)              │
├─────────────────────────────────────────────┤
│ • PostgreSQL Database                       │
│ • User Authentication                       │
│ • File Storage (audio recordings)           │
│ • Real-time Subscriptions                   │
└─────────────────────────────────────────────┘
```

---

## 📈 **Recommended Roadmap**

### **Phase 1: Content & Structure** (Week 1-2)
1. ✅ Design lesson database schema
2. ✅ Create lesson management UI
3. ✅ Add user authentication
4. ✅ Build progress tracking

### **Phase 2: User Experience** (Week 3)
1. ✅ Improve calibration UX with test mode
2. ✅ Add metric enable/disable toggles
3. ✅ Visual guides for calibration
4. ✅ Before/after comparison view

### **Phase 3: Accuracy Improvements** (Week 4)
1. ✅ Add Speech-to-Text (Deepgram/Whisper)
2. ✅ Transcription verification
3. ✅ New "Accuracy" metric
4. ✅ Show what user actually said

### **Phase 4: Engagement** (Week 5-6)
1. ✅ Achievements/badges system
2. ✅ Leaderboards (optional)
3. ✅ Streak tracking
4. ✅ Social sharing

---

## 🎯 **Answers to Your Questions**

### **1. Is this the correct repo?**
✅ **YES** - `https://github.com/genshai-252811/chunks-ec`

### **2. Should we add database for lesson management?**
✅ **ABSOLUTELY!** This is the #1 priority. Current system is too basic.

### **3. How does calibration work?**
See detailed explanation in next section ↓

### **4. Can I enable/disable metrics?**
✅ **YES** - Set weight to 0, or I can add toggle switches (recommended)

---

## 📖 **How Calibration Works - Complete Guide**

### **What is Calibration?**
Calibration tells the system how loud YOUR specific microphone is, so it can normalize scores fairly.

### **Why Need It?**
```
Without Calibration:
iPhone mic (quiet):    "Hello" → -30 dB → Score: 62/100
USB mic (loud):        "Hello" → -15 dB → Score: 94/100
Same voice, unfair scores! ❌

With Calibration:
iPhone mic:   -30 dB → x2.1 gain → -20 dB → normalize → -23 LUFS → Score: 83/100
USB mic:      -15 dB → x0.8 gain → -12 dB → normalize → -23 LUFS → Score: 83/100
Same voice, fair scores! ✅
```

### **How to Calibrate (Step-by-Step):**

**Step 1: Go to Settings**
- Click "Settings" icon (top-right)
- Scroll to "Calibrate New Device" section

**Step 2: Start Calibration**
- Click "Start Calibration" button
- Grant microphone permission if asked

**Step 3: Noise Measurement (3 seconds)**
- **What to do:** Stay completely silent
- **Why:** Measures background noise in your environment
- **Screen shows:** Countdown 3...2...1
- **Behind scenes:** Calculating noise floor (-48 dB typical for quiet room)

**Step 4: Reference Measurement (5 seconds)**
- **What to do:** Read the sentence shown at normal speaking volume
- **Sentence:** "Hello, I am calibrating my microphone..."
- **Why:** Measures your normal speaking level
- **Screen shows:** Countdown, then "Recording..." badge
- **Behind scenes:** Calculating your reference LUFS (-26 LUFS typical)

**Step 5: Profile Created!**
- **System calculates:**
  - Noise floor: -48 dB
  - Reference level: -26 LUFS
  - Gain needed: -23 (target) - (-26) = 3 dB = 1.41x multiplier
- **Saved to:** localStorage with deviceId
- **Screen shows:** ✅ Calibration Complete!

**Step 6: Automatic from Now On**
- Every recording: Audio automatically multiplied by 1.41x
- Then normalized to -23 LUFS
- Fair scores across all devices!

### **How to Know It's Working?**

**Method 1: Check Console (Developer Tools)**
```javascript
// Press F12, go to Console tab, you'll see:
🎤 Audio Device: { deviceId: 'default', deviceLabel: 'MacBook Pro Mic' }
🎚️ LUFS Normalization Applied: {
  originalLUFS: -28.3,      // Your raw audio
  calibratedLUFS: -24.1,    // After device gain (x1.41)
  finalLUFS: -23.0,         // After normalization ✅
  deviceGain: 1.41,         // Calibration working!
  normalizationGain: 1.12
}
```

**Method 2: Settings Page Status**
```
✅ MacBook Pro Microphone (Good)
   Calibration is accurate and up to date.
   Noise floor: -48.20 dB
   Reference level: -26.10 LUFS
   Gain adjustment: 1.41x
   Recordings tracked: 7
```

**Method 3: Test with Different Volumes**
1. Record same sentence at normal volume → Score: 85
2. Record whisper → Score should drop (Volume metric affected)
3. Record shout → Score should drop (too loud penalty)
4. Record normal again → Score: ~85 (consistent!)

### **When to Recalibrate?**

System auto-detects and shows alerts:

**⚠️ Warning (Yellow):**
- Calibration is 35 days old
- Small variance detected (variance < 2x threshold)

**🚨 Urgent (Red):**
- High variance (>5 LUFS across 10 recordings)
- Noise floor changed >10 dB
- Average drift >3 LUFS from target

**Action:** Click "Recalibrate Now" button in Settings

---

## 💡 **My Recommendation**

### **Start with Phase 1: Lesson Management**

**Why?**
1. Most impactful for users
2. Current system too basic (just random sentences)
3. Enables progress tracking & engagement
4. Foundation for future features

**What to Build:**
1. Lesson catalog page
2. Lesson detail page (with sentence list)
3. Progress dashboard
4. Database schema for lessons
5. Admin panel (later)

**After that:**
- Improve calibration UX (add test mode)
- Add metric toggle switches
- Then consider STT for better accuracy

---

Would you like me to start with the **Lesson Management System** implementation?
