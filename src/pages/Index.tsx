import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { RecordButton } from '@/components/RecordButton';
import { ResultsView } from '@/components/ResultsView';
import { CameraFeed } from '@/components/CameraFeed';
import { FlowingWaveform } from '@/components/FlowingWaveform';
import { EnergyMeter } from '@/components/EnergyMeter';
import { useEnhancedAudioRecorder } from '@/hooks/useEnhancedAudioRecorder';
import { useSentences } from '@/hooks/useSentences';
import { analyzeAudioAsync, AnalysisResult } from '@/lib/audioAnalysis';
import { Button } from '@/components/ui/button';

type AppState = 'idle' | 'recording' | 'processing' | 'results';

const Index = () => {
  const [appState, setAppState] = useState<AppState>('idle');
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [speechProbability, setSpeechProbability] = useState(0);
  
  const {
    currentSentence,
    getNextSentence,
    isLoading: sentencesLoading
  } = useSentences();
  
  const {
    isRecording,
    recordingTime,
    audioBuffer,
    audioBase64,
    sampleRate,
    error,
    vadMetrics,
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
        const analysisResults = await analyzeAudioAsync(audioBuffer, sampleRate, audioBase64 || undefined);
        setTimeout(() => {
          setResults(analysisResults);
          setAppState('results');
        }, 500);
      }
    };
    processAudio();
  }, [audioBuffer, audioBase64, sampleRate, appState]);
  const handleStartRecording = useCallback(async () => {
    setResults(null);
    await startRecording();
    setAppState('recording');
  }, [startRecording]);
  const handleStopRecording = useCallback(async () => {
    setAppState('processing');
    await stopRecording();
  }, [stopRecording]);
  const handleRetry = useCallback(() => {
    resetRecording();
    setResults(null);
    setAppState('idle');
    getNextSentence();
  }, [resetRecording, getNextSentence]);
  const handleRefreshSentence = useCallback(() => {
    getNextSentence();
  }, [getNextSentence]);

  // Fullscreen recording mode
  if (isRecording) {
    return <div className="fixed inset-0 bg-black z-50">
        {/* Fullscreen Camera */}
        <CameraFeed isRecording={true} audioLevel={audioLevel} fullscreen={true} />

        {/* Minimal Timer - Top Center */}
        <motion.div className="absolute top-6 left-1/2 -translate-x-1/2 z-50" initial={{
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

        {/* Energy Meter with VAD - Top Right */}
        <motion.div className="absolute top-6 right-6 left-6 z-50" initial={{
        opacity: 0,
        y: -20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.2
      }}>
          <EnergyMeter audioLevel={audioLevel} speechProbability={speechProbability} isSpeaking={vadMetrics?.isSpeaking} />
        </motion.div>

        {/* Bottom Controls - Stop Button + Waveform */}
        <div className="absolute bottom-6 left-4 right-4 z-50 flex flex-col items-center gap-4">
          {/* Stop Button */}
          <RecordButton isRecording={isRecording} isProcessing={appState === 'processing'} audioLevel={audioLevel} onStart={handleStartRecording} onStop={handleStopRecording} />

          {/* Flowing Waveform */}
          <div className="w-full max-w-sm">
            <FlowingWaveform isRecording={isRecording} getAudioLevel={getAudioLevel} />
          </div>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 h-screen flex flex-col">
        {/* Header with Settings */}
        <div className="flex items-center justify-between px-4 py-0">
          <Header />
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Settings className="w-5 h-5" />
            </Button>
          </Link>
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
                {/* Camera - 80% */}
                <div className="flex-[4] min-h-0 p-2">
                  <CameraFeed isRecording={false} audioLevel={0} className="w-full h-full" />
                </div>

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

                  {/* Record Button with Navigation */}
                  <div className="flex items-center gap-4">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleRefreshSentence}
                      className="rounded-full text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    
                    <RecordButton isRecording={false} isProcessing={appState === 'processing'} audioLevel={audioLevel} onStart={handleStartRecording} onStop={handleStopRecording} />
                    
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
                {results && <ResultsView results={results} onRetry={handleRetry} />}
              </motion.div>}
          </AnimatePresence>
        </main>
      </div>
    </div>;
};
export default Index;