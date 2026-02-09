import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, VideoOff, Eye, EyeOff, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FloatingEnergyIndicator } from './FloatingEnergyIndicator';
import { CanvasFaceOverlay } from './CanvasFaceOverlay';
import { useFaceTracking, FaceTrackingMetrics } from '@/hooks/useFaceTracking';
import { Button } from '@/components/ui/button';
import { areVideoMetricsEnabled } from '@/lib/metricUtils';

interface CameraFeedProps {
  isRecording?: boolean;
  audioLevel?: number;
  className?: string;
  fullscreen?: boolean;
  onFaceMetricsUpdate?: (metrics: FaceTrackingMetrics) => void;
}

export function CameraFeed({
  isRecording = false,
  audioLevel = 0,
  className,
  fullscreen = false,
  onFaceMetricsUpdate
}: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({ width: 1280, height: 720 });
  const [showMesh, setShowMesh] = useState(true);
  const [videoMetricsEnabled, setVideoMetricsEnabled] = useState(false);

  const {
    isTracking,
    isModelLoaded,
    metrics: faceMetrics,
    getCurrentFace,
    startTracking,
    stopTracking,
    processFrame
  } = useFaceTracking();

  // Check video metrics status on mount
  useEffect(() => {
    const enabled = areVideoMetricsEnabled();
    setVideoMetricsEnabled(enabled);
  }, []);

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
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              setVideoDimensions({
                width: videoRef.current.videoWidth,
                height: videoRef.current.videoHeight,
              });
            }
          };
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

  // Start/stop face tracking when recording state changes (only if video metrics enabled)
  useEffect(() => {
    if (isRecording && isActive && videoMetricsEnabled) {
      startTracking();
    } else if (!isRecording && isTracking) {
      stopTracking();
    }
  }, [isRecording, isActive, isTracking, videoMetricsEnabled, startTracking, stopTracking]);

  // Process video frames for face tracking
  useEffect(() => {
    if (!isTracking || !videoRef.current) return;

    let frameId: number;
    let lastTime = 0;
    const targetInterval = 16; // ~60fps (inference throttled inside processFrame)

    const loop = (time: number) => {
      if (time - lastTime >= targetInterval) {
        if (videoRef.current && isTracking) {
          processFrame(videoRef.current);
        }
        lastTime = time;
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isTracking, processFrame]);

  // Report face metrics to parent (always update when metrics change, not just during tracking)
  useEffect(() => {
    if (onFaceMetricsUpdate && faceMetrics) {
      onFaceMetricsUpdate(faceMetrics);
    }
  }, [faceMetrics, onFaceMetricsUpdate]);

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

      {/* Face Tracking Overlay (Canvas-based for performance) */}
      {videoMetricsEnabled && showMesh && (
        <CanvasFaceOverlay
          getCurrentFace={getCurrentFace}
          isTracking={isTracking}
          isModelLoaded={isModelLoaded}
          videoWidth={videoDimensions.width}
          videoHeight={videoDimensions.height}
        />
      )}

      {/* Mesh Toggle Button */}
      <AnimatePresence>
        {videoMetricsEnabled && isActive && (
          <motion.div
            className="absolute bottom-4 right-4 z-30"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setShowMesh(!showMesh);
              }}
              className={cn(
                "rounded-full bg-background/60 backdrop-blur-sm hover:bg-background/80",
                showMesh && "text-primary"
              )}
              title={showMesh ? "Hide face mesh" : "Show face mesh"}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Energy Indicator above head */}
      <FloatingEnergyIndicator
        audioLevel={audioLevel}
        isActive={isRecording && isActive}
      />

      {/* Eye Contact Indicator */}
      <AnimatePresence>
        {videoMetricsEnabled && isRecording && isActive && (
          <motion.div
            className="absolute top-4 right-4 flex items-center gap-2 bg-background/60 backdrop-blur-sm px-3 py-1.5 rounded-full z-30"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            {faceMetrics.isLookingAtCamera ? (
              <>
                <Eye className="w-4 h-4 text-primary" />
                <span className="text-xs text-primary font-medium">Eye Contact</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 text-accent" />
                <span className="text-xs text-accent font-medium">Look at camera</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Face Tracking Stats (during recording) */}
      <AnimatePresence>
        {videoMetricsEnabled && isRecording && isActive && fullscreen && (
          <motion.div
            className="absolute bottom-24 left-4 flex flex-col gap-1 bg-background/60 backdrop-blur-sm px-3 py-2 rounded-lg z-30"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{faceMetrics.eyeContactScore}%</span> eye contact
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{faceMetrics.handMovementScore}</span> hand movement
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{faceMetrics.blinkRate}</span> blinks/min
            </div>
            {faceMetrics.handsDetected > 0 && (
              <div className="text-xs text-primary">
                🖐️ {faceMetrics.handsDetected} hand{faceMetrics.handsDetected > 1 ? 's' : ''} detected
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
