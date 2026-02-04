import { useRef, useCallback, useState, useEffect } from 'react';

// Face mesh landmark indices
const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380];
const LEFT_IRIS_INDEX = 468;
const RIGHT_IRIS_INDEX = 473;
const NOSE_TIP_INDEX = 1;
const FOREHEAD_INDEX = 10;
const CHIN_INDEX = 152;

// Thresholds
const EYE_CONTACT_THRESHOLD = 0.15; // How centered the iris needs to be
const BLINK_EAR_THRESHOLD = 0.2; // Eye Aspect Ratio threshold for blink detection
const HEAD_MOVEMENT_THRESHOLD = 0.03; // Normalized movement threshold

export interface FaceTrackingMetrics {
  eyeContactScore: number; // 0-100
  headStillnessScore: number; // 0-100
  blinkRate: number; // blinks per minute
  isLookingAtCamera: boolean;
  currentHeadPosition: { x: number; y: number } | null;
}

export interface FaceTrackingResult {
  metrics: FaceTrackingMetrics;
  isTracking: boolean;
  error: string | null;
}

export function useFaceTracking() {
  const faceMeshRef = useRef<any>(null);
  const frameCountRef = useRef(0);
  const eyeContactFramesRef = useRef(0);
  const blinkCountRef = useRef(0);
  const lastBlinkStateRef = useRef(false);
  const headPositionsRef = useRef<{ x: number; y: number }[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);
  
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<FaceTrackingMetrics>({
    eyeContactScore: 0,
    headStillnessScore: 100,
    blinkRate: 0,
    isLookingAtCamera: false,
    currentHeadPosition: null,
  });

  // Calculate Eye Aspect Ratio for blink detection
  const calculateEAR = useCallback((landmarks: any[], eyeIndices: number[]) => {
    if (!landmarks || eyeIndices.length < 6) return 1;
    
    const [p1, p2, p3, p4, p5, p6] = eyeIndices.map(i => landmarks[i]);
    if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 1;
    
    // Vertical distances
    const v1 = Math.sqrt(Math.pow(p2.x - p6.x, 2) + Math.pow(p2.y - p6.y, 2));
    const v2 = Math.sqrt(Math.pow(p3.x - p5.x, 2) + Math.pow(p3.y - p5.y, 2));
    // Horizontal distance
    const h = Math.sqrt(Math.pow(p1.x - p4.x, 2) + Math.pow(p1.y - p4.y, 2));
    
    return (v1 + v2) / (2.0 * h);
  }, []);

  // Check if looking at camera based on iris position
  const checkEyeContact = useCallback((landmarks: any[]) => {
    if (!landmarks || landmarks.length < 474) return false;
    
    const leftIris = landmarks[LEFT_IRIS_INDEX];
    const rightIris = landmarks[RIGHT_IRIS_INDEX];
    const leftEyeCenter = landmarks[LEFT_EYE_INDICES[0]];
    const rightEyeCenter = landmarks[RIGHT_EYE_INDICES[0]];
    
    if (!leftIris || !rightIris || !leftEyeCenter || !rightEyeCenter) return false;
    
    // Check if iris is roughly centered in the eye
    const leftOffset = Math.abs(leftIris.x - leftEyeCenter.x);
    const rightOffset = Math.abs(rightIris.x - rightEyeCenter.x);
    
    return leftOffset < EYE_CONTACT_THRESHOLD && rightOffset < EYE_CONTACT_THRESHOLD;
  }, []);

  // Process face mesh results
  const processResults = useCallback((results: any) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];
    frameCountRef.current++;

    // Eye contact detection
    const isLooking = checkEyeContact(landmarks);
    if (isLooking) {
      eyeContactFramesRef.current++;
    }

    // Blink detection
    const leftEAR = calculateEAR(landmarks, LEFT_EYE_INDICES);
    const rightEAR = calculateEAR(landmarks, RIGHT_EYE_INDICES);
    const avgEAR = (leftEAR + rightEAR) / 2;
    const isBlinking = avgEAR < BLINK_EAR_THRESHOLD;
    
    if (isBlinking && !lastBlinkStateRef.current) {
      blinkCountRef.current++;
    }
    lastBlinkStateRef.current = isBlinking;

    // Head position tracking
    const noseTip = landmarks[NOSE_TIP_INDEX];
    if (noseTip) {
      headPositionsRef.current.push({ x: noseTip.x, y: noseTip.y });
      // Keep last 30 frames (about 1 second at 30fps)
      if (headPositionsRef.current.length > 30) {
        headPositionsRef.current.shift();
      }
    }

    // Calculate metrics
    const eyeContactScore = frameCountRef.current > 0 
      ? Math.round((eyeContactFramesRef.current / frameCountRef.current) * 100)
      : 0;

    // Calculate head stillness from position variance
    let headStillnessScore = 100;
    if (headPositionsRef.current.length > 5) {
      const positions = headPositionsRef.current;
      const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
      const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
      const variance = positions.reduce((sum, p) => {
        return sum + Math.pow(p.x - avgX, 2) + Math.pow(p.y - avgY, 2);
      }, 0) / positions.length;
      
      // Convert variance to stillness score (lower variance = higher stillness)
      headStillnessScore = Math.max(0, Math.min(100, 100 - (variance * 5000)));
    }

    // Calculate blink rate (blinks per minute)
    const elapsedMs = startTimeRef.current ? Date.now() - startTimeRef.current : 1;
    const elapsedMinutes = elapsedMs / 60000;
    const blinkRate = elapsedMinutes > 0 ? Math.round(blinkCountRef.current / elapsedMinutes) : 0;

    setMetrics({
      eyeContactScore,
      headStillnessScore: Math.round(headStillnessScore),
      blinkRate,
      isLookingAtCamera: isLooking,
      currentHeadPosition: noseTip ? { x: noseTip.x, y: noseTip.y } : null,
    });
  }, [checkEyeContact, calculateEAR]);

  // Initialize MediaPipe Face Mesh
  const initialize = useCallback(async () => {
    if (isInitializedRef.current) return;
    
    try {
      const { FaceMesh } = await import('@mediapipe/face_mesh');
      
      const faceMesh = new FaceMesh({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        },
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // Required for iris tracking
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults(processResults);
      
      faceMeshRef.current = faceMesh;
      isInitializedRef.current = true;
      setError(null);
    } catch (err) {
      console.error('Failed to initialize face tracking:', err);
      setError('Failed to initialize face tracking');
    }
  }, [processResults]);

  // Start tracking
  const startTracking = useCallback(async () => {
    await initialize();
    
    // Reset counters
    frameCountRef.current = 0;
    eyeContactFramesRef.current = 0;
    blinkCountRef.current = 0;
    lastBlinkStateRef.current = false;
    headPositionsRef.current = [];
    startTimeRef.current = Date.now();
    
    setIsTracking(true);
    setMetrics({
      eyeContactScore: 0,
      headStillnessScore: 100,
      blinkRate: 0,
      isLookingAtCamera: false,
      currentHeadPosition: null,
    });
  }, [initialize]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    setIsTracking(false);
    return metrics;
  }, [metrics]);

  // Process a video frame
  const processFrame = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!isTracking || !faceMeshRef.current) return;
    
    try {
      await faceMeshRef.current.send({ image: videoElement });
    } catch (err) {
      console.error('Face tracking frame error:', err);
    }
  }, [isTracking]);

  // Get final metrics
  const getFinalMetrics = useCallback(() => {
    return metrics;
  }, [metrics]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (faceMeshRef.current) {
        faceMeshRef.current.close?.();
      }
    };
  }, []);

  return {
    isTracking,
    metrics,
    error,
    startTracking,
    stopTracking,
    processFrame,
    getFinalMetrics,
  };
}
