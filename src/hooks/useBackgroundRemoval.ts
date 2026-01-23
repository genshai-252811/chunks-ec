import { useEffect, useRef, useState } from 'react';

interface UseBackgroundRemovalOptions {
  enabled: boolean;
  videoElement: HTMLVideoElement | null;
}

interface UseBackgroundRemovalReturn {
  canvas: HTMLCanvasElement | null;
  isReady: boolean;
  error: string | null;
}

export const useBackgroundRemoval = ({ 
  enabled, 
  videoElement 
}: UseBackgroundRemovalOptions): UseBackgroundRemovalReturn => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!enabled || !videoElement) {
      // Cleanup if disabled
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setIsReady(false);
      return;
    }

    // Create canvas for processing
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simple background blur/dim effect (no MediaPipe for simplicity)
    const processFrame = () => {
      if (!videoElement || !canvas || !ctx) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Match video dimensions
      if (canvas.width !== videoElement.videoWidth || canvas.height !== videoElement.videoHeight) {
        canvas.width = videoElement.videoWidth || 640;
        canvas.height = videoElement.videoHeight || 480;
      }

      // Draw video frame
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    setIsReady(true);
    animationFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, videoElement]);

  return {
    canvas: canvasRef.current,
    isReady,
    error,
  };
};
