# Auto-Recalibration Feature 🔄

## Overview
Hệ thống tự động phát hiện khi calibration cần được làm mới và đề xuất recalibrate để đảm bảo độ chính xác.

---

## Cách Hoạt Động

### 1. **Tracking System (Tự động)**
Mỗi recording được track:
```javascript
{
  timestamp: 1738507200000,
  originalLUFS: -28.3,      // Audio gốc
  calibratedLUFS: -24.1,    // Sau device gain
  finalLUFS: -23.0,         // Sau normalize
  noiseFloor: -48.2         // Noise môi trường
}
```

Lưu 10 recordings gần nhất để phân tích variance.

### 2. **Detection Triggers (4 điều kiện)**

#### ✅ Trigger 1: LUFS Variance > 5
**Nghĩa là gì?** Âm thanh không ổn định giữa các lần record.

**Nguyên nhân:**
- Đổi vị trí mic (gần/xa miệng)
- Thay đổi volume hệ thống
- Mic bị lỗi/hỏng

**Ví dụ:**
```
Recording 1: -26 LUFS
Recording 2: -28 LUFS
Recording 3: -20 LUFS  ← Chênh lệch lớn!
Recording 4: -19 LUFS
Recording 5: -27 LUFS

Variance = 4.2 LUFS (gần threshold)
```

#### 🟡 Trigger 2: Noise Floor Change > 10 dB
**Nghĩa là gì?** Môi trường thay đổi đáng kể.

**Nguyên nhân:**
- Từ phòng yên tĩnh → nơi ồn ào
- Mở cửa sổ/bật máy lạnh
- Có người nói chuyện xung quanh

**Ví dụ:**
```
Calibration time: -50 dB (phòng yên tĩnh)
Recent recording: -38 dB (cửa sổ mở, xe cộ)

Difference = 12 dB → Cần recalibrate!
```

#### 📅 Trigger 3: Calibration > 30 Days
**Nghĩa là gì?** Profile quá cũ.

**Nguyên nhân:**
- Mic có thể bị drift theo thời gian
- Môi trường thay đổi dần dần
- Best practice: refresh mỗi tháng

**Ví dụ:**
```
Last calibration: 45 days ago
→ "Calibration is 45 days old. Recalibrating ensures optimal accuracy."
```

#### 📉 Trigger 4: Average Drift > 3 LUFS
**Nghĩa là gì?** Kết quả bị lệch khỏi target (-23 LUFS).

**Nguyên nhân:**
- Device gain không còn chính xác
- Hardware thay đổi
- System audio settings thay đổi

**Ví dụ:**
```
Target: -23 LUFS
Average of last 10: -26.5 LUFS
Drift = 3.5 LUFS → Cần recalibrate!
```

---

## User Experience

### Trong Settings Page:

```
┌──────────────────────────────────────────────┐
│ Calibrated Devices                           │
├──────────────────────────────────────────────┤
│ MacBook Pro Microphone          ✅           │
│ Calibration is accurate and up to date.     │
│ Recordings tracked: 7                        │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ iPhone Microphone               ⚠️           │
│ High variance detected (5.2 LUFS).           │
│ Your environment may have changed.           │
│                                              │
│ [🎤 Recalibrate Now]                        │
│ Recordings tracked: 10                       │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ USB Microphone                  🔺           │
│ Calibration is 42 days old.                 │
│ Recalibration ensures optimal accuracy.     │
│                                              │
│ [🎤 Recalibrate Now]                        │
│ Recordings tracked: 5                        │
└──────────────────────────────────────────────┘
```

### Sau Recording (Results Page):

Nếu cần recalibrate, hiện alert:

**⚠️ Warning Level:**
```
┌──────────────────────────────────────────────┐
│ ⚠️ Calibration Notice                       │
│                                              │
│ Background noise level changed significantly │
│ (12.3 dB). Consider recalibrating in your   │
│ current environment.                         │
│                                              │
│ Variance detected: 12.3 units               │
│                                              │
│ [⚙️ Go to Calibration Settings]             │
└──────────────────────────────────────────────┘
```

**🚨 Urgent Level:**
```
┌──────────────────────────────────────────────┐
│ 🚨 Recalibration Recommended                │
│                                              │
│ High variance in audio levels detected      │
│ (7.8 LUFS). Your mic position or settings   │
│ may have changed.                            │
│                                              │
│ Variance detected: 7.8 units                │
│                                              │
│ [⚙️ Go to Calibration Settings]             │
└──────────────────────────────────────────────┘
```

