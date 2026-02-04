# Chunks-EC: Latest Updates & Feature Roadmap
**Date:** February 4, 2026
**Last Commits:** `a7307d1` → `6665bca` (pulled successfully)

---

## 🆕 **What's NEW (Just Added)**

### 1. **User Authentication System** ✅
**Commit:** `38b4b9a - Integrate auth and store results`

**Features Added:**
- ✅ Sign up / Sign in / Sign out
- ✅ User profiles with display names
- ✅ Session management
- ✅ Profile auto-creation on signup

**New Files:**
- `src/hooks/useAuth.ts` - Complete auth hook
- `src/pages/Auth.tsx` - Login/signup page
- `src/hooks/usePracticeResults.ts` - Results persistence

**Database Tables:**
```sql
profiles (
  id, user_id, display_name,
  created_at, updated_at
)

practice_results (
  id, user_id, sentence_id, score,
  duration_seconds, energy_score, clarity_score,
  pace_score, volume_avg, speech_ratio, created_at
)
```

**Row Level Security:** ✅ Users can only see/edit their own data

---

### 2. **Practice Results Persistence** ✅
**What it does:**
- Automatically saves every recording result to database
- Stores all 5 metric scores
- Tracks duration, volume, speech ratio
- Links results to sentences
- User-specific history (via RLS)

**Functions:**
```typescript
saveResult(analysisResult, sentenceId, duration)
fetchResults(limit = 20) // Get user's history
getStats() // Calculate avg/best/total stats
```

**Stats Available:**
- Total sessions
- Average score
- Best score
- Total practice time

---

### 3. **UI Improvements** ✅

**A. Logo Added** (`6665bca`)
- Logo in header
- Better branding

**B. Space/Tap to Record** (`26c8adc`)
- Press Space bar to start/stop recording
- Tap anywhere on screen during idle

**C. Camera Delay Fixed** (`852d84d`)
- Reduced lag on record start

**D. Energy Meter Updates**
- Visual improvements
- Better responsiveness

---

## 📊 **Complete Feature Matrix**

### **Core Systems:**
| Feature | Status | Location |
|---------|--------|----------|
| Audio Recording | ✅ Working | `useEnhancedAudioRecorder.ts` |
| VAD (ML Speech Detection) | ✅ Working | `useVAD.ts` |
| LUFS Normalization | ✅ Working | `lufsNormalization.ts` |
| Auto-Recalibration | ✅ Working | `CalibrationWizard.tsx` |
| 5 Metrics Analysis | ✅ Working | `audioAnalysis.ts` |
| User Auth | ✅ NEW | `useAuth.ts` |
| Results Storage | ✅ NEW | `usePracticeResults.ts` |

### **User Features:**
| Feature | Status |
|---------|--------|
| Practice with random sentences | ✅ Working |
| Real-time visual feedback | ✅ Working |
| Detailed score breakdown | ✅ Working |
| Device calibration | ✅ Working |
| Metric weight adjustment | ✅ Working |
| User accounts | ✅ NEW |
| Result history (database) | ✅ NEW |
| View past recordings | ❌ Missing |
| Progress dashboard | ❌ Missing |
| Lesson system | ❌ Missing |

---

## 🚧 **What's Still MISSING (Priority Order)**

### **Priority 1: Progress Dashboard** ⭐⭐⭐
**Why:** Users can now save results, but can't SEE their history/progress

**What to Build:**
```typescript
// New page: src/pages/Progress.tsx
- Chart showing score trends over time
- Stats cards (avg, best, total time, total sessions)
- List of recent recordings
- Filter by date range
- Play back audio recordings (if stored)
```

**Database Extension:**
```sql
-- Add audio_url column to practice_results
ALTER TABLE practice_results
ADD COLUMN audio_url TEXT;

-- Store audio blobs in Supabase Storage
```

**Features:**
1. **Score Trend Chart** (last 7/30 days)
2. **Stats Summary:**
   - Total sessions: 45
   - Average score: 78/100
   - Best score: 92/100
   - Total practice time: 2h 15m
3. **Recording History Table:**
   - Date/time
   - Score
   - Sentence practiced
   - Duration
   - View details / Replay audio

**Estimated Time:** 2-3 days

---

### **Priority 2: Lesson Management System** ⭐⭐⭐
**Why:** Still using random sentences - needs structure

