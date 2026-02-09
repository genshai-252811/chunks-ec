import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Play, Pause, RotateCcw, Save } from 'lucide-react';
import { AudioLevelMeter } from '@/components/AudioLevelMeter';
import { useRealtimeAudio } from '@/hooks/useRealtimeAudio';
import {
  CalibrationProfile,
  getCalibrationProfile,
  getCalibrationProfiles,
  saveCalibrationProfile,
  createCalibrationProfile,
} from '@/lib/lufsNormalization';
import { toast } from 'sonner';

export function CalibrationTest() {
  const [isTestMode, setIsTestMode] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<CalibrationProfile | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabel] = useState<string>('');
  const [manualGain, setManualGain] = useState<number>(1.0);
  const [hasChanges, setHasChanges] = useState(false);

  const { audioLevel, lufs, isActive, error } = useRealtimeAudio(isTestMode);

  // Load profile from localStorage on mount (no mic permission needed)
  useEffect(() => {
    const profiles = getCalibrationProfiles();
    if (profiles.length > 0) {
      const profile = profiles[0]; // Use most recent / first profile
      setCurrentProfile(profile);
      setDeviceId(profile.deviceId);
      setDeviceLabel(profile.deviceLabel);
      setManualGain(profile.gainAdjustment);
    }
  }, []);

  // When test mode starts, detect actual device and reload profile
  const handleToggleTest = useCallback(async () => {
    if (isTestMode) {
      setIsTestMode(false);
      return;
    }

    // Start test mode - detect device from mic stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = stream.getAudioTracks()[0];
      const detectedDeviceId = audioTrack.getSettings().deviceId || 'default';
      const detectedLabel = audioTrack.label || 'Microphone';
      stream.getTracks().forEach(track => track.stop());

      setDeviceId(detectedDeviceId);
      setDeviceLabel(detectedLabel);

      const profile = getCalibrationProfile(detectedDeviceId);
      if (profile) {
        setCurrentProfile(profile);
        if (!hasChanges) {
          setManualGain(profile.gainAdjustment);
        }
      }
    } catch (err) {
      console.error('Failed to detect device:', err);
    }

    setIsTestMode(true);
  }, [isTestMode, hasChanges]);

  const handleGainChange = (value: number[]) => {
    setManualGain(value[0]);
    setHasChanges(true);
  };

  const handleSaveGain = () => {
    if (currentProfile) {
      // Update existing profile
      const updatedProfile: CalibrationProfile = {
        ...currentProfile,
        gainAdjustment: manualGain,
      };
      saveCalibrationProfile(updatedProfile);
      setCurrentProfile(updatedProfile);
    } else if (deviceId) {
      // Create new profile with manual gain
      const newProfile = createCalibrationProfile(
        deviceId,
        deviceLabel || 'Unknown Device',
        -40, // default noise floor
        -23, // default reference level (target LUFS)
      );
      newProfile.gainAdjustment = manualGain;
      saveCalibrationProfile(newProfile);
      setCurrentProfile(newProfile);
    } else {
      toast.error('Start Test Mode first to detect your microphone.');
      return;
    }

    setHasChanges(false);
    toast.success('Manual gain adjustment saved!');
  };

  const handleReset = () => {
    const resetValue = currentProfile ? currentProfile.gainAdjustment : 1.0;
    setManualGain(resetValue);
    setHasChanges(false);
  };

  const adjustedLUFS = lufs !== null ? lufs + (20 * Math.log10(manualGain)) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Calibration</CardTitle>
        <CardDescription>
          Test your microphone calibration and make manual adjustments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Profile Info */}
        {currentProfile && (
          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Device:</span>
              <span className="font-medium">{currentProfile.deviceLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Noise Floor:</span>
              <span className="font-medium">{currentProfile.noiseFloor.toFixed(2)} dB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reference Level:</span>
              <span className="font-medium">{currentProfile.referenceLevel.toFixed(2)} LUFS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Gain:</span>
              <span className="font-medium">{currentProfile.gainAdjustment.toFixed(3)}x</span>
            </div>
          </div>
        )}

        {!currentProfile && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
            No calibration profile found. You can still test and adjust gain manually — a profile will be created when you save.
          </div>
        )}

        {/* Test Mode Toggle */}
        <div>
          <Button
            onClick={handleToggleTest}
            variant={isTestMode ? 'destructive' : 'default'}
            className="w-full"
          >
            {isTestMode ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Stop Testing
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Test Mode
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Real-time Monitoring */}
        {isTestMode && (
          <div className="space-y-4">
            <AudioLevelMeter
              audioLevel={audioLevel}
              lufs={adjustedLUFS}
              targetLUFS={-23}
              showWaveform={true}
              height={80}
            />

            {isActive && adjustedLUFS !== null && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm space-y-2">
                <div className="font-medium text-blue-900">Live Feedback:</div>
                <div className="text-blue-800">
                  {adjustedLUFS < -28 && "Too quiet - speak louder or increase gain"}
                  {adjustedLUFS >= -28 && adjustedLUFS < -20 && "Good level - within target range"}
                  {adjustedLUFS >= -20 && adjustedLUFS < -15 && "Slightly loud - consider reducing gain"}
                  {adjustedLUFS >= -15 && "Too loud - reduce gain or speak softer"}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual Gain Adjustment */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Manual Gain Adjustment</Label>
            <span className="text-sm font-medium">{manualGain.toFixed(3)}x</span>
          </div>
          <Slider
            value={[manualGain]}
            onValueChange={handleGainChange}
            min={0.5}
            max={2.0}
            step={0.01}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.5x (Quieter)</span>
            <span>1.0x (Default)</span>
            <span>2.0x (Louder)</span>
          </div>

          {hasChanges && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button size="sm" onClick={handleSaveGain}>
                <Save className="w-4 h-4 mr-2" />
                Save Adjustment
              </Button>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="p-4 border rounded-lg bg-muted/50 text-sm space-y-2">
          <div className="font-medium">How to use:</div>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Click "Start Test Mode" to begin monitoring</li>
            <li>Speak normally and watch the LUFS reading</li>
            <li>Adjust the gain slider to reach -23 LUFS target</li>
            <li>Click "Save Adjustment" to apply your changes</li>
            <li>Test again to verify the adjustment</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
