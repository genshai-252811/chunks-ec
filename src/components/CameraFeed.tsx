import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Video, VideoOff } from 'lucide-react';
import { useCameraFeed } from '@/hooks/useCameraFeed';
import { cn } from '@/lib/utils';

interface CameraFeedProps {
  autoStart?: boolean;
  isRecording?: boolean;
  audioLevel?: number;
  className?: string;
}

export function CameraFeed({ 
  autoStart = true, 
  isRecording = false,
  audioLevel = 0,
  className 
}: CameraFeedProps) {
  const { videoRef, isLoading, error, isActive, startCamera, stopCamera } = useCameraFeed();

  // Auto-start camera on mount
  useEffect(() => {
    if (autoStart) {
      startCamera();
    }
    return () => stopCamera();
  }, [autoStart, startCamera, stopCamera]);

  // Dynamic glow based on audio level during recording
  const glowIntensity = isRecording ? Math.min(audioLevel / 100, 1) : 0;

  return (
    <div className={cn("relative w-full h-full overflow-hidden rounded-2xl", className)}>
      {/* Video Element - Always rendered */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          isActive ? "opacity-100" : "opacity-0"
        )}
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Energy Glow Border during recording */}
      {isRecording && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            boxShadow: `inset 0 0 ${20 + glowIntensity * 40}px rgba(34, 211, 238, ${0.2 + glowIntensity * 0.4})`,
            border: `2px solid rgba(34, 211, 238, ${0.3 + glowIntensity * 0.5})`,
          }}
          animate={{
            boxShadow: [
              `inset 0 0 ${20 + glowIntensity * 40}px rgba(34, 211, 238, ${0.2 + glowIntensity * 0.4})`,
              `inset 0 0 ${30 + glowIntensity * 50}px rgba(34, 211, 238, ${0.3 + glowIntensity * 0.5})`,
              `inset 0 0 ${20 + glowIntensity * 40}px rgba(34, 211, 238, ${0.2 + glowIntensity * 0.4})`,
            ],
          }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/90 backdrop-blur-sm">
          <motion.div
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Camera className="w-8 h-8 text-primary" />
            </motion.div>
            <p className="text-sm text-muted-foreground">Starting camera...</p>
          </motion.div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/95 backdrop-blur-sm">
          <motion.div
            className="flex flex-col items-center gap-3 text-center px-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <VideoOff className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={startCamera}
              className="mt-2 px-4 py-2 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
            >
              Try Again
            </button>
          </motion.div>
        </div>
      )}

      {/* Inactive State (before permission) */}
      {!isActive && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/90 backdrop-blur-sm">
          <motion.div
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Video className="w-8 h-8 text-primary" />
            </motion.div>
            <p className="text-sm text-muted-foreground">Camera ready</p>
          </motion.div>
        </div>
      )}

      {/* Face Guide Overlay (subtle) */}
      {isActive && !isRecording && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            className="w-32 h-40 sm:w-40 sm:h-52 rounded-[50%] border border-dashed border-primary/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          />
        </div>
      )}

      {/* Corner Decorations */}
      <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-primary/30 rounded-tl-lg" />
      <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-primary/30 rounded-tr-lg" />
      <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-primary/30 rounded-bl-lg" />
      <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-primary/30 rounded-br-lg" />
    </div>
  );
}