**What to Build:**
```sql
-- New tables:
lessons (
  id, title, description, difficulty,
  topic, order, created_at
)

lesson_sentences (
  lesson_id, sentence_id, order
)

user_lesson_progress (
  user_id, lesson_id, completed_at,
  best_score, attempts
)
```

**Pages to Create:**
1. **Lessons Catalog** (`src/pages/Lessons.tsx`)
   - Browse lessons by topic/difficulty
   - See progress (3/10 completed)
   - Filter: Beginner / Intermediate / Advanced

2. **Lesson Detail** (`src/pages/LessonDetail.tsx`)
   - List of sentences in lesson
   - Progress bar (5/10 sentences)
   - Start/continue practice
   - Unlock next lesson after completion

3. **Topics:**
   - Greetings & Introductions
   - Daily Conversations
   - Business English
   - Travel & Tourism
   - Food & Restaurants
   - Shopping
   - etc.

**Unlock System:**
- Must complete Lesson 1 to unlock Lesson 2
- Completion criteria: Avg score > 70% on all sentences
- Badge system (optional)

**Estimated Time:** 4-5 days

---

### **Priority 3: Audio Playback** ⭐⭐
**Why:** Users want to hear their past recordings

**What to Build:**
```typescript
// Store audio in Supabase Storage
const uploadAudio = async (audioBlob, userId, sessionId) => {
  const filename = `${userId}/${sessionId}.webm`;

  const { data, error } = await supabase.storage
    .from('recordings')
    .upload(filename, audioBlob);

  return data?.path;
};

// Get playback URL
const getAudioUrl = (path) => {
  return supabase.storage
    .from('recordings')
    .getPublicUrl(path).data.publicUrl;
};
```

**UI:**
- Play button in results history
- Waveform visualization
- Download option
- Compare with reference audio (future)

**Storage Limits:**
- Free tier: 1GB
- Consider cleanup policy (delete after 30 days?)

**Estimated Time:** 1-2 days

---

### **Priority 4: Better Calibration UX** ⭐
**Why:** Based on your question - want to see/adjust manually

**What to Build:**

**A. Calibration Testing Mode**
```typescript
// Test calibration after completion
function CalibrationTest() {
  return (
    <div>
      <h3>Test Your Calibration</h3>
      <p>Record 3 seconds, we'll show before/after</p>

      <Button onClick={recordTest}>Test Now</Button>

      {testResult && (
        <div>
          Before: {testResult.originalLUFS} LUFS
          After: {testResult.finalLUFS} LUFS (target: -23)
          Status: {testResult.finalLUFS >= -24 && testResult.finalLUFS <= -22
            ? '✅ Perfect!'
            : '⚠️ Needs adjustment'}
        </div>
      )}
    </div>
  );
}
```

**B. Manual Gain Adjustment**
```typescript
// Add slider to Settings
<div>
  <Label>Manual Gain Adjustment</Label>
  <Slider
    value={[profile.gainAdjustment]}
    onValueChange={([val]) => updateGain(val)}
    min={0.5}
    max={3.0}
    step={0.1}
  />
  <span>{profile.gainAdjustment}x</span>
</div>
```

**C. Visual Comparison**
```
Before Calibration:
│     iPhone: ████░░░░░░ 62/100
│    Laptop: ███░░░░░░░ 58/100
│  USB Mic: █████████░ 94/100

After Calibration:
│     iPhone: ████████░░ 83/100 ✅
│    Laptop: ████████░░ 82/100 ✅
│  USB Mic: ████████░░ 83/100 ✅
```

**Estimated Time:** 1 day

---

### **Priority 5: Metric Enable/Disable Toggles** ⭐
**What to Build:**

**UI in Settings:**
```tsx
{metrics.map(metric => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Switch
        checked={metric.enabled}
        onCheckedChange={(checked) =>
          updateMetric(metric.id, { enabled: checked })
        }
      />
      <Label>{metric.label}</Label>
    </div>

    {metric.enabled && (
      <div className="w-32">
        <Input
          type="number"
          value={metric.weight}
          onChange={(e) =>
            updateMetric(metric.id, { weight: Number(e.target.value) })
          }
          min={0}
          max={100}
        />
        <span className="text-xs">%</span>
      </div>
    )}
  </div>
))}

<div className="mt-4">
  Total Weight: {totalWeight}%
  {totalWeight !== 100 && (
    <span className="text-red-500">
      ⚠️ Must equal 100%
    </span>
  )}
</div>
```

