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

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        <Header />

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-6">
          <AnimatePresence mode="wait">
            {appState !== 'results' ? (
              <motion.div
                key="main"
                className="w-full max-w-2xl flex flex-col items-center gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                {/* Camera Preview - Always Visible */}
                <motion.div
                  className="w-full aspect-[4/3] max-w-md relative"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <CameraFeed 
                    autoStart={true}
                    isRecording={isRecording}
                    audioLevel={audioLevel}
                    className="w-full h-full"
                  />

                  {/* Recording Overlay */}
                  {isRecording && (
                    <>
                      {/* Timer Badge */}
                      <motion.div
                        className="absolute top-4 left-4 glass-card px-3 py-1.5 flex items-center gap-2"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <motion.div
                          className="w-2 h-2 rounded-full bg-destructive"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                        <span className="text-sm font-mono">
                          {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:
                          {String(recordingTime % 60).padStart(2, '0')}
                        </span>
                      </motion.div>

                      {/* Energy Icon Badge */}
                      <motion.div
                        className="absolute top-4 right-4 glass-card p-2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <EnergyIcon audioLevel={audioLevel} />
                      </motion.div>

                      {/* Waveform */}
                      <div className="absolute bottom-4 left-4 right-4">
                        <RealtimeWaveform
                          isRecording={isRecording}
                          getAudioLevel={getAudioLevel}
                        />
                      </div>
                    </>
                  )}
                </motion.div>

                {/* Practice Sentence */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <PracticeSentence
                    sentence={currentSentence}
                    onRefresh={handleRefreshSentence}
                    isRecording={isRecording}
                  />
                </motion.div>

                {/* Audio Visualizer (idle only) */}
                {!isRecording && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <AudioVisualizer
                      isRecording={isRecording}
                      getAudioLevel={getAudioLevel}
                    />
                  </motion.div>
                )}

                {/* Record Button */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, type: 'spring' }}
                >
                  <RecordButton
                    isRecording={isRecording}
                    isProcessing={appState === 'processing'}
                    audioLevel={audioLevel}
                    onStart={handleStartRecording}
                    onStop={handleStopRecording}
                  />
                </motion.div>

                {/* Error */}
                {error && (
                  <motion.p
                    className="text-destructive text-sm text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {error}
                  </motion.p>
                )}

                {/* Instructions */}
                {appState === 'idle' && (
                  <motion.p
                    className="text-muted-foreground text-xs text-center max-w-xs"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    Speak the sentence in English with energy!
                  </motion.p>
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

        <footer className="py-3 text-center">
          <p className="text-xs text-muted-foreground/40">
            Voice Energy Measurement App
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
