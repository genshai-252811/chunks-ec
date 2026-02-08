import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, ChevronLeft, ChevronRight, LogOut, User, BarChart3, Shield, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ResultsView } from '@/components/ResultsView';
import { RecalibrationAlert } from '@/components/RecalibrationAlert';
import { CameraFeed } from '@/components/CameraFeed';
import { RecordingWaveform } from '@/components/RecordingWaveform';

import { useEnhancedAudioRecorder } from '@/hooks/useEnhancedAudioRecorder';
import { useSentences } from '@/hooks/useSentences';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { usePracticeResults } from '@/hooks/usePracticeResults';
import { useMetricSettings } from '@/hooks/useMetricSettings';
import { analyzeAudioAsync, AnalysisResult } from '@/lib/audioAnalysis';
import { FaceTrackingMetrics } from '@/hooks/useFaceTracking';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type AppState = 'idle' | 'recording' | 'processing' | 'results';

export default function Index() {
  const [appState, setAppState] = useState<AppState>('idle');

  // Sync metric settings on mount
  useMetricSettings();

  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [speechProbability, setSpeechProbability] = useState(0);
  const [finalFaceMetrics, setFinalFaceMetrics] = useState<FaceTrackingMetrics | null>(null);
  const faceMetricsRef = useRef<FaceTrackingMetrics | null>(null);

  const navigate = useNavigate();
  const { user, profile, isAuthenticated, isLoading: authLoading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { saveResult } = usePracticeResults();

  const {
    currentSentence,
    getNextSentence,
    isLoading: sentencesLoading
  } = useSentences();

  const {
    isRecording,
    recordingTime,
    audioBuffer,
    audioBlob,
    audioBase64,
    sampleRate,
    error,
    vadMetrics,
    deviceId,
    deviceLabel,
    sttWordCount,
    startRecording,
    stopRecording,
    resetRecording,
    getAudioLevel,
    getSpeechProbability
  } = useEnhancedAudioRecorder();

  // Update audio level and speech probability for visualization
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setAudioLevel(getAudioLevel());
      setSpeechProbability(getSpeechProbability());
    }, 50);
    return () => clearInterval(interval);
  }, [isRecording, getAudioLevel, getSpeechProbability]);


  // Process audio when recording stops
  useEffect(() => {
    const processAudio = async () => {
      if (audioBuffer && appState === 'processing') {
        console.log('🎤 Analyzing with device:', deviceId, deviceLabel);
        console.log('🎤 VAD Metrics available:', vadMetrics?.speechSegments?.length || 0, 'segments');
        const analysisResults = await analyzeAudioAsync(
          audioBuffer,
          sampleRate,
          audioBase64 || undefined,
          deviceId || undefined,
          vadMetrics || undefined,
          sttWordCount || undefined,
          audioBlob || undefined
        );

        // Save results to database if authenticated
        if (isAuthenticated && analysisResults) {
          const videoMetrics = faceMetricsRef.current ? {
            eyeContactScore: faceMetricsRef.current.eyeContactScore,
            handMovementScore: faceMetricsRef.current.handMovementScore,
            blinkRate: faceMetricsRef.current.blinkRate,
          } : undefined;
          await saveResult(analysisResults, currentSentence?.id || null, recordingTime, videoMetrics);
        }

        setTimeout(() => {
          setResults(analysisResults);
          setAppState('results');
        }, 500);
      }
    };
    processAudio();
  }, [audioBuffer, audioBlob, audioBase64, sampleRate, deviceId, deviceLabel, vadMetrics, sttWordCount, appState, isAuthenticated, saveResult, currentSentence, recordingTime]);

  const handleStartRecording = useCallback(async () => {
    setResults(null);
    await startRecording();
    setAppState('recording');
  }, [startRecording]);
  const handleStopRecording = useCallback(async () => {
    setAppState('processing');
    // Capture final face metrics before stopping
    setFinalFaceMetrics(faceMetricsRef.current);
    await stopRecording();
  }, [stopRecording]);
  const handleRetry = useCallback(() => {
    resetRecording();
    setResults(null);
    setFinalFaceMetrics(null);
    setAppState('idle');
    getNextSentence();
  }, [resetRecording, getNextSentence]);
  const handleRefreshSentence = useCallback(() => {
    getNextSentence();
  }, [getNextSentence]);

  // Keyboard shortcut: Spacebar to start/stop recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger on spacebar, ignore if typing in an input
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        if (appState === 'idle') {
          handleStartRecording();
        } else if (isRecording) {
          handleStopRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState, isRecording, handleStartRecording, handleStopRecording]);

  // Toggle recording on tap/click anywhere on camera feed
  const handleCameraTap = useCallback(() => {
    if (appState === 'processing') return;
    if (isRecording) {
      handleStopRecording();
    } else if (appState === 'idle') {
      handleStartRecording();
    }
  }, [appState, isRecording, handleStartRecording, handleStopRecording]);

  const recordingOverlay = isRecording && (
    <motion.div
      className="fixed inset-0 z-50 cursor-pointer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleCameraTap}
    >
      {/* Minimal Timer - Top Center */}
      <motion.div className="absolute top-6 left-1/2 -translate-x-1/2" initial={{
        opacity: 0,
        y: -20
      }} animate={{
        opacity: 1,
        y: 0
      }}>
        <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm px-4 py-2 rounded-full">
          <motion.div className="w-2.5 h-2.5 rounded-full bg-destructive" animate={{
            opacity: [1, 0.3, 1]
          }} transition={{
            duration: 1,
            repeat: Infinity
          }} />
          <span className="text-foreground font-mono text-lg tracking-wider">
            {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:
            {String(recordingTime % 60).padStart(2, '0')}
          </span>
        </div>
      </motion.div>

      {/* Real-time Soundwave Visualization */}
      <RecordingWaveform
        getAudioLevel={getAudioLevel}
        isActive={isRecording}
      />

      {/* Tap hint - bottom center */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.6, y: 0 }}
        transition={{ delay: 1 }}
      >
        <span className="text-xs text-foreground/60 bg-background/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
          Tap or press Space to stop
        </span>
      </motion.div>
    </motion.div>
  );
  return <div className="min-h-screen bg-background text-foreground overflow-hidden">
    {/* Background Effects */}
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
    </div>

    <div className="relative z-10 h-screen flex flex-col">
      {/* Header with Settings and User Menu */}
      <div className="flex items-center justify-between px-4 py-0">
        <Header />
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="text-muted-foreground">
                  {profile?.display_name || user?.email}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/progress">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Progress
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin">
                      <Shield className="w-4 h-4 mr-2" />
                      Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/settings">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Settings className="w-5 h-5" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <main className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {appState !== 'results' ? <motion.div key="main" className="flex-1 flex flex-col" initial={{
            opacity: 0
          }} animate={{
            opacity: 1
          }} exit={{
            opacity: 0,
            scale: 0.95
          }}>
            {/* Camera - expands to fullscreen when recording, tappable to start/stop */}
            <motion.div
              className={isRecording ? "fixed inset-0 z-40" : "flex-[4] min-h-0 p-2 cursor-pointer"}
              layout
              transition={{ duration: 0.3, ease: "easeInOut" }}
              onClick={!isRecording ? handleCameraTap : undefined}
            >
              <CameraFeed
                isRecording={isRecording}
                audioLevel={audioLevel}
                fullscreen={isRecording}
                className="w-full h-full"
                onFaceMetricsUpdate={(metrics) => { faceMetricsRef.current = metrics; }}
              />
              {/* Tap hint when idle */}
              {!isRecording && appState === 'idle' && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <span className="text-sm text-foreground/50 bg-background/40 backdrop-blur-sm px-4 py-2 rounded-full">
                    Tap or press Space to record
                  </span>
                </motion.div>
              )}
            </motion.div>

            {/* Bottom Section - 20% */}
            <div className="flex-1 flex-col gap-3 px-4 bg-background/80 backdrop-blur-sm flex items-center justify-center py-[20px]">
              {/* Compact Sentence */}
              <div className="text-center">
                {sentencesLoading ? <p className="text-lg font-medium text-muted-foreground">Loading...</p> : currentSentence ? <>
                  <p className="text-lg font-medium text-foreground line-clamp-2">
                    {currentSentence.vietnamese}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Say it in English
                  </p>
                </> : <p className="text-muted-foreground">No sentences available</p>}
              </div>

              {/* Sentence Navigation */}
              <div className="flex items-center gap-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefreshSentence}
                  className="rounded-full text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>

                <span className="text-xs text-muted-foreground">Change sentence</span>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefreshSentence}
                  className="rounded-full text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              {/* Error */}
              {error && <p className="text-destructive text-xs text-center">{error}</p>}
            </div>
          </motion.div> : <motion.div key="results" className="flex-1 overflow-auto" initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} exit={{
            opacity: 0
          }}>
            {results && (
              <>
                <ResultsView results={results} faceMetrics={finalFaceMetrics} onRetry={handleRetry} />
                <div className="px-4 pb-4">
                  <RecalibrationAlert deviceId={deviceId} />
                </div>
              </>
            )}
          </motion.div>}
        </AnimatePresence>
      </main>
    </div>

    {/* Processing Overlay - shows analyzing state */}
    <AnimatePresence>
      {appState === 'processing' && (
        <motion.div
          key="processing"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="flex flex-col items-center gap-4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="relative">
              <motion.div
                className="w-16 h-16 rounded-full border-4 border-primary/20"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 -mt-2 rounded-full bg-primary" />
              </motion.div>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">Analyzing...</p>
              <p className="text-sm text-muted-foreground mt-1">Processing your voice energy</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Recording Overlay - renders on top when recording */}
    <AnimatePresence>
      {recordingOverlay}
    </AnimatePresence>
  </div>;
};
