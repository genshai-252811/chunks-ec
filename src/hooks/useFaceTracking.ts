import { useRef, useCallback, useState, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

// Thresholds
const BLINK_EAR_THRESHOLD = 0.21;
const HEAD_MOVEMENT_THRESHOLD = 0.03;

// Face mesh keypoint indices (MediaPipe compatible)
const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380];
const LEFT_IRIS_CENTER = 468;
const RIGHT_IRIS_CENTER = 473;
const NOSE_TIP = 1;

export interface FaceTrackingMetrics {
  eyeContactScore: number;
  headStillnessScore: number;
  blinkRate: number;
  isLookingAtCamera: boolean;
  currentHeadPosition: { x: number; y: number } | null;
}

export interface FaceLandmarks {
  keypoints: Array<{ x: number; y: number; z?: number; name?: string }>;
  box?: { xMin: number; yMin: number; xMax: number; yMax: number };
}

export function useFaceTracking() {
  const detectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const frameCountRef = useRef(0);
  const eyeContactFramesRef = useRef(0);
  const blinkCountRef = useRef(0);
  const lastBlinkStateRef = useRef(false);
  const headPositionsRef = useRef<{ x: number; y: number }[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const isInitializingRef = useRef(false);
  
  const [isTracking, setIsTracking] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFace, setCurrentFace] = useState<FaceLandmarks | null>(null);
  const [metrics, setMetrics] = useState<FaceTrackingMetrics>({
    eyeContactScore: 0,
    headStillnessScore: 100,
    blinkRate: 0,
    isLookingAtCamera: false,
    currentHeadPosition: null,
  });

  // Calculate Eye Aspect Ratio for blink detection
  const calculateEAR = useCallback((keypoints: Array<{ x: number; y: number }>, eyeIndices: number[]) => {
    if (!keypoints || eyeIndices.length < 6) return 1;
    
    const points = eyeIndices.map(i => keypoints[i]).filter(Boolean);
    if (points.length < 6) return 1;
    
    const [p1, p2, p3, p4, p5, p6] = points;
    
    // Vertical distances
    const v1 = Math.sqrt(Math.pow(p2.x - p6.x, 2) + Math.pow(p2.y - p6.y, 2));
    const v2 = Math.sqrt(Math.pow(p3.x - p5.x, 2) + Math.pow(p3.y - p5.y, 2));
    // Horizontal distance
    const h = Math.sqrt(Math.pow(p1.x - p4.x, 2) + Math.pow(p1.y - p4.y, 2));
    
    return h > 0 ? (v1 + v2) / (2.0 * h) : 1;
  }, []);

  // Check if looking at camera
  const checkEyeContact = useCallback((keypoints: Array<{ x: number; y: number }>) => {
    if (!keypoints || keypoints.length < 474) return false;
    
    const leftIris = keypoints[LEFT_IRIS_CENTER];
    const rightIris = keypoints[RIGHT_IRIS_CENTER];
    const leftEye = keypoints[LEFT_EYE_INDICES[0]];
    const rightEye = keypoints[RIGHT_EYE_INDICES[0]];
    
    if (!leftIris || !rightIris || !leftEye || !rightEye) return false;
    
    const leftOffset = Math.abs(leftIris.x - leftEye.x);
    const rightOffset = Math.abs(rightIris.x - rightEye.x);
    
    // Allow some margin for natural eye movement
    return leftOffset < 0.02 && rightOffset < 0.02;
  }, []);

  // Initialize TensorFlow.js and face detector
  const initialize = useCallback(async () => {
    if (detectorRef.current || isInitializingRef.current) return;
    
    isInitializingRef.current = true;
    
    try {
      console.log('Initializing TensorFlow.js...');
      await tf.ready();
      await tf.setBackend('webgl');
      console.log('TensorFlow.js backend:', tf.getBackend());
      
      console.log('Loading face landmarks model...');
      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      const detector = await faceLandmarksDetection.createDetector(model, {
        runtime: 'tfjs',
        refineLandmarks: true, // For iris tracking
        maxFaces: 1,
      });
      
      detectorRef.current = detector;
      setIsModelLoaded(true);
      setError(null);
      console.log('Face tracking model loaded successfully!');
    } catch (err) {
      console.error('Failed to initialize face tracking:', err);
      setError('Failed to load face detection model');
      setIsModelLoaded(false);
    } finally {
      isInitializingRef.current = false;
    }
  }, []);

  // Start tracking
  const startTracking = useCallback(async () => {
    if (!isModelLoaded) {
      await initialize();
    }
    
    frameCountRef.current = 0;
    eyeContactFramesRef.current = 0;
    blinkCountRef.current = 0;
    lastBlinkStateRef.current = false;
    headPositionsRef.current = [];
    startTimeRef.current = Date.now();
    
    setIsTracking(true);
    setCurrentFace(null);
    setMetrics({
      eyeContactScore: 0,
      headStillnessScore: 100,
      blinkRate: 0,
      isLookingAtCamera: false,
      currentHeadPosition: null,
    });
  }, [isModelLoaded, initialize]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    setIsTracking(false);
    return metrics;
  }, [metrics]);

  // Process a video frame
  const processFrame = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!isTracking || !detectorRef.current) return;
    
    try {
      const faces = await detectorRef.current.estimateFaces(videoElement);
      
      if (faces.length === 0) {
        setCurrentFace(null);
        return;
      }

      const face = faces[0];
      const keypoints = face.keypoints;
      
      // Store face data for visualization
      setCurrentFace({
        keypoints: keypoints as Array<{ x: number; y: number; z?: number; name?: string }>,
        box: face.box ? {
          xMin: face.box.xMin,
          yMin: face.box.yMin,
          xMax: face.box.xMax,
          yMax: face.box.yMax,
        } : undefined,
      });
      
      frameCountRef.current++;

      // Normalize keypoints to 0-1 range for calculations
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      const normalizedKeypoints = keypoints.map(kp => ({
        x: kp.x / videoWidth,
        y: kp.y / videoHeight,
      }));

      // Eye contact detection
      const isLooking = checkEyeContact(normalizedKeypoints);
      if (isLooking) {
        eyeContactFramesRef.current++;
      }

      // Blink detection
      const leftEAR = calculateEAR(normalizedKeypoints, LEFT_EYE_INDICES);
      const rightEAR = calculateEAR(normalizedKeypoints, RIGHT_EYE_INDICES);
      const avgEAR = (leftEAR + rightEAR) / 2;
      const isBlinking = avgEAR < BLINK_EAR_THRESHOLD;
      
      if (isBlinking && !lastBlinkStateRef.current) {
        blinkCountRef.current++;
      }
      lastBlinkStateRef.current = isBlinking;

      // Head position tracking
      const noseTip = normalizedKeypoints[NOSE_TIP];
      if (noseTip) {
        headPositionsRef.current.push({ x: noseTip.x, y: noseTip.y });
        if (headPositionsRef.current.length > 30) {
          headPositionsRef.current.shift();
        }
      }

      // Calculate metrics
      const eyeContactScore = frameCountRef.current > 0 
        ? Math.round((eyeContactFramesRef.current / frameCountRef.current) * 100)
        : 0;

      let headStillnessScore = 100;
      if (headPositionsRef.current.length > 5) {
        const positions = headPositionsRef.current;
        const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
        const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
        const variance = positions.reduce((sum, p) => {
          return sum + Math.pow(p.x - avgX, 2) + Math.pow(p.y - avgY, 2);
        }, 0) / positions.length;
        
        headStillnessScore = Math.max(0, Math.min(100, 100 - (variance * 5000)));
      }

      const elapsedMs = startTimeRef.current ? Date.now() - startTimeRef.current : 1;
      const elapsedMinutes = elapsedMs / 60000;
      const blinkRate = elapsedMinutes > 0.1 ? Math.round(blinkCountRef.current / elapsedMinutes) : 0;

      setMetrics({
        eyeContactScore,
        headStillnessScore: Math.round(headStillnessScore),
        blinkRate,
        isLookingAtCamera: isLooking,
        currentHeadPosition: noseTip ? { x: noseTip.x, y: noseTip.y } : null,
      });
    } catch (err) {
      console.error('Face tracking frame error:', err);
    }
  }, [isTracking, checkEyeContact, calculateEAR]);

  // Get final metrics
  const getFinalMetrics = useCallback(() => {
    return metrics;
  }, [metrics]);

  // Initialize on mount
  useEffect(() => {
    initialize();
    
    return () => {
      if (detectorRef.current) {
        detectorRef.current.dispose?.();
      }
    };
  }, [initialize]);

  return {
    isTracking,
    isModelLoaded,
    metrics,
    error,
    currentFace,
    startTracking,
    stopTracking,
    processFrame,
    getFinalMetrics,
  };
}
