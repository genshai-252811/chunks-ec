import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateLUFS } from '@/lib/lufsNormalization';

export interface RealtimeAudioMetrics {
  audioLevel: number; // 0-1 range
  lufs: number | null;
  isActive: boolean;
}

export function useRealtimeAudio(enabled: boolean = false) {
  const [metrics, setMetrics] = useState<RealtimeAudioMetrics>({
    audioLevel: 0,
    lufs: null,
    isActive: false,
  });
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  // Explicit ArrayBuffer generic fixes TS/lib.dom mismatch with getFloatTimeDomainData
  const dataArrayRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const bufferRef = useRef<Float32Array>(new Float32Array(0));
  const bufferIndexRef = useRef(0);
  const smoothedLevelRef = useRef(0);
  const lastLufsRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);

  const updateMetrics = useCallback(() => {
    if (!analyzerRef.current || !dataArrayRef.current) return;

    const analyzer = analyzerRef.current;
    const dataArray = dataArrayRef.current;

    // Get time domain data
    analyzer.getFloatTimeDomainData(dataArray);

    // Calculate RMS level with exponential smoothing to prevent jumpiness
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const rawLevel = Math.min(1, rms * 5);
    // Smooth: 30% old value + 70% new value (same as useEnhancedAudioRecorder)
    smoothedLevelRef.current = smoothedLevelRef.current * 0.3 + rawLevel * 0.7;
    const audioLevel = smoothedLevelRef.current;

    // Store samples for LUFS calculation (need ~400ms of audio)
    const sampleRate = audioContextRef.current?.sampleRate || 48000;
    const requiredSamples = Math.floor(sampleRate * 0.4); // 400ms

    if (bufferRef.current.length !== requiredSamples) {
      bufferRef.current = new Float32Array(requiredSamples);
      bufferIndexRef.current = 0;
    }

    // Add new samples to circular buffer
    for (let i = 0; i < dataArray.length; i++) {
      bufferRef.current[bufferIndexRef.current] = dataArray[i];
      bufferIndexRef.current = (bufferIndexRef.current + 1) % requiredSamples;
    }

    // Calculate LUFS every 6 frames (~10Hz) instead of random 10%.
    // Keep last value between calculations so display doesn't flicker.
    frameCountRef.current++;
    if (frameCountRef.current >= 6) {
      frameCountRef.current = 0;
      try {
        const computed = calculateLUFS(bufferRef.current, sampleRate);
        if (isFinite(computed)) {
          lastLufsRef.current = computed;
        }
      } catch (err) {
        // Silently fail - might not have enough data yet
      }
    }

    setMetrics({
      audioLevel,
      lufs: lastLufsRef.current,
      isActive: audioLevel > 0.01,
    });

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(updateMetrics);
  }, []);

  const startMonitoring = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      streamRef.current = stream;

      // Create audio context
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Create analyzer
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      analyzer.smoothingTimeConstant = 0.8;
      analyzerRef.current = analyzer;

      // Create data array
      const bufferLength = analyzer.fftSize;
      // Ensure underlying buffer is a plain ArrayBuffer (not SharedArrayBuffer)
      dataArrayRef.current = new Float32Array(
        new ArrayBuffer(bufferLength * Float32Array.BYTES_PER_ELEMENT)
      );

      // Connect stream to analyzer
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyzer);

      // Start monitoring
      updateMetrics();

      setError(null);
    } catch (err) {
      console.error('Failed to start audio monitoring:', err);
      setError(err instanceof Error ? err.message : 'Failed to access microphone');
    }
  }, [updateMetrics]);

  const stopMonitoring = useCallback(() => {
    // Stop animation loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Reset refs
    analyzerRef.current = null;
    dataArrayRef.current = null;
    bufferRef.current = new Float32Array(0);
    bufferIndexRef.current = 0;
    smoothedLevelRef.current = 0;
    lastLufsRef.current = null;
    frameCountRef.current = 0;

    // Reset metrics
    setMetrics({
      audioLevel: 0,
      lufs: null,
      isActive: false,
    });
  }, []);

  // Start/stop monitoring based on enabled prop
  useEffect(() => {
    if (enabled) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [enabled, startMonitoring, stopMonitoring]);

  return {
    ...metrics,
    error,
    startMonitoring,
    stopMonitoring,
  };
}
