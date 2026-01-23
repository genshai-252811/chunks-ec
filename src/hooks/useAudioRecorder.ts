import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  audioBuffer: Float32Array | null;
  audioBase64: string | null;
  sampleRate: number;
  error: string | null;
}

interface UseAudioRecorderReturn extends AudioRecorderState {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  resetRecording: () => void;
  getAudioLevel: () => number;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    audioBlob: null,
    audioBuffer: null,
    audioBase64: null,
    sampleRate: 44100,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelRef = useRef<number>(0);

  const updateAudioLevel = useCallback(() => {
    if (analyzerRef.current) {
      const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
      analyzerRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      audioLevelRef.current = average / 255;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

      // Create audio context for analysis
      audioContextRef.current = new AudioContext({ sampleRate: 44100 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
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

      setState((prev) => ({
        ...prev,
        isRecording: true,
        error: null,
        recordingTime: 0,
      }));

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
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

          // Convert to audio buffer for analysis
          const arrayBuffer = await audioBlob.arrayBuffer();

          if (audioContextRef.current) {
            try {
              const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
              const channelData = audioBuffer.getChannelData(0);

              // Convert to base64 for potential API usage
              const reader = new FileReader();
              reader.readAsDataURL(audioBlob);
              reader.onloadend = () => {
                const base64 = reader.result as string;
                const base64Data = base64.split(',')[1];

                setState((prev) => ({
                  ...prev,
                  isRecording: false,
                  audioBlob,
                  audioBuffer: channelData,
                  audioBase64: base64Data,
                  sampleRate: audioBuffer.sampleRate,
                }));

                resolve();
              };
            } catch (err) {
              console.error('Failed to decode audio:', err);
              setState((prev) => ({
                ...prev,
                isRecording: false,
                error: 'Failed to process audio',
              }));
              resolve();
            }
          }
        };

        mediaRecorderRef.current.stop();
      }

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    });
  }, []);

  const resetRecording = useCallback(() => {
    chunksRef.current = [];
    audioLevelRef.current = 0;

    setState({
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
      audioBlob: null,
      audioBuffer: null,
      audioBase64: null,
      sampleRate: 44100,
      error: null,
    });
  }, []);

  const getAudioLevel = useCallback(() => {
    return audioLevelRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    resetRecording,
    getAudioLevel,
  };
}