---

## Status Icons

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | Good | Calibration accurate, no action needed |
| ⚠️ | Warning | Small variance detected, consider recalibrating soon |
| 🚨 | Urgent | High variance, recalibrate recommended |

---

## Thresholds & Configuration

```typescript
// Can be adjusted in lufsNormalization.ts

MAX_RECORDING_HISTORY = 10     // Keep last N recordings
VARIANCE_THRESHOLD = 5         // LUFS variance (std dev)
NOISE_VARIANCE_THRESHOLD = 10  // dB change
MAX_CALIBRATION_AGE = 30       // Days
MAX_DRIFT = 3                  // LUFS from target
```

---

## Benefits

### 1. **Proactive Maintenance** ✅
- User được notify trước khi scoring bị ảnh hưởng
- Không cần guess tại sao điểm số thay đổi

### 2. **Data-Driven Decisions** 📊
- Dựa trên 10 recordings gần nhất
- Statistical variance analysis
- Không phải random/guesswork

### 3. **Minimal Friction** 🎯
- Chỉ show alert khi thực sự cần
- One-click "Recalibrate Now" trong Settings
- Không interrupt workflow thường xuyên

### 4. **Transparent** 🔍
- Show variance numbers
- Explain reason (environment, age, drift)
- User hiểu tại sao cần recalibrate

---

## Technical Implementation

### Core Functions:

```typescript
// Track recording (auto-called after each analysis)
trackRecording(deviceId, {
  originalLUFS: -28.3,
  calibratedLUFS: -24.1,
  finalLUFS: -23.0,
  noiseFloor: -48.2,
});

// Check if recalibration needed
const suggestion = checkRecalibrationNeeded(deviceId);
// → { shouldRecalibrate: true, reason: "...", variance: 5.2 }

// Get user-friendly status
const status = getRecalibrationStatus(deviceId);
// → { status: 'warning', message: "...", variance: 5.2 }
```

### Data Flow:

```
Recording Complete
    ↓
Normalize with LUFS (calibrateAndNormalize)
    ↓
Track stats (trackRecording) ← Automatic
    ↓
Store in profile.recordingHistory
    ↓
[After 3+ recordings]
    ↓
Calculate variance (checkRecalibrationNeeded)
    ↓
If variance > threshold → Show alert
    ↓
User clicks "Recalibrate Now"
    ↓
Delete old profile + Start new calibration
    ↓
Fresh accurate calibration ✅
```

---

## Example Scenarios

### Scenario 1: Work from Home → Coffee Shop
```
Home office:
  Recordings 1-5: -26 to -27 LUFS, noise -50 dB
  Status: ✅ Good

Move to coffee shop:
  Recording 6: -32 LUFS, noise -35 dB (noisier)
  Recording 7: -30 LUFS, noise -33 dB

Variance: 3.1 LUFS (below threshold, OK)
Noise change: 15 dB → ⚠️ Warning

Alert: "Background noise changed significantly (15 dB)"
Action: Recalibrate at coffee shop
```

### Scenario 2: Mic Position Drift
```
Initial: Mic 10cm from mouth
  Recordings 1-3: -24 to -25 LUFS
  Status: ✅ Good

Later: Mic moved to 20cm
  Recording 4: -28 LUFS
  Recording 5: -29 LUFS
  Recording 6: -27 LUFS

Variance: 2.5 LUFS (below threshold, OK)

Later: Mic moved to 5cm (too close)
  Recording 7: -18 LUFS
  Recording 8: -19 LUFS

Variance: 5.8 LUFS → 🚨 Urgent

Alert: "High variance (5.8 LUFS). Mic position changed?"
Action: Recalibrate with correct position
```

### Scenario 3: Long-term User
```
Day 1: Calibrate ✅
Day 15: 8 recordings, variance 1.2 LUFS → ✅ Good
Day 35: 10 recordings, variance 2.1 LUFS
  Age: 35 days → ⚠️ Warning

Alert: "Calibration is 35 days old"
Action: Refresh calibration for best accuracy
```

---

## Summary

**Auto-recalibration = Smart maintenance system**

- ✅ Tracks recording quality automatically
- ✅ Detects 4 types of drift/variance
- ✅ Shows clear, actionable alerts
- ✅ One-click recalibration flow
- ✅ Zero user intervention when things are good

**Result:** Always accurate scoring, proactive problem detection, minimal user effort.

---

*Feature implemented: February 2, 2026*
*Commit: e10dc2b - feat: Implement LUFS normalization with auto-recalibration*
