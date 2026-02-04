import { motion } from 'framer-motion';
import { FaceLandmarks } from '@/hooks/useFaceTracking';
import { cn } from '@/lib/utils';

interface FaceTrackingOverlayProps {
  face: FaceLandmarks | null;
  isTracking: boolean;
  isModelLoaded: boolean;
  videoWidth: number;
  videoHeight: number;
  className?: string;
}

// Key landmark indices for visualization
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const LEFT_EYE = [33, 160, 158, 133, 153, 144, 163, 7, 33];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380, 381, 249, 362];
const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];

export function FaceTrackingOverlay({ 
  face, 
  isTracking, 
  isModelLoaded,
  videoWidth,
  videoHeight,
  className 
}: FaceTrackingOverlayProps) {
  // Calculate scale factors for display
  const scaleX = (x: number) => (x / videoWidth) * 100;
  const scaleY = (y: number) => (y / videoHeight) * 100;

  const drawPath = (indices: number[]) => {
    if (!face?.keypoints) return '';
    const points = indices.map(i => face.keypoints[i]).filter(Boolean);
    if (points.length < 2) return '';
    
    return points.map((p, i) => 
      `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)}% ${scaleY(p.y)}%`
    ).join(' ') + ' Z';
  };

  return (
    <div className={cn("absolute inset-0 pointer-events-none z-20", className)}>
      {/* Loading indicator */}
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

      {/* Model ready indicator */}
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

      {/* Face detected indicator during tracking */}
      {isTracking && (
        <motion.div 
          className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <motion.div 
            className={cn(
              "w-3 h-3 rounded-full",
              face ? "bg-primary" : "bg-accent"
            )}
            animate={face ? {} : { scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          <span className="text-xs text-muted-foreground">
            {face ? "Face detected ✓" : "Looking for face..."}
          </span>
        </motion.div>
      )}

      {/* Face mesh overlay */}
      {face && isTracking && (
        <svg 
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Face bounding box */}
          {face.box && (
            <motion.rect
              x={`${scaleX(face.box.xMin)}%`}
              y={`${scaleY(face.box.yMin)}%`}
              width={`${scaleX(face.box.xMax - face.box.xMin)}%`}
              height={`${scaleY(face.box.yMax - face.box.yMin)}%`}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="0.2"
              strokeDasharray="1 1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
            />
          )}

          {/* Face oval outline */}
          <motion.path
            d={drawPath(FACE_OVAL)}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="0.15"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.6 }}
            transition={{ duration: 0.5 }}
          />

          {/* Left eye */}
          <motion.path
            d={drawPath(LEFT_EYE)}
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="0.15"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
          />

          {/* Right eye */}
          <motion.path
            d={drawPath(RIGHT_EYE)}
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="0.15"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
          />

          {/* Lips */}
          <motion.path
            d={drawPath(LIPS_OUTER)}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="0.1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
          />

          {/* Key landmark dots */}
          {face.keypoints.slice(0, 100).map((kp, i) => (
            <circle
              key={i}
              cx={`${scaleX(kp.x)}%`}
              cy={`${scaleY(kp.y)}%`}
              r="0.15"
              fill="hsl(var(--primary))"
              opacity="0.3"
            />
          ))}
        </svg>
      )}
    </div>
  );
}
