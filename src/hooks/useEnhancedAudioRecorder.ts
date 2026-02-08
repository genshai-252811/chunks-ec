import { useState, useRef, useCallback, useEffect } from 'react';
import { MicVAD } from '@ricky0123/vad-web';
import { getSensitivity } from './useDisplaySettings';

// Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognition;
    SpeechRecognition: new () => SpeechRecognition;
  }
}

// Helper: read speech rate method from localStorage metricConfig
function getSpeechRateMethodFromConfig(): string {
  try {
    const raw = localStorage.getItem('metricConfig');
    if (!raw) return 'spectral-flux';
    const configs = JSON.parse(raw);
    const speechRateConfig = Array.isArray(configs)
      ? configs.find((c: any) => c.id === 'speechRate')
      : null;
    const method = speechRateConfig?.method;
    console.log('🔧 [STT Config] speechRate method from localStorage:', method);
    return method || 'spectral-flux';
  } catch {
    return 'spectral-flux';
  }
}

// Helper: read STT language from localStorage
function getSttLanguageFromConfig(): string {
  try {
    return localStorage.getItem('sttLanguage') || 'en-US';
  } catch {
    return 'en-US';
  }
}

export interface SpeechSegment {
  start: number;
  end: number;
  duration: number;
}

export interface VADMetrics {
  speechSegments: SpeechSegment[];
  totalSpeechTime: number;
  totalSilenceTime: number;
  speechRatio: number;
  isSpeaking: boolean;
  speechProbability: number;
}

interface EnhancedAudioRecorderState {
  isRecording: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  audioBuffer: Float32Array | null;
  audioBase64: string | null;
  sampleRate: number;
  error: string | null;
  vadMetrics: VADMetrics;
  isVADReady: boolean;
  deviceId: string | null;
  deviceLabel: string | null;
  sttWordCount: number;
  sttTranscript: string;
  sttSupported: boolean;
  sttError: string | null;
}

interface UseEnhancedAudioRecorderReturn extends EnhancedAudioRecorderState {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  resetRecording: () => void;
  getAudioLevel: () => number;
  getSpeechProbability: () => number;
}

const initialVADMetrics: VADMetrics = {
  speechSegments: [],
  totalSpeechTime: 0,
  totalSilenceTime: 0,
  speechRatio: 0,
  isSpeaking: false,
  speechProbability: 0,
};

