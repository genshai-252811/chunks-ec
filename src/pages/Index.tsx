import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/Header';
import { RecordButton } from '@/components/RecordButton';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { ResultsView } from '@/components/ResultsView';
import { CameraFeed } from '@/components/CameraFeed';
import { PracticeSentence } from '@/components/PracticeSentence';
import { RealtimeWaveform } from '@/components/RealtimeWaveform';
import { EnergyIcon } from '@/components/EnergyIcon';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { analyzeAudioAsync, AnalysisResult } from '@/lib/audioAnalysis';
import { getRandomSentence, getNextRandomSentence, Sentence } from '@/lib/sentenceBank';

type AppState = 'idle' | 'recording' | 'processing' | 'results';

const Index = () => {
  const [appState, setAppState] = useState<AppState>('idle');
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentSentence, setCurrentSentence] = useState<Sentence>(getRandomSentence());

  const {
    isRecording,
    recordingTime,
    audioBuffer,
    audioBase64,
    sampleRate,
    error,
    startRecording,
    stopRecording,
    resetRecording,
    getAudioLevel,
  } = useAudioRecorder();

  // Update audio level for visualization
  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setAudioLevel(getAudioLevel());
    }, 50);

    return () => clearInterval(interval);
  }, [isRecording, getAudioLevel]);

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
    setCurrentSentence(getNextRandomSentence(currentSentence.id));
  }, [resetRecording, currentSentence.id]);

  const handleRefreshSentence = useCallback(() => {
    setCurrentSentence(getNextRandomSentence(currentSentence.id));
  }, [currentSentence.id]);

  // Fullscreen recording mode
  if (isRecording) {
    return (
      <div className="fixed inset-0 bg-black z-50">
        {/* Fullscreen Camera */}
        <CameraFeed 
          isRecording={true}
          audioLevel={audioLevel}
          fullscreen={true}
        />

        {/* Minimal Timer - Top Center */}
        <motion.div
          className="absolute top-6 left-1/2 -translate-x-1/2 z-50"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm px-4 py-2 rounded-full">
            <motion.div
              className="w-2.5 h-2.5 rounded-full bg-destructive"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-foreground font-mono text-lg tracking-wider">
              {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:
              {String(recordingTime % 60).padStart(2, '0')}
            </span>
          </div>
        </motion.div>

        {/* Energy Icon - Top Right */}
        <motion.div
          className="absolute top-6 right-6 z-50"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="bg-background/50 backdrop-blur-sm p-3 rounded-full">
            <EnergyIcon audioLevel={audioLevel} size="lg" />
          </div>
        </motion.div>

        {/* Bottom Controls - Stop Button + Waveform */}
        <div className="absolute bottom-4 left-4 right-4 z-50 flex flex-col items-center gap-3">
          {/* Stop Button */}
          <RecordButton
            isRecording={isRecording}
            isProcessing={appState === 'processing'}
            audioLevel={audioLevel}
            onStart={handleStartRecording}
            onStop={handleStopRecording}
          />

          {/* Waveform - at very bottom */}
          <div className="w-full max-w-md">
            <RealtimeWaveform
              isRecording={isRecording}
              getAudioLevel={getAudioLevel}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 h-screen flex flex-col">
        {/* Header - minimal */}
        <Header />

        <main className="flex-1 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {appState !== 'results' ? (
              <motion.div
                key="main"
                className="flex-1 flex flex-col"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                {/* Camera - 80% */}
                <div className="flex-[4] min-h-0 p-2">
                  <CameraFeed 
                    isRecording={false}
                    audioLevel={0}
                    className="w-full h-full"
                  />
                </div>

                {/* Bottom Section - 20% */}
                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-2 bg-background/80 backdrop-blur-sm">
                  {/* Compact Sentence */}
                  <div className="text-center">
                    <p className="text-lg font-medium text-foreground line-clamp-2">
                      {currentSentence.vietnamese}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Say it in English
                    </p>
                  </div>

                  {/* Record Button */}
                  <RecordButton
                    isRecording={false}
                    isProcessing={appState === 'processing'}
                    audioLevel={audioLevel}
                    onStart={handleStartRecording}
                    onStop={handleStopRecording}
                  />

                  {/* Error */}
                  {error && (
                    <p className="text-destructive text-xs text-center">{error}</p>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                className="flex-1 overflow-auto"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {results && (
                  <ResultsView results={results} onRetry={handleRetry} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Index;
