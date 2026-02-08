import { useRef, useCallback, useState, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import { areVideoMetricsEnabled } from '@/lib/metricUtils';

// Thresholds
const BLINK_EAR_THRESHOLD = 0.21;
const HAND_MOVEMENT_THRESHOLD = 0.03;

// Face mesh keypoint indices (MediaPipe compatible)
const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380];
const LEFT_IRIS_CENTER = 468;
const RIGHT_IRIS_CENTER = 473;
const NOSE_TIP = 1;

export interface FaceTrackingMetrics {
  eyeContactScore: number;
  handMovementScore: number;
  blinkRate: number;
  isLookingAtCamera: boolean;
  currentHeadPosition: { x: number; y: number } | null;
  handsDetected: number;
}

export interface FaceLandmarks {
  keypoints: Array<{ x: number; y: number; z?: number; name?: string }>;
  box?: { xMin: number; yMin: number; xMax: number; yMax: number };
}

export interface HandLandmarks {
  keypoints: Array<{ x: number; y: number; z?: number; name?: string }>;
  handedness: string;
}

export function useFaceTracking() {
  const faceDetectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const handDetectorRef = useRef<handPoseDetection.HandDetector | null>(null);
  const frameCountRef = useRef(0);
  const eyeContactFramesRef = useRef(0);
  const blinkCountRef = useRef(0);
  const lastBlinkStateRef = useRef(false);
  const handPositionsRef = useRef<{ x: number; y: number }[]>([]);
  const handMovementScoresRef = useRef<number[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const isInitializingRef = useRef(false);

  const [isTracking, setIsTracking] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFace, setCurrentFace] = useState<FaceLandmarks | null>(null);
  const [currentHands, setCurrentHands] = useState<HandLandmarks[]>([]);
  const [metrics, setMetrics] = useState<FaceTrackingMetrics>({
    eyeContactScore: 0,
    handMovementScore: 0,
    blinkRate: 0,
    isLookingAtCamera: false,
    currentHeadPosition: null,
    handsDetected: 0,
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

  // Calculate hand movement from positions
  const calculateHandMovement = useCallback((positions: { x: number; y: number }[]) => {
    if (positions.length < 2) return 0;

    let totalMovement = 0;
    for (let i = 1; i < positions.length; i++) {
      const dx = positions[i].x - positions[i - 1].x;
      const dy = positions[i].y - positions[i - 1].y;
      totalMovement += Math.sqrt(dx * dx + dy * dy);
    }

    // Normalize to 0-100 scale (more movement = higher score)
    const avgMovement = totalMovement / (positions.length - 1);
    return Math.min(100, avgMovement * 2000); // Scale factor for sensitivity
  }, []);

  // Initialize TensorFlow.js and detectors
  const initialize = useCallback(async (shouldInitialize: boolean = true) => {
    // Skip initialization if video metrics are disabled
    if (!shouldInitialize) {
      console.log('⏭️ [useFaceTracking] Skipping MediaPipe initialization - video metrics disabled');
      setIsModelLoaded(false);
      setError(null);
      return;
    }

    if ((faceDetectorRef.current && handDetectorRef.current) || isInitializingRef.current) return;

    isInitializingRef.current = true;

    try {
      console.log('🚀 [useFaceTracking] Initializing TensorFlow.js...');
      await tf.ready();
      await tf.setBackend('webgl');
      console.log('✅ [useFaceTracking] TensorFlow.js backend:', tf.getBackend());

      // Load face detection model
      console.log('📦 [useFaceTracking] Loading face landmarks model...');
      const faceModel = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      const faceDetector = await faceLandmarksDetection.createDetector(faceModel, {
        runtime: 'tfjs',
        refineLandmarks: true,
        maxFaces: 1,
      });
      faceDetectorRef.current = faceDetector;

      // Load hand detection model
      console.log('📦 [useFaceTracking] Loading hand pose model...');
      const handModel = handPoseDetection.SupportedModels.MediaPipeHands;
      const handDetector = await handPoseDetection.createDetector(handModel, {
        runtime: 'tfjs',
        modelType: 'lite',
        maxHands: 2,
      });
      handDetectorRef.current = handDetector;

      setIsModelLoaded(true);
      setError(null);
      console.log('✅ [useFaceTracking] Face and hand tracking models loaded successfully!');
    } catch (err) {
      console.error('❌ [useFaceTracking] Failed to initialize tracking:', err);
      setError('Failed to load detection models');
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
    handPositionsRef.current = [];
    handMovementScoresRef.current = [];
    startTimeRef.current = Date.now();

    setIsTracking(true);
    setCurrentFace(null);
    setCurrentHands([]);
    setMetrics({
      eyeContactScore: 0,
      handMovementScore: 0,
      blinkRate: 0,
      isLookingAtCamera: false,
      currentHeadPosition: null,
      handsDetected: 0,
    });
  }, [isModelLoaded, initialize]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    setIsTracking(false);
    return metrics;
  }, [metrics]);

  // Process a video frame
  const processFrame = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!isTracking) return;

    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    try {
      // Process face detection
      if (faceDetectorRef.current) {
        const faces = await faceDetectorRef.current.estimateFaces(videoElement);

        if (faces.length > 0) {
          const face = faces[0];
          const keypoints = face.keypoints;

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

          // Normalize keypoints
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
        } else {
          setCurrentFace(null);
        }
      }

      // Process hand detection
      if (handDetectorRef.current) {
        const hands = await handDetectorRef.current.estimateHands(videoElement);

        if (hands.length > 0) {
          setCurrentHands(hands.map(hand => ({
            keypoints: hand.keypoints as Array<{ x: number; y: number; z?: number; name?: string }>,
            handedness: hand.handedness,
          })));

          // Track wrist position for movement calculation
          const wrist = hands[0].keypoints[0]; // Wrist is keypoint 0
          if (wrist) {
            const normalizedPos = {
              x: wrist.x / videoWidth,
              y: wrist.y / videoHeight,
            };
            handPositionsRef.current.push(normalizedPos);

            // Keep last 30 frames
            if (handPositionsRef.current.length > 30) {
              handPositionsRef.current.shift();
            }

            // Calculate current movement score
            const movementScore = calculateHandMovement(handPositionsRef.current);
            handMovementScoresRef.current.push(movementScore);
          }
        } else {
          setCurrentHands([]);
        }
      }

      // Calculate metrics
      const eyeContactScore = frameCountRef.current > 0
        ? Math.round((eyeContactFramesRef.current / frameCountRef.current) * 100)
        : 0;

      // Average hand movement score
      const handMovementScore = handMovementScoresRef.current.length > 0
        ? Math.round(handMovementScoresRef.current.reduce((a, b) => a + b, 0) / handMovementScoresRef.current.length)
        : 0;

      const elapsedMs = startTimeRef.current ? Date.now() - startTimeRef.current : 1;
      const elapsedMinutes = elapsedMs / 60000;
      const blinkRate = elapsedMinutes > 0.1 ? Math.round(blinkCountRef.current / elapsedMinutes) : 0;

      const noseTip = currentFace?.keypoints[NOSE_TIP];
      const headPos = noseTip ? {
        x: noseTip.x / videoWidth,
        y: noseTip.y / videoHeight
      } : null;

      setMetrics({
        eyeContactScore,
        handMovementScore,
        blinkRate,
        isLookingAtCamera: eyeContactFramesRef.current > frameCountRef.current * 0.5,
        currentHeadPosition: headPos,
        handsDetected: currentHands.length,
      });
    } catch (err) {
      console.error('Frame processing error:', err);
    }
  }, [isTracking, checkEyeContact, calculateEAR, calculateHandMovement, currentFace, currentHands]);

  // Get final metrics
  const getFinalMetrics = useCallback(() => {
    return metrics;
  }, [metrics]);

  // Initialize on mount only if video metrics are enabled
  useEffect(() => {
    const videoMetricsEnabled = areVideoMetricsEnabled();
    initialize(videoMetricsEnabled);

    return () => {
      if (faceDetectorRef.current) {
        faceDetectorRef.current.dispose?.();
      }
      if (handDetectorRef.current) {
        handDetectorRef.current.dispose?.();
      }
    };
  }, [initialize]);

  return {
    isTracking,
    isModelLoaded,
    metrics,
    error,
    currentFace,
    currentHands,
    startTracking,
    stopTracking,
    processFrame,
    getFinalMetrics,
  };
}