**Database:**
```sql
ALTER TABLE metric_settings
ADD COLUMN enabled BOOLEAN DEFAULT true;
```

**Logic:**
```typescript
function calculateOverallScore(results) {
  const enabledMetrics = config.filter(m => m.enabled);
  const totalWeight = enabledMetrics.reduce((sum, m) => sum + m.weight, 0);

  // Recalculate to 100% if needed
  const normalizedMetrics = enabledMetrics.map(m => ({
    ...m,
    normalizedWeight: (m.weight / totalWeight) * 100
  }));

  return weightedSum / totalWeight;
}
```

**Estimated Time:** 2-3 hours

---

### **Priority 6: Admin Panel** ⭐
**What to Build:**

**A. Sentence Management**
- Add/edit/delete sentences
- Bulk import from CSV
- Assign to lessons
- Set difficulty levels

**B. Lesson Builder**
- Create lessons
- Drag-drop sentence ordering
- Set prerequisites
- Preview lesson

**C. User Management**
- View all users
- See user stats
- Reset progress (if needed)

**Auth Check:**
```typescript
// Add admin role to profiles
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;

// Protected route
if (!profile?.is_admin) {
  return <Navigate to="/" />;
}
```

**Estimated Time:** 3-4 days

---

## 🎯 **Recommended Implementation Order**

### **Week 1: User Experience Basics**
1. ✅ **Progress Dashboard** (2-3 days)
   - Score trends chart
   - Stats summary
   - Recording history list
   - This gives immediate value from the new auth system

2. ✅ **Audio Playback** (1-2 days)
   - Store audio in Supabase Storage
   - Play button in history
   - Let users hear their improvement

### **Week 2: Structure & Content**
3. ✅ **Lesson Management** (4-5 days)
   - Database schema
   - Lessons catalog page
   - Lesson detail page
   - Progress tracking
   - Provides structured learning path

### **Week 3: Polish & Admin**
4. ✅ **Calibration UX** (1 day)
   - Test mode
   - Manual adjustment
   - Better feedback

5. ✅ **Metric Toggles** (3 hours)
   - Enable/disable switches
   - Auto-rebalance weights

6. ✅ **Admin Panel** (3-4 days)
   - Sentence management
   - Lesson builder
   - User overview

---

## 📈 **Future Enhancements (Phase 2)**

### **AI-Powered Features:**
1. **Speech-to-Text Integration** (Deepgram/Whisper)
   - Actual word count for accuracy
   - Transcription verification
   - New metric: "Accuracy" (correct translation?)
   - Show what user actually said

2. **Pronunciation Analysis**
   - Phoneme-level feedback
   - Compare to native speakers
   - Highlight mispronounced words

3. **Personalized Recommendations**
   - AI suggests which lesson based on weaknesses
   - "Your speech rate is low - try these lessons"

### **Gamification:**
1. **Achievement System**
   - First recording
   - 7-day streak
   - 100 recordings milestone
   - Perfect score (90+)

2. **Leaderboards** (Optional)
   - Top scores this week
   - Most improved
   - Most dedicated (time spent)

3. **Challenges**
   - Daily practice challenge
   - Speed challenge (maintain 150 WPM)
   - Fluency challenge (< 20% pauses)

### **Social Features:**
1. **Share Results**
   - Share score card on social media
   - "I scored 92/100!"

2. **Teacher Dashboard** (B2B)
   - Assign lessons to students
   - View class progress
   - Provide feedback

3. **Practice Groups**
   - Join with friends
   - See group progress
   - Friendly competition

---

## 💾 **Storage Considerations**

### **Current Usage:**
- Calibration profiles: localStorage (~1KB per profile)
- Practice results: Supabase database (~100 bytes per row)
- Audio recordings: Not stored (only analyzed)

### **With Audio Storage:**
- Average recording: ~50KB (5 seconds, 32kbps)
- 1000 recordings: ~50MB
- Supabase free tier: 1GB storage
- **Recommendation:** Add cleanup policy (keep last 30 days)

