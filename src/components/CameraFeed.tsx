import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, CameraOff, User } from 'lucide-react';
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
        {/* Video Element - Always rendered for ref availability */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            hasPermission && !error ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            transform: 'scaleX(-1)', // Mirror effect for selfie camera
          }}
        />

        {/* Gradient Overlays for better UI visibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-background/70 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-transparent pointer-events-none" />

        {/* Face Positioning Guide */}
        {hasPermission && !error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              {/* Oval Face Guide */}
              <div 
                className="w-48 h-64 sm:w-56 sm:h-72 md:w-64 md:h-80 rounded-[50%] border-2 border-dashed border-primary/30"
                style={{
                  boxShadow: 'inset 0 0 60px rgba(0,0,0,0.1)',
                }}
              />
              {/* Guide Text */}
              <motion.p
                className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/60 whitespace-nowrap"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                Position your face here
              </motion.p>
            </motion.div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <motion.div
                className="relative"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary" />
              </motion.div>
              <motion.p 
                className="text-sm text-muted-foreground"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Starting camera...
              </motion.p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/95 backdrop-blur-sm">
            <motion.div 
              className="flex flex-col items-center gap-4 px-6 text-center max-w-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <CameraOff className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground">{error}</p>
              <p className="text-xs text-muted-foreground/60">
                You can still practice without the camera
              </p>
            </motion.div>
          </div>
        )}

        {/* Fallback - Camera not started yet */}
        {!hasPermission && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm">
            <motion.div 
              className="flex flex-col items-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="relative">
                <motion.div
                  className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <User className="w-10 h-10 text-primary/60" />
                </motion.div>
                <motion.div
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Camera className="w-4 h-4 text-primary" />
                </motion.div>
              </div>
              <p className="text-sm text-muted-foreground">Requesting camera access...</p>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
