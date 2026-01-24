import { useState, useRef, useCallback, useEffect } from 'react';

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
 * Fixed: Uses state-based stream storage to handle React ref timing
 */
export const useCameraFeed = (): UseCameraFeedReturn => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  // Attach stream to video element when both are available
  useEffect(() => {
    const video = videoRef.current;
    
    if (video && stream) {
      video.srcObject = stream;
      
      // Play video once metadata is loaded
      const handleLoadedMetadata = () => {
        video.play().catch((err) => {
          console.warn('Video play failed:', err);
        });
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      // If already has metadata, play immediately
      if (video.readyState >= 1) {
        video.play().catch(console.warn);
      }

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [stream]);

  const startCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Request camera with front-facing preference
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      // Store stream in state - this triggers the effect to attach it
      setStream(mediaStream);
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
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setHasPermission(false);
    setError(null);
  }, [stream]);

  return {
    videoRef,
    isLoading,
    error,
    hasPermission,
    startCamera,
    stopCamera,
  };
};