### **Optimization:**
```typescript
// Auto-delete old recordings
const cleanupOldRecordings = async (userId) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data } = await supabase
    .from('practice_results')
    .select('audio_url')
    .eq('user_id', userId)
    .lt('created_at', thirtyDaysAgo.toISOString());

  for (const result of data) {
    if (result.audio_url) {
      await supabase.storage
        .from('recordings')
        .remove([result.audio_url]);
    }
  }
};
```

---

## 🎨 **UI/UX Improvements Needed**

### **Navigation:**
Current pages:
- `/` - Practice
- `/settings` - Settings
- `/auth` - Login/Signup (NEW)

**Add:**
- `/progress` - Progress dashboard
- `/lessons` - Lessons catalog
- `/lessons/:id` - Lesson detail
- `/admin` - Admin panel (for admins)

**Bottom Nav Bar:**
```
[ 🏠 Practice ] [ 📚 Lessons ] [ 📊 Progress ] [ ⚙️ Settings ]
```

### **Onboarding Flow:**
1. Welcome screen (first visit)
2. Sign up / Log in
3. Calibrate device (required)
4. Show tutorial (how to use)
5. Start first lesson

### **Empty States:**
- No recordings yet: "Start practicing to see your progress!"
- No lessons completed: "Complete your first lesson"
- No calibration: "Calibrate your device for accurate scores"

---

## 🔐 **Security & Privacy**

### **Already Implemented:**
- ✅ Row Level Security (RLS)
- ✅ User can only see own data
- ✅ Email verification on signup
- ✅ Secure password hashing (Supabase)

### **To Add:**
- **Profile privacy settings**
  - Public profile (opt-in)
  - Hide from leaderboards
- **Data export** (GDPR compliance)
  - Download all recordings
  - Download practice history
- **Account deletion**
  - Delete all data
  - Remove audio files

---

## 📱 **Mobile Optimization**

### **Current Status:**
- Responsive design ✅
- Touch-friendly ✅
- Camera works on mobile ✅

### **Improvements:**
- **PWA (Progressive Web App)**
  - Install as app
  - Offline mode (cache lessons)
  - Push notifications (reminders)

- **Mobile-First Features:**
  - Landscape mode for recording
  - Larger touch targets
  - Simplified nav for small screens

---

## 🚀 **Deployment Checklist**

### **Before Production:**
1. ✅ Set up proper Supabase project (not local)
2. ⬜ Configure environment variables
3. ⬜ Set up custom domain
4. ⬜ Enable SSL
5. ⬜ Add analytics (PostHog/Amplitude)
6. ⬜ Set up error tracking (Sentry)
7. ⬜ Create privacy policy & terms
8. ⬜ Test on multiple devices
9. ⬜ Load testing
10. ⬜ Backup strategy

---

## 🎯 **My Top 3 Recommendations**

### **1. Progress Dashboard** ⭐⭐⭐ (START HERE)
**Why:** Auth is done, results are saved, but users can't see them!
**Impact:** HIGH - Makes auth system useful
**Effort:** 2-3 days

### **2. Lesson System** ⭐⭐⭐
**Why:** Random sentences is too basic for serious learners
**Impact:** HIGH - Structured learning path
**Effort:** 4-5 days

### **3. Calibration UX** ⭐⭐
**Why:** You asked about this - users want to verify/adjust
**Impact:** MEDIUM - Better confidence in system
**Effort:** 1 day

---

## 📝 **Summary**

**What We Have NOW:**
- ✅ Complete audio analysis (5 metrics)
- ✅ LUFS normalization
- ✅ Auto-recalibration
- ✅ User authentication
- ✅ Results persistence
- ✅ VAD enhancement

**What's MOST Important Next:**
1. **Progress Dashboard** - See history/trends
2. **Lesson System** - Structured learning
3. **Audio Playback** - Hear past recordings
4. **Better Calibration UX** - Test & adjust manually

**Total Estimated Time for Top 3:**
- Week 1: Progress Dashboard (3 days) + Audio Playback (2 days)
- Week 2: Lesson System (5 days)
- Week 3: Polish & launch

---

Would you like me to start implementing:
- **A. Progress Dashboard** (recommended first)
- **B. Lesson Management System**
- **C. Calibration UX improvements**
- **D. Metric enable/disable toggles**

Which direction?
