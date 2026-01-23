import { useState, useRef, useCallback } from 'react';

interface UseCameraFeedReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

/**
 * Hook to manage camera feed stream
 */
export const useCameraFeed = (): UseCameraFeedReturn => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Request camera with front-facing preference
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // Front camera
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: false, // We're already handling audio separately
      });

      streamRef.current = stream;

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure video plays
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.warn('Auto-play prevented, will retry:', playError);
        }
      }

      setHasPermission(true);
      setIsLoading(false);
    } catch (err) {
      console.error('Camera access error:', err);

      let errorMessage = 'Could not access camera';

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Camera access denied. Please allow camera permission.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Camera is in use by another app.';
        }
      }

      setError(errorMessage);
      setIsLoading(false);
      setHasPermission(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setHasPermission(false);
    setError(null);
  }, []);

  return {
    videoRef,
    isLoading,
    error,
    hasPermission,
    startCamera,
    stopCamera,
  };
};