export function useEnhancedAudioRecorder(): UseEnhancedAudioRecorderReturn {
  const [state, setState] = useState<EnhancedAudioRecorderState>({
    isRecording: false,
    recordingTime: 0,
    audioBlob: null,
    audioBuffer: null,
    audioBase64: null,
    sampleRate: 44100,
    error: null,
    vadMetrics: initialVADMetrics,
    isVADReady: false,
    deviceId: null,
    deviceLabel: null,
    sttWordCount: 0,
    sttTranscript: '',
    sttSupported: typeof window !== 'undefined' && !!(window.webkitSpeechRecognition || window.SpeechRecognition),
    sttError: null,
  });

  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelRef = useRef<number>(0);
  
  // VAD refs
  const vadRef = useRef<MicVAD | null>(null);
  const speechStartTimeRef = useRef<number>(0);
  const sessionStartTimeRef = useRef<number>(0);
  const lastSpeechEndRef = useRef<number>(0);
  const speechProbabilityRef = useRef<number>(0);
  const speechSegmentsRef = useRef<SpeechSegment[]>([]);
  const totalSpeechTimeRef = useRef<number>(0);
  const totalSilenceTimeRef = useRef<number>(0);

  // STT (Web Speech API) refs
  const sttRef = useRef<SpeechRecognition | null>(null);
  const sttWordCountRef = useRef<number>(0);
  const sttTranscriptRef = useRef<string>('');
  const isRecordingRef = useRef<boolean>(false); // track recording state for STT onend restart

  const updateAudioLevel = useCallback(() => {
    if (analyzerRef.current) {
      const dataArray = new Uint8Array(analyzerRef.current.fftSize);
      analyzerRef.current.getByteTimeDomainData(dataArray);
      
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      
      const sensitivity = getSensitivity();
      const boostedLevel = Math.min(rms * sensitivity, 1.0);
      
      audioLevelRef.current = audioLevelRef.current * 0.3 + boostedLevel * 0.7;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Reset VAD metrics
      speechSegmentsRef.current = [];
      totalSpeechTimeRef.current = 0;
      totalSilenceTimeRef.current = 0;
      sessionStartTimeRef.current = Date.now();
      lastSpeechEndRef.current = 0;

      // Initialize VAD
      console.log('Initializing Silero VAD...');
      const vad = await MicVAD.new({
        onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
        baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/",
        
        onSpeechStart: () => {
          console.log('VAD: Speech started');
          speechStartTimeRef.current = Date.now();
          setState(prev => ({
            ...prev,
            vadMetrics: { ...prev.vadMetrics, isSpeaking: true },
          }));
        },

        onSpeechEnd: (audio: Float32Array) => {
          console.log('VAD: Speech ended');
          const endTime = Date.now();
          speechStartTimeRef.current = 0; // Reset so flush doesn't double-count
          const startTime = speechStartTimeRef.current;
          const duration = endTime - startTime;
          
          // Calculate silence since last speech
          if (lastSpeechEndRef.current > 0) {
            const silenceDuration = startTime - lastSpeechEndRef.current;
            totalSilenceTimeRef.current += silenceDuration;
          }
          lastSpeechEndRef.current = endTime;

          const segment: SpeechSegment = {
            start: startTime - sessionStartTimeRef.current,
            end: endTime - sessionStartTimeRef.current,
            duration,
          };

          speechSegmentsRef.current.push(segment);
          totalSpeechTimeRef.current += duration;

          const total = totalSpeechTimeRef.current + totalSilenceTimeRef.current;
          const speechRatio = total > 0 ? totalSpeechTimeRef.current / total : 0;

          setState(prev => ({
            ...prev,
            vadMetrics: {
              ...prev.vadMetrics,
              isSpeaking: false,
              speechSegments: [...speechSegmentsRef.current],
              totalSpeechTime: totalSpeechTimeRef.current,
              totalSilenceTime: totalSilenceTimeRef.current,
              speechRatio,
            },
          }));
        },

        onFrameProcessed: (probs: { isSpeech: number; notSpeech: number }) => {
          speechProbabilityRef.current = probs.isSpeech;
          setState(prev => ({
            ...prev,
            vadMetrics: { ...prev.vadMetrics, speechProbability: probs.isSpeech },
          }));
        },
      });

      vadRef.current = vad;
      vad.start();
      console.log('VAD started successfully');
      setState(prev => ({ ...prev, isVADReady: true }));

      // Get microphone stream for audio recording
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

      // Capture device information
      const audioTrack = stream.getAudioTracks()[0];
      const deviceId = audioTrack.getSettings().deviceId || 'default';
      const deviceLabel = audioTrack.label || 'Default Microphone';

      console.log('🎤 Audio Device:', { deviceId, deviceLabel });

      // Create audio context for level analysis
      audioContextRef.current = new AudioContext({ sampleRate: 44100 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 512;
      analyzerRef.current.smoothingTimeConstant = 0.3;
      source.connect(analyzerRef.current);

      // Start updating audio level
      const levelInterval = setInterval(updateAudioLevel, 50);

      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);

      // Start timer
      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, recordingTime: prev.recordingTime + 1 }));
      }, 1000);

      isRecordingRef.current = true;

      setState((prev) => ({
        ...prev,
        isRecording: true,
        error: null,
        recordingTime: 0,
        deviceId,
        deviceLabel,
        sttWordCount: 0,
        sttTranscript: '',
        sttError: null,
      }));

      // Start Web Speech API if method is configured as "web-speech-api"
      const sttMethod = getSpeechRateMethodFromConfig();
      const hasSttSupport = typeof window !== 'undefined' && !!(window.webkitSpeechRecognition || window.SpeechRecognition);

      if (sttMethod === 'web-speech-api' && hasSttSupport) {
        try {
          const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
          const recognition = new SpeechRecognitionCtor();
          recognition.continuous = true;
          recognition.interimResults = false;
          recognition.lang = getSttLanguageFromConfig();

          recognition.onresult = (event: SpeechRecognitionEvent) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                const transcript = event.results[i][0].transcript.trim();
                if (transcript) {
                  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
                  sttWordCountRef.current += wordCount;
                  sttTranscriptRef.current += (sttTranscriptRef.current ? ' ' : '') + transcript;
                  console.log(`🗣️ STT: "${transcript}" (+${wordCount} words, total=${sttWordCountRef.current})`);
                }
              }
            }
          };

          recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            // "no-speech" and "aborted" are expected, don't treat as errors
            if (event.error === 'no-speech' || event.error === 'aborted') return;
            console.warn('🗣️ STT error:', event.error, event.message);
            setState(prev => ({ ...prev, sttError: event.error }));
          };

          // Chrome stops recognition after ~60s of silence; auto-restart if still recording
          recognition.onend = () => {
            if (isRecordingRef.current && sttRef.current) {
              try {
                console.log('🗣️ STT: auto-restarting (Chrome timeout)');
                sttRef.current.start();
              } catch (e) {
                // Already started or other issue — ignore
              }
            }
          };

          sttRef.current = recognition;
          recognition.start();
          console.log('🗣️ Web Speech API started (lang=' + recognition.lang + ')');
        } catch (err) {
          console.warn('🗣️ Failed to start Web Speech API:', err);
          setState(prev => ({ ...prev, sttError: 'Failed to start speech recognition' }));
        }
      }

      // Cleanup function for level interval
      mediaRecorder.onstop = () => {
        clearInterval(levelInterval);
      };
    } catch (err) {
      console.error('Failed to start recording:', err);
      setState((prev) => ({
        ...prev,
        error: 'Could not access microphone. Please grant permission.',
      }));
    }
  }, [updateAudioLevel]);

  const stopRecording = useCallback(async () => {
    return new Promise<void>((resolve) => {
      isRecordingRef.current = false;

      // Stop Web Speech API
      if (sttRef.current) {
        try {
          sttRef.current.abort();
        } catch (e) {
          // ignore
        }
        sttRef.current = null;
      }

      // Stop VAD — flush any in-progress speech segment before destroying
      if (vadRef.current) {
        // If VAD detected speech start but hasn't fired onSpeechEnd yet,
        // manually close the segment so it isn't lost
        if (speechStartTimeRef.current > 0) {
          const endTime = Date.now();
          const startTime = speechStartTimeRef.current;
          const duration = endTime - startTime;

          // Only add if it looks like real speech (>100ms)
          if (duration > 100) {
            if (lastSpeechEndRef.current > 0) {
              const silenceDuration = startTime - lastSpeechEndRef.current;
              totalSilenceTimeRef.current += silenceDuration;
            }
            lastSpeechEndRef.current = endTime;

            const segment: SpeechSegment = {
              start: startTime - sessionStartTimeRef.current,
              end: endTime - sessionStartTimeRef.current,
              duration,
            };

            speechSegmentsRef.current.push(segment);
            totalSpeechTimeRef.current += duration;
            console.log(`🎤 VAD: Flushed in-progress speech segment (${duration}ms)`);
          }
          speechStartTimeRef.current = 0;
        }

        vadRef.current.pause();
        vadRef.current.destroy();
        vadRef.current = null;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();

          if (audioContextRef.current) {
            try {
              const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
              const channelData = audioBuffer.getChannelData(0);

              const reader = new FileReader();
              reader.readAsDataURL(audioBlob);
              reader.onloadend = () => {
                const base64 = reader.result as string;
                const base64Data = base64.split(',')[1];

                // Calculate final speech ratio
                const total = totalSpeechTimeRef.current + totalSilenceTimeRef.current;
                const speechRatio = total > 0 ? totalSpeechTimeRef.current / total : 0;

                setState((prev) => ({
                  ...prev,
                  isRecording: false,
                  isVADReady: false,
                  audioBlob,
                  audioBuffer: channelData,
                  audioBase64: base64Data,
                  sampleRate: audioBuffer.sampleRate,
                  vadMetrics: {
                    ...prev.vadMetrics,
                    speechSegments: [...speechSegmentsRef.current],
                    totalSpeechTime: totalSpeechTimeRef.current,
                    totalSilenceTime: totalSilenceTimeRef.current,
                    speechRatio,
                  },
                  sttWordCount: sttWordCountRef.current,
                  sttTranscript: sttTranscriptRef.current,
                }));

                resolve();
              };
            } catch (err) {
              console.error('Failed to decode audio:', err);
              setState((prev) => ({
                ...prev,
                isRecording: false,
                isVADReady: false,
                error: 'Failed to process audio',
              }));
              resolve();
            }
          }
        };

        mediaRecorderRef.current.stop();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    });
  }, []);

  const resetRecording = useCallback(() => {
    chunksRef.current = [];
    audioLevelRef.current = 0;
    speechSegmentsRef.current = [];
    totalSpeechTimeRef.current = 0;
    totalSilenceTimeRef.current = 0;
    speechProbabilityRef.current = 0;
    sttWordCountRef.current = 0;
    sttTranscriptRef.current = '';

    setState({
      isRecording: false,
      recordingTime: 0,
      audioBlob: null,
      audioBuffer: null,
      audioBase64: null,
      sampleRate: 44100,
      error: null,
      vadMetrics: initialVADMetrics,
      isVADReady: false,
      deviceId: null,
      deviceLabel: null,
      sttWordCount: 0,
      sttTranscript: '',
      sttSupported: typeof window !== 'undefined' && !!(window.webkitSpeechRecognition || window.SpeechRecognition),
      sttError: null,
    });
  }, []);

  const getAudioLevel = useCallback(() => {
    return audioLevelRef.current;
  }, []);

  const getSpeechProbability = useCallback(() => {
    return speechProbabilityRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (vadRef.current) {
        vadRef.current.pause();
        vadRef.current.destroy();
      }
      if (sttRef.current) {
        try { sttRef.current.abort(); } catch (e) { /* ignore */ }
        sttRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    resetRecording,
    getAudioLevel,
    getSpeechProbability,
  };
}
