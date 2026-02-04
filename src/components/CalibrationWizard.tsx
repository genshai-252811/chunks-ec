import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useEnhancedAudioRecorder } from '@/hooks/useEnhancedAudioRecorder';
import { useRealtimeAudio } from '@/hooks/useRealtimeAudio';
import { AudioLevelMeter } from '@/components/AudioLevelMeter';
import {
  getCalibrationProfiles,
  deleteCalibrationProfile,
  createCalibrationProfile,
  saveCalibrationProfile,
  measureReferenceLevel,
  calculateNoiseFloor,
  getRecalibrationStatus,
} from '@/lib/lufsNormalization';
import { Mic, Trash2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

type CalibrationStep = 'idle' | 'noise' | 'reference' | 'complete';

export function CalibrationWizard() {
  const [step, setStep] = useState<CalibrationStep>('idle');
  const [noiseFloor, setNoiseFloor] = useState<number>(0);
  const [referenceLevel, setReferenceLevel] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const { toast } = useToast();
  const {
    isRecording,
    audioBuffer,
    sampleRate,
    deviceId,
    deviceLabel,
    startRecording,
    stopRecording,
    resetRecording,
  } = useEnhancedAudioRecorder();

  const profiles = getCalibrationProfiles();

  // Real-time audio monitoring for visual feedback
  const { audioLevel, lufs } = useRealtimeAudio(isRecording);

  // Start noise measurement
  const handleMeasureNoise = useCallback(async () => {
    setStep('noise');
    setCountdown(3);

    // Countdown
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Start recording
    await startRecording();

    // Record for 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Stop and analyze
    await stopRecording();
  }, [startRecording, stopRecording]);

  // Start reference measurement
  const handleMeasureReference = useCallback(async () => {
    setStep('reference');
    setCountdown(3);

    // Countdown
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Start recording
    await startRecording();

    // Record for 5 seconds
    setCountdown(5);
    for (let i = 5; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Stop recording
    await stopRecording();
  }, [startRecording, stopRecording]);

  // Process recorded audio based on step
  const processAudio = useCallback(async () => {
    if (!audioBuffer || isProcessing) return;

    setIsProcessing(true);

    try {
      if (step === 'noise') {
        // Calculate noise floor
        const noise = calculateNoiseFloor(audioBuffer, sampleRate);
        setNoiseFloor(noise);
        console.log('🔇 Noise floor measured:', noise.toFixed(2), 'dB');

        toast({
          title: 'Step 1 complete',
          description: `Noise floor: ${noise.toFixed(2)} dB. Starting Step 2...`,
        });

        resetRecording();

        // Auto-proceed to Step 2 (reference level)
        setTimeout(() => {
          handleMeasureReference();
        }, 600);
      } else if (step === 'reference') {
        // Calculate reference level (LUFS)
        const reference = await measureReferenceLevel(audioBuffer, sampleRate);
        setReferenceLevel(reference);
        console.log('🎙️ Reference level measured:', reference.toFixed(2), 'LUFS');

        // Create and save calibration profile
        if (deviceId) {
          const profile = createCalibrationProfile(
            deviceId,
            deviceLabel || 'Unknown Device',
            noiseFloor,
            reference
          );
          saveCalibrationProfile(profile);

          toast({
            title: 'Calibration complete!',
            description: `Your ${deviceLabel} is now calibrated.`,
          });

          setStep('complete');
        }

        resetRecording();
      }
    } catch (error) {
      console.error('Failed to process calibration audio:', error);
      toast({
        title: 'Calibration failed',
        description: 'Please try again.',
        variant: 'destructive',
      });
      resetRecording();
      setStep('idle');
    } finally {
      setIsProcessing(false);
    }
  }, [audioBuffer, sampleRate, step, deviceId, deviceLabel, noiseFloor, resetRecording, toast, isProcessing, handleMeasureReference]);

  // Auto-process when audio is available - use useEffect to avoid render-time side effects
  useEffect(() => {
    if (audioBuffer && !isRecording && !isProcessing && step !== 'idle' && step !== 'complete') {
      processAudio();
    }
  }, [audioBuffer, isRecording, isProcessing, step, processAudio]);

  const handleDeleteProfile = (profileDeviceId: string) => {
    deleteCalibrationProfile(profileDeviceId);
    toast({
      title: 'Profile deleted',
      description: 'Calibration profile has been removed.',
    });
  };

  const handleStartCalibration = () => {
    setStep('idle');
    setNoiseFloor(0);
    setReferenceLevel(0);
    handleMeasureNoise();
  };

  return (
    <div className="space-y-6">
      {/* Current Profiles */}
      {profiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Calibrated Devices</CardTitle>
            <CardDescription>
              Your calibrated microphones for consistent measurements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profiles.map((profile) => {
              const status = getRecalibrationStatus(profile.deviceId);
              return (
                <div
                  key={profile.deviceId}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{profile.deviceLabel}</div>
                      {status.status === 'good' && (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                      {status.status === 'warning' && (
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                      )}
                      {status.status === 'recommend' && (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      )}
                    </div>

                    {/* Status Message */}
                    {status.status !== 'good' && (
                      <div className={`text-xs mt-1 mb-2 ${
                        status.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {status.message}
                      </div>
                    )}

                    <div className="text-sm text-muted-foreground space-y-1 mt-2">
                      <div>Noise floor: {profile.noiseFloor.toFixed(2)} dB</div>
                      <div>Reference level: {profile.referenceLevel.toFixed(2)} LUFS</div>
                      <div>Gain adjustment: {profile.gainAdjustment.toFixed(2)}x</div>
                      <div className="text-xs">
                        Last used: {new Date(profile.lastUsed).toLocaleDateString()}
                      </div>
                      {profile.recordingHistory && profile.recordingHistory.length > 0 && (
                        <div className="text-xs">
                          Recordings tracked: {profile.recordingHistory.length}
                        </div>
                      )}
                    </div>

                    {/* Recalibrate Button */}
                    {status.status !== 'good' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          deleteCalibrationProfile(profile.deviceId);
                          handleStartCalibration();
                        }}
                      >
                        <Mic className="w-3 h-3 mr-2" />
                        Recalibrate Now
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteProfile(profile.deviceId)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Calibration Wizard */}
      <Card>
        <CardHeader>
          <CardTitle>Calibrate New Device</CardTitle>
          <CardDescription>
            Ensure fair scoring across different microphones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step Indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Step {step === 'idle' ? '0' : step === 'noise' ? '1' : step === 'reference' ? '2' : '3'} of 3</span>
              <span>{step === 'complete' ? '100' : step === 'reference' ? '66' : step === 'noise' ? '33' : '0'}%</span>
            </div>
            <Progress value={step === 'complete' ? 100 : step === 'reference' ? 66 : step === 'noise' ? 33 : 0} />
          </div>

          {/* Step: Idle / Start */}
          {step === 'idle' && !isRecording && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-2">How calibration works:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>We measure background noise in your environment</li>
                    <li>You speak at your normal volume</li>
                    <li>We calculate adjustments for fair scoring</li>
                  </ol>
                </div>
              </div>

              <Button onClick={handleStartCalibration} className="w-full">
                <Mic className="w-4 h-4 mr-2" />
                Start Calibration
              </Button>
            </div>
          )}

          {/* Step: Noise Measurement */}
          {step === 'noise' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-6xl font-bold text-muted-foreground animate-pulse mb-4">
                  {countdown}
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Step 1: Measuring Background Noise</h3>
                  <p className="text-sm text-muted-foreground">
                    {countdown > 0 ? 'Stay silent and still...' : 'Recording noise floor...'}
                  </p>
                </div>
              </div>
              {isRecording && (
                <>
                  <div className="flex justify-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  </div>
                  <AudioLevelMeter
                    audioLevel={audioLevel}
                    showWaveform={false}
                    height={60}
                  />
                </>
              )}
            </div>
          )}

          {/* Step: Reference Measurement */}
          {step === 'reference' && (
            <div className="space-y-4">
              {countdown > 0 ? (
                <div className="text-center space-y-4">
                  <div className="text-6xl font-bold text-muted-foreground animate-pulse">
                    {countdown}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Get ready to speak...</h3>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">Step 2: Speak at Normal Volume</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Read this sentence clearly:
                    </p>
                  </div>

                  <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg">
                    <p className="text-xl font-medium text-center leading-relaxed">
                      "Hello, I am calibrating my microphone for the best speaking practice experience."
                    </p>
                  </div>

                  {isRecording && (
                    <>
                      <div className="flex items-center justify-center gap-2 text-red-600">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="font-medium">Recording...</span>
                      </div>
                      <AudioLevelMeter
                        audioLevel={audioLevel}
                        lufs={lufs}
                        targetLUFS={-23}
                        showWaveform={true}
                        height={80}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step: Complete */}
          {step === 'complete' && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Calibration Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  Your device is now calibrated for fair scoring.
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Device:</span>
                  <span className="font-medium">{deviceLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Noise floor:</span>
                  <span className="font-medium">{noiseFloor.toFixed(2)} dB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference level:</span>
                  <span className="font-medium">{referenceLevel.toFixed(2)} LUFS</span>
                </div>
              </div>

              <Button onClick={() => setStep('idle')} variant="outline" className="w-full">
                Calibrate Another Device
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
