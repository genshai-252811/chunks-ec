import { useState, useEffect } from 'react';
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
  saveCalibrationProfile,
} from '@/lib/lufsNormalization';
import { toast } from 'sonner';

export function CalibrationTest() {
  const [isTestMode, setIsTestMode] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<CalibrationProfile | null>(null);
  const [manualGain, setManualGain] = useState<number>(1.0);
  const [hasChanges, setHasChanges] = useState(false);

  const { audioLevel, lufs, isActive, error } = useRealtimeAudio(isTestMode);

  // Load current calibration profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = stream.getAudioTracks()[0];
        const deviceId = audioTrack.getSettings().deviceId || 'default';
        stream.getTracks().forEach(track => track.stop());

        const profile = getCalibrationProfile(deviceId);
        setCurrentProfile(profile);
        if (profile) {
          setManualGain(profile.gainAdjustment);
        }
      } catch (err) {
        console.error('Failed to load calibration profile:', err);
      }
    };

    loadProfile();
  }, []);

  const handleToggleTest = () => {
    setIsTestMode(!isTestMode);
  };

  const handleGainChange = (value: number[]) => {
    setManualGain(value[0]);
    setHasChanges(true);
  };

  const handleSaveGain = () => {
    if (!currentProfile) {
      toast.error('No calibration profile found. Please calibrate first.');
      return;
    }

    const updatedProfile: CalibrationProfile = {
      ...currentProfile,
      gainAdjustment: manualGain,
    };

    saveCalibrationProfile(updatedProfile);
    setCurrentProfile(updatedProfile);
    setHasChanges(false);
    toast.success('Manual gain adjustment saved!');
  };

  const handleReset = () => {
    if (currentProfile) {
      setManualGain(currentProfile.gainAdjustment);
      setHasChanges(false);
    }
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
            No calibration profile found. Please calibrate your device first.
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
                  {adjustedLUFS < -28 && "🔉 Too quiet - speak louder or increase gain"}
                  {adjustedLUFS >= -28 && adjustedLUFS < -20 && "✅ Good level - within target range"}
                  {adjustedLUFS >= -20 && adjustedLUFS < -15 && "⚠️ Slightly loud - consider reducing gain"}
                  {adjustedLUFS >= -15 && "🔊 Too loud - reduce gain or speak softer"}
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
            disabled={!currentProfile}
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
            <li>Adjust the gain slider if needed to reach -23 LUFS target</li>
            <li>Click "Save Adjustment" to apply your changes</li>
            <li>Test again to verify the adjustment</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
