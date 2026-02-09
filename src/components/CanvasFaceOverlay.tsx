import { useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FaceLandmarks } from '@/hooks/useFaceTracking';
import { cn } from '@/lib/utils';

interface CanvasFaceOverlayProps {
  getCurrentFace: () => FaceLandmarks | null;
  isTracking: boolean;
  isModelLoaded: boolean;
  videoWidth: number;
  videoHeight: number;
  className?: string;
}

// Key landmark indices for visualization (same as original FaceTrackingOverlay)
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const LEFT_EYE = [33, 160, 158, 133, 153, 144, 163, 7, 33];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380, 381, 249, 362];
const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];

// Colors (CSS custom property values read at runtime)
const PRIMARY_COLOR = 'rgba(34, 211, 238, 0.6)';   // cyan-400 / primary
const ACCENT_COLOR = 'rgba(167, 139, 250, 0.7)';    // violet-400 / accent
const DOT_COLOR = 'rgba(34, 211, 238, 0.3)';        // primary at 0.3

// Lerp factor for smooth animation between inference frames
const LERP_FACTOR = 0.3;

export function CanvasFaceOverlay({
  getCurrentFace,
  isTracking,
  isModelLoaded,
  videoWidth,
  videoHeight,
  className,
}: CanvasFaceOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const prevKeypointsRef = useRef<Array<{ x: number; y: number }> | null>(null);
  const displayKeypointsRef = useRef<Array<{ x: number; y: number }> | null>(null);
  const prevBoxRef = useRef<{ xMin: number; yMin: number; xMax: number; yMax: number } | null>(null);
  const displayBoxRef = useRef<{ xMin: number; yMin: number; xMax: number; yMax: number } | null>(null);
  const hasFaceRef = useRef(false);

  // Draw a path from landmark indices
  const drawPath = useCallback((
    ctx: CanvasRenderingContext2D,
    keypoints: Array<{ x: number; y: number }>,
    indices: number[],
    color: string,
    lineWidth: number,
  ) => {
    const points = indices.map(i => keypoints[i]).filter(Boolean);
    if (points.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  }, []);

  // Main draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get current face data from ref (no state, no re-render)
    const face = getCurrentFace();

    if (face && face.keypoints && face.keypoints.length > 0) {
      hasFaceRef.current = true;
      const targetKeypoints = face.keypoints;

      // Lerp keypoints for smooth animation
      if (!displayKeypointsRef.current || displayKeypointsRef.current.length !== targetKeypoints.length) {
        // First frame or landmark count changed — snap to position
        displayKeypointsRef.current = targetKeypoints.map(kp => ({ x: kp.x, y: kp.y }));
      } else {
        // Lerp each keypoint toward target
        for (let i = 0; i < displayKeypointsRef.current.length; i++) {
          const target = targetKeypoints[i];
          if (!target) continue;
          displayKeypointsRef.current[i].x += (target.x - displayKeypointsRef.current[i].x) * LERP_FACTOR;
          displayKeypointsRef.current[i].y += (target.y - displayKeypointsRef.current[i].y) * LERP_FACTOR;
        }
      }
      prevKeypointsRef.current = displayKeypointsRef.current;

      // Lerp bounding box
      if (face.box) {
        if (!displayBoxRef.current) {
          displayBoxRef.current = { ...face.box };
        } else {
          displayBoxRef.current.xMin += (face.box.xMin - displayBoxRef.current.xMin) * LERP_FACTOR;
          displayBoxRef.current.yMin += (face.box.yMin - displayBoxRef.current.yMin) * LERP_FACTOR;
          displayBoxRef.current.xMax += (face.box.xMax - displayBoxRef.current.xMax) * LERP_FACTOR;
          displayBoxRef.current.yMax += (face.box.yMax - displayBoxRef.current.yMax) * LERP_FACTOR;
        }
        prevBoxRef.current = displayBoxRef.current;
      }

      const kp = displayKeypointsRef.current;

      // Draw bounding box (dashed)
      if (displayBoxRef.current) {
        const box = displayBoxRef.current;
        ctx.strokeStyle = PRIMARY_COLOR;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.globalAlpha = 0.5;
        ctx.strokeRect(box.xMin, box.yMin, box.xMax - box.xMin, box.yMax - box.yMin);
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // Draw face oval
      drawPath(ctx, kp, FACE_OVAL, PRIMARY_COLOR, 1.5);

      // Draw eyes
      drawPath(ctx, kp, LEFT_EYE, ACCENT_COLOR, 1.5);
      drawPath(ctx, kp, RIGHT_EYE, ACCENT_COLOR, 1.5);

      // Draw lips
      drawPath(ctx, kp, LIPS_OUTER, PRIMARY_COLOR, 1);

      // Draw keypoint dots (first 100 for performance)
      ctx.fillStyle = DOT_COLOR;
      const dotCount = Math.min(100, kp.length);
      for (let i = 0; i < dotCount; i++) {
        const p = kp[i];
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      hasFaceRef.current = false;
      // Keep displaying last known position briefly (fades naturally since no update)
    }

    // Schedule next frame
    animationFrameRef.current = requestAnimationFrame(draw);
  }, [getCurrentFace, drawPath]);

  // Start/stop draw loop based on tracking state
  useEffect(() => {
    if (!isTracking) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
      // Clear canvas when not tracking
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      prevKeypointsRef.current = null;
      displayKeypointsRef.current = null;
      prevBoxRef.current = null;
      displayBoxRef.current = null;
      return;
    }

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
    };
  }, [isTracking, draw]);

  return (
    <div className={cn("absolute inset-0 pointer-events-none z-20", className)}>
      {/* Status indicators (React/framer-motion — update rarely) */}
      {!isModelLoaded && (
        <motion.div
          className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <motion.div
            className="w-3 h-3 rounded-full bg-accent"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          <span className="text-xs text-muted-foreground">Loading face detection...</span>
        </motion.div>
      )}

      {isModelLoaded && !isTracking && (
        <motion.div
          className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">Face detection ready</span>
        </motion.div>
      )}

      {isTracking && (
        <motion.div
          className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <motion.div
            className={cn(
              "w-3 h-3 rounded-full",
              hasFaceRef.current ? "bg-primary" : "bg-accent"
            )}
            animate={hasFaceRef.current ? {} : { scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          <span className="text-xs text-muted-foreground">
            {hasFaceRef.current ? "Face detected" : "Looking for face..."}
          </span>
        </motion.div>
      )}

      {/* Canvas overlay — imperative drawing, no React re-renders */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        width={videoWidth}
        height={videoHeight}
        style={{ transform: 'scaleX(-1)' }}
      />
    </div>
  );
}
