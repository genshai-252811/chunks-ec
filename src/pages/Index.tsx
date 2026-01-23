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

        // Small delay for UX
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

  return (
    <div className={`min-h-screen bg-background text-foreground relative ${isRecording ? 'overflow-hidden fixed inset-0' : 'overflow-hidden'}`}>
      {/* Background gradient effects - hide when recording */}
      {!isRecording && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>
      )}

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header - hide when recording */}
        {!isRecording && <Header />}

        <main className={`flex-1 flex flex-col items-center justify-center ${isRecording ? 'p-0' : 'px-4 py-8'}`}>
          <AnimatePresence mode="wait">
            {appState !== 'results' ? (
              <motion.div
                key="recording"
                className={`flex flex-col items-center ${isRecording ? 'w-full h-full fixed inset-0 z-50' : 'w-full max-w-4xl'}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                {/* IDLE/PROCESSING STATE */}
                {!isRecording && (
                  <>
                    {/* Practice Sentence */}
                    <div className="mb-12">
                      <PracticeSentence
                        sentence={currentSentence}
                        onRefresh={handleRefreshSentence}
                        isRecording={isRecording}
                      />
                    </div>

                    {/* Audio Visualizer */}
                    <div className="mb-8">
                      <AudioVisualizer
                        isRecording={isRecording}
                        getAudioLevel={getAudioLevel}
                      />
                    </div>

                    {/* Record Button */}
                    <div className="my-8">
                      <RecordButton
                        isRecording={isRecording}
                        isProcessing={appState === 'processing'}
                        audioLevel={audioLevel}
                        onStart={handleStartRecording}
                        onStop={handleStopRecording}
                      />
                    </div>
                  </>
                )}

                {/* RECORDING STATE - FULLSCREEN WITH CAMERA */}
                {isRecording && (
                  <div className="relative w-full h-full bg-background">
                    {/* Timer - Top Center */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
                      <motion.div 
                        className="glass-card px-4 py-2 flex items-center gap-2"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <motion.div
                          className="w-2 h-2 rounded-full bg-destructive"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                        <span className="text-lg font-mono text-foreground">
                          {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:
                          {String(recordingTime % 60).padStart(2, '0')}
                        </span>
                      </motion.div>
                    </div>

                    {/* Energy Icon - Top Right */}
                    <div className="absolute top-6 right-6 z-50">
                      <motion.div 
                        className="glass-card p-3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <EnergyIcon audioLevel={audioLevel} />
                      </motion.div>
                    </div>

                    {/* Fullscreen Camera */}
                    <CameraFeed isRecording={isRecording} audioLevel={audioLevel} />

                    {/* Waveform - Bottom */}
                    <div className="absolute bottom-28 left-4 right-4 z-40">
                      <RealtimeWaveform
                        isRecording={isRecording}
                        getAudioLevel={getAudioLevel}
                      />
                    </div>

                    {/* Stop Button - Bottom Center */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
                      <RecordButton
                        isRecording={isRecording}
                        isProcessing={appState === 'processing'}
                        audioLevel={audioLevel}
                        onStart={handleStartRecording}
                        onStop={handleStopRecording}
                      />
                    </div>
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <motion.p
                    className="text-destructive text-sm mt-4 text-center max-w-xs"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {error}
                  </motion.p>
                )}

                {/* Instructions (Idle only) */}
                {appState === 'idle' && (
                  <motion.div
                    className="mt-8 text-center max-w-sm"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Speak the sentence in English with energy. Watch your real-time energy level!
                    </p>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="results"
                className="w-full"
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

        {/* Footer - hide when recording */}
        {!isRecording && (
          <footer className="py-4 text-center">
            <p className="text-xs text-muted-foreground/50">
              Voice Energy Measurement App
            </p>
          </footer>
        )}
      </div>
    </div>
  );
};

export default Index;
