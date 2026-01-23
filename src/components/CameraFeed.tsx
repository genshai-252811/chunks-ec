import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, CameraOff } from 'lucide-react';
import { useCameraFeed } from '@/hooks/useCameraFeed';
import { getGlowClass } from '@/lib/energyCalculator';

interface CameraFeedProps {
  isRecording: boolean;
  audioLevel: number;
}

export function CameraFeed({ isRecording, audioLevel }: CameraFeedProps) {
  const { videoRef, isLoading, error, hasPermission, startCamera, stopCamera } =
    useCameraFeed();

  // Start camera when recording begins
  useEffect(() => {
    if (isRecording) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isRecording, startCamera, stopCamera]);

  const glowClass = getGlowClass(audioLevel);

  if (!isRecording) {
    return null;
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Fullscreen Camera Container */}
      <motion.div
        className={`absolute inset-0 overflow-hidden transition-all duration-300 ${glowClass}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Video Element */}
        {hasPermission && !error && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              transform: 'scaleX(-1)', // Mirror effect for selfie camera
            }}
          />
        )}

        {/* Gradient Overlays for better UI visibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-background/60 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-transparent pointer-events-none" />

        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Camera className="w-12 h-12 text-primary" />
              </motion.div>
              <p className="text-sm text-muted-foreground">Starting camera...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <CameraOff className="w-12 h-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {/* Fallback - Camera not started yet */}
        {!hasPermission && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Camera className="w-12 h-12 text-muted-foreground animate-pulse" />
              <p className="text-sm text-muted-foreground">Camera starting...</p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
