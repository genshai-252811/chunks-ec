import { useState, useRef, useCallback, useEffect } from 'react';
import { MicVAD, RealTimeVADOptions } from '@ricky0123/vad-web';

export interface VADState {
  isListening: boolean;
  isSpeaking: boolean;
  speechProbability: number;
  speechSegments: SpeechSegment[];
  totalSpeechTime: number;
  totalSilenceTime: number;
  error: string | null;
}

export interface SpeechSegment {
  start: number;
  end: number;
  duration: number;
  audio?: Float32Array;
}

interface UseVADOptions {
  onSpeechStart?: () => void;
  onSpeechEnd?: (audio: Float32Array, segment: SpeechSegment) => void;
  onFrameProcessed?: (probability: number) => void;
}

interface UseVADReturn extends VADState {
  startListening: () => Promise<void>;
  stopListening: () => void;
  resetSegments: () => void;
  getSpeechRatio: () => number;
}

export function useVAD(options: UseVADOptions = {}): UseVADReturn {
  const [state, setState] = useState<VADState>({
    isListening: false,
    isSpeaking: false,
    speechProbability: 0,
    speechSegments: [],
    totalSpeechTime: 0,
    totalSilenceTime: 0,
    error: null,
  });

  const vadRef = useRef<MicVAD | null>(null);
  const speechStartTimeRef = useRef<number>(0);
  const sessionStartTimeRef = useRef<number>(0);
  const lastSpeechEndRef = useRef<number>(0);

  const startListening = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      const vad = await MicVAD.new({
        // Use CDN paths for ONNX runtime and VAD model
        onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
        baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/",
        
        onSpeechStart: () => {
          speechStartTimeRef.current = Date.now();
          setState(prev => ({ ...prev, isSpeaking: true }));
          options.onSpeechStart?.();
        },

        onSpeechEnd: (audio: Float32Array) => {
          const endTime = Date.now();
          const startTime = speechStartTimeRef.current;
          const duration = endTime - startTime;
          
          // Calculate silence since last speech
          if (lastSpeechEndRef.current > 0) {
            const silenceDuration = startTime - lastSpeechEndRef.current;
            setState(prev => ({
              ...prev,
              totalSilenceTime: prev.totalSilenceTime + silenceDuration,
            }));
          }
          lastSpeechEndRef.current = endTime;

          const segment: SpeechSegment = {
            start: startTime - sessionStartTimeRef.current,
            end: endTime - sessionStartTimeRef.current,
            duration,
            audio,
          };

          setState(prev => ({
            ...prev,
            isSpeaking: false,
            speechSegments: [...prev.speechSegments, segment],
            totalSpeechTime: prev.totalSpeechTime + duration,
          }));

          options.onSpeechEnd?.(audio, segment);
        },

        onFrameProcessed: (probs: { isSpeech: number; notSpeech: number }) => {
          const probability = probs.isSpeech;
          setState(prev => ({ ...prev, speechProbability: probability }));
          options.onFrameProcessed?.(probability);
        },
      } as Partial<RealTimeVADOptions>);

      vadRef.current = vad;
      sessionStartTimeRef.current = Date.now();
      lastSpeechEndRef.current = 0;
      
      vad.start();

      setState(prev => ({
        ...prev,
        isListening: true,
        speechSegments: [],
        totalSpeechTime: 0,
        totalSilenceTime: 0,
      }));

    } catch (err) {
      console.error('VAD initialization failed:', err);
      setState(prev => ({
        ...prev,
        error: 'Failed to initialize voice detection. Please check microphone permissions.',
      }));
    }
  }, [options]);

  const stopListening = useCallback(() => {
    if (vadRef.current) {
      vadRef.current.pause();
      vadRef.current.destroy();
      vadRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isListening: false,
      isSpeaking: false,
      speechProbability: 0,
    }));
  }, []);

  const resetSegments = useCallback(() => {
    setState(prev => ({
      ...prev,
      speechSegments: [],
      totalSpeechTime: 0,
      totalSilenceTime: 0,
    }));
    lastSpeechEndRef.current = 0;
  }, []);

  const getSpeechRatio = useCallback(() => {
    const { totalSpeechTime, totalSilenceTime } = state;
    const total = totalSpeechTime + totalSilenceTime;
    if (total === 0) return 0;
    return totalSpeechTime / total;
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vadRef.current) {
        vadRef.current.pause();
        vadRef.current.destroy();
      }
    };
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    resetSegments,
    getSpeechRatio,
  };
}
