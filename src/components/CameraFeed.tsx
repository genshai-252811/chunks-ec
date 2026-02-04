import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FloatingEnergyIndicator } from './FloatingEnergyIndicator';

interface CameraFeedProps {
  isRecording?: boolean;
  audioLevel?: number;
  className?: string;
  fullscreen?: boolean;
}

export function CameraFeed({ 
  isRecording = false,
  audioLevel = 0,
  className,
  fullscreen = false
}: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  // Start camera on mount
  useEffect(() => {
    let mounted = true;

    const initCamera = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setIsActive(true);
        setIsLoading(false);
      } catch (err) {
        if (!mounted) return;
        
        let msg = 'Camera access failed';
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') msg = 'Please allow camera access';
          else if (err.name === 'NotFoundError') msg = 'No camera found';
          else if (err.name === 'NotReadableError') msg = 'Camera in use';
        }
        setError(msg);
        setIsLoading(false);
      }
    };

    initCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const glowIntensity = isRecording ? Math.min(audioLevel / 100, 1) : 0;

  return (
    <div className={cn(
      "relative overflow-hidden bg-card",
      fullscreen ? "w-full h-full" : "w-full h-full rounded-2xl",
      className
    )}>
      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
          isActive ? "opacity-100" : "opacity-0"
        )}
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Floating Energy Indicator above head */}
      <FloatingEnergyIndicator 
        audioLevel={audioLevel} 
        isActive={isRecording && isActive} 
      />

      {/* Energy Glow during recording */}
      {isRecording && isActive && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 ${30 + glowIntensity * 60}px rgba(34, 211, 238, ${0.15 + glowIntensity * 0.35})`,
          }}
          animate={{
            boxShadow: [
              `inset 0 0 ${30 + glowIntensity * 60}px rgba(34, 211, 238, ${0.15 + glowIntensity * 0.35})`,
              `inset 0 0 ${50 + glowIntensity * 80}px rgba(34, 211, 238, ${0.25 + glowIntensity * 0.45})`,
              `inset 0 0 ${30 + glowIntensity * 60}px rgba(34, 211, 238, ${0.15 + glowIntensity * 0.35})`,
            ],
          }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card">
          <motion.div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Camera className="w-10 h-10 text-primary" />
            </motion.div>
            <p className="text-sm text-muted-foreground">Starting camera...</p>
          </motion.div>
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card">
          <motion.div
            className="flex flex-col items-center gap-4 text-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-destructive" />
            </div>
            <p className="text-muted-foreground">{error}</p>
          </motion.div>
        </div>
      )}

      {/* Face Guide (idle only) */}
      {isActive && !isRecording && !fullscreen && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            className="w-36 h-48 rounded-[50%] border-2 border-dashed border-primary/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          />
        </div>
      )}

      {/* Corner Frame (idle only) */}
      {!fullscreen && (
        <>
          <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-primary/40 rounded-tl-lg" />
          <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-primary/40 rounded-tr-lg" />
          <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-primary/40 rounded-bl-lg" />
          <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-primary/40 rounded-br-lg" />
        </>
      )}
    </div>
  );
}
