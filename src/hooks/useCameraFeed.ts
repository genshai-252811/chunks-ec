import { useState, useRef, useCallback, useEffect } from 'react';

interface UseCameraFeedReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isLoading: boolean;
  error: string | null;
  isActive: boolean;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

/**
 * Simple camera feed hook
 */
export const useCameraFeed = (): UseCameraFeedReturn => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setError(null);
  }, []);

  const startCamera = useCallback(async () => {
    // Prevent multiple starts
    if (streamRef.current || isLoading) return;

    try {
      setIsLoading(true);
      setError(null);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;

      // Attach to video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Wait for video to be ready then play
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.warn);
        };
      }

      setIsActive(true);
      setIsLoading(false);
    } catch (err) {
      console.error('Camera error:', err);
      
      let msg = 'Could not access camera';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') msg = 'Camera access denied. Please allow permission.';
        else if (err.name === 'NotFoundError') msg = 'No camera found';
        else if (err.name === 'NotReadableError') msg = 'Camera in use by another app';
      }

      setError(msg);
      setIsLoading(false);
      setIsActive(false);
    }
  }, [isLoading]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    videoRef,
    isLoading,
    error,
    isActive,
    startCamera,
    stopCamera,
  };
};
