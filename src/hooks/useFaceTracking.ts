import { useRef, useCallback, useState, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import { areVideoMetricsEnabled, getEnabledVideoMetrics } from '@/lib/metricUtils';

// Thresholds
const BLINK_EAR_THRESHOLD = 0.21;

// Face mesh keypoint indices (MediaPipe compatible)
const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380];
const LEFT_IRIS_CENTER = 468;
const RIGHT_IRIS_CENTER = 473;
const LEFT_EYE_INNER = 133;  // Inner corner of left eye
const LEFT_EYE_TOP = 159;    // Top of left eye
const LEFT_EYE_BOTTOM = 145; // Bottom of left eye
const RIGHT_EYE_INNER = 263; // Inner corner of right eye
const RIGHT_EYE_TOP = 386;   // Top of right eye
const RIGHT_EYE_BOTTOM = 374; // Bottom of right eye
const NOSE_TIP = 1;

// Metrics update throttle (ms) - only push React state this often
const METRICS_UPDATE_INTERVAL = 500;

// Eye contact smoothing window
const EYE_CONTACT_HISTORY_SIZE = 10;
const EYE_CONTACT_THRESHOLD_RATIO = 0.7; // 70% of recent frames must say "looking"

// Blink debounce
const MIN_BLINK_DURATION_MS = 50;
const MAX_BLINK_DURATION_MS = 500;
const MIN_BLINK_INTERVAL_MS = 100;

// Hand movement smoothing
const HAND_SMOOTHING_ALPHA = 0.3;

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
  const isInitializingRef = useRef(false);

  // Frame-level refs (no React re-renders)
  const currentFaceRef = useRef<FaceLandmarks | null>(null);
  const currentHandsRef = useRef<HandLandmarks[]>([]);
  const metricsRef = useRef<FaceTrackingMetrics>({
    eyeContactScore: 0,
    handMovementScore: 0,
    blinkRate: 0,
    isLookingAtCamera: false,
    currentHeadPosition: null,
    handsDetected: 0,
  });

  // Inference frame counter for alternating face/hand processing
  const frameNumberRef = useRef(0);

  // Metric calculation refs
  const frameCountRef = useRef(0);
  const eyeContactFramesRef = useRef(0);
  const blinkCountRef = useRef(0);
  const lastBlinkStateRef = useRef(false);
  const blinkStartTimeRef = useRef(0);
  const lastBlinkTimeRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const lastMetricsUpdateRef = useRef(0);

  // Eye contact smoothing history
  const eyeContactHistoryRef = useRef<boolean[]>([]);

  // Hand movement tracking (per hand)
  const hand1PositionsRef = useRef<{ x: number; y: number }[]>([]);
  const hand2PositionsRef = useRef<{ x: number; y: number }[]>([]);
  const smoothedHandMovementRef = useRef(0);

  // Video dimensions for normalization
  const videoDimsRef = useRef({ width: 1280, height: 720 });

  // React state (updated infrequently for UI)
  const [isTracking, setIsTracking] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<FaceTrackingMetrics>({
    eyeContactScore: 0,
    handMovementScore: 0,
    blinkRate: 0,
    isLookingAtCamera: false,
    currentHeadPosition: null,
    handsDetected: 0,
  });

  // Getter for Canvas overlay (reads ref, no state trigger)
  const getCurrentFace = useCallback(() => currentFaceRef.current, []);
  const getCurrentHands = useCallback(() => currentHandsRef.current, []);

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

  // Enhanced eye contact detection with 2D offset and normalization
  const checkEyeContact = useCallback((keypoints: Array<{ x: number; y: number }>) => {
    if (!keypoints || keypoints.length < 474) return false;

    const leftIris = keypoints[LEFT_IRIS_CENTER];
    const rightIris = keypoints[RIGHT_IRIS_CENTER];
    const leftEyeOuter = keypoints[LEFT_EYE_INDICES[0]]; // index 33
    const leftEyeInner = keypoints[LEFT_EYE_INNER];       // index 133
    const leftEyeTop = keypoints[LEFT_EYE_TOP];           // index 159
    const leftEyeBottom = keypoints[LEFT_EYE_BOTTOM];     // index 145
    const rightEyeOuter = keypoints[RIGHT_EYE_INDICES[0]]; // index 362
    const rightEyeInner = keypoints[RIGHT_EYE_INNER];      // index 263
    const rightEyeTop = keypoints[RIGHT_EYE_TOP];          // index 386
    const rightEyeBottom = keypoints[RIGHT_EYE_BOTTOM];    // index 374

    if (!leftIris || !rightIris || !leftEyeOuter || !leftEyeInner ||
        !leftEyeTop || !leftEyeBottom || !rightEyeOuter || !rightEyeInner ||
        !rightEyeTop || !rightEyeBottom) return false;

    // Calculate eye centers
    const leftEyeCenterX = (leftEyeOuter.x + leftEyeInner.x) / 2;
    const leftEyeCenterY = (leftEyeTop.y + leftEyeBottom.y) / 2;
    const rightEyeCenterX = (rightEyeOuter.x + rightEyeInner.x) / 2;
    const rightEyeCenterY = (rightEyeTop.y + rightEyeBottom.y) / 2;

    // Calculate eye dimensions for normalization
    const leftEyeWidth = Math.abs(leftEyeInner.x - leftEyeOuter.x);
    const leftEyeHeight = Math.abs(leftEyeTop.y - leftEyeBottom.y);
    const rightEyeWidth = Math.abs(rightEyeInner.x - rightEyeOuter.x);
    const rightEyeHeight = Math.abs(rightEyeTop.y - rightEyeBottom.y);

    if (leftEyeWidth === 0 || leftEyeHeight === 0 || rightEyeWidth === 0 || rightEyeHeight === 0) return false;

    // Normalize iris offset by eye dimensions (2D Euclidean distance)
    const leftHorizOffset = (leftIris.x - leftEyeCenterX) / leftEyeWidth;
    const leftVertOffset = (leftIris.y - leftEyeCenterY) / leftEyeHeight;
    const leftOffset = Math.sqrt(leftHorizOffset * leftHorizOffset + leftVertOffset * leftVertOffset);

    const rightHorizOffset = (rightIris.x - rightEyeCenterX) / rightEyeWidth;
    const rightVertOffset = (rightIris.y - rightEyeCenterY) / rightEyeHeight;
    const rightOffset = Math.sqrt(rightHorizOffset * rightHorizOffset + rightVertOffset * rightVertOffset);

    // Threshold 0.15 allows natural eye movement range
    return leftOffset < 0.15 && rightOffset < 0.15;
  }, []);

  // Temporal smoothing for eye contact (running average over N frames)
  const smoothEyeContact = useCallback((currentlyLooking: boolean): boolean => {
    eyeContactHistoryRef.current.push(currentlyLooking);
    if (eyeContactHistoryRef.current.length > EYE_CONTACT_HISTORY_SIZE) {
      eyeContactHistoryRef.current.shift();
    }

    const lookingCount = eyeContactHistoryRef.current.filter(x => x).length;
    return lookingCount >= eyeContactHistoryRef.current.length * EYE_CONTACT_THRESHOLD_RATIO;
  }, []);

  // Check if eye landmarks are visible (not at frame edge)
  const areEyeLandmarksVisible = useCallback((keypoints: Array<{ x: number; y: number }>, eyeIndices: number[]) => {
    return eyeIndices.every(idx => {
      const kp = keypoints[idx];
      return kp && kp.x > 0.05 && kp.x < 0.95 && kp.y > 0.05 && kp.y < 0.95;
    });
  }, []);

  // Enhanced hand movement with per-hand tracking and smoothing
  const calculateHandMovement = useCallback((
    positions1: { x: number; y: number }[],
    positions2: { x: number; y: number }[],
  ): number => {
    const calcMovement = (positions: { x: number; y: number }[]) => {
      if (positions.length < 2) return 0;
      const { width, height } = videoDimsRef.current;
      const diagonal = Math.sqrt(width * width + height * height);
      if (diagonal === 0) return 0;

      let total = 0;
      for (let i = 1; i < positions.length; i++) {
        const dx = (positions[i].x - positions[i - 1].x) * width;
        const dy = (positions[i].y - positions[i - 1].y) * height;
        total += Math.sqrt(dx * dx + dy * dy) / diagonal;
      }
      return total / (positions.length - 1);
    };

    const m1 = calcMovement(positions1);
    const m2 = calcMovement(positions2);
    // Take the max of both hands (if only 1 hand, the other is 0)
    const rawScore = Math.max(m1, m2);

    // Normalize to 0-100 (empirical: 0.01 = gentle gestures, 0.05 = active)
    return Math.min(100, rawScore * 2000);
  }, []);

  // Initialize TensorFlow.js and detectors — conditionally based on enabled metrics
  const initialize = useCallback(async (shouldInitialize: boolean = true) => {
    if (!shouldInitialize) {
      console.log('⏭️ [useFaceTracking] Skipping MediaPipe initialization - video metrics disabled');
      setIsModelLoaded(false);
      setError(null);
      return;
    }

    if (isInitializingRef.current) return;
    // Already fully loaded
    if (faceDetectorRef.current || handDetectorRef.current) return;

    isInitializingRef.current = true;

    try {
      const enabledMetrics = getEnabledVideoMetrics();
      const needsFace = enabledMetrics.includes('eyeContact') || enabledMetrics.includes('blinkRate');
      const needsHands = enabledMetrics.includes('handMovement');

      if (!needsFace && !needsHands) {
        console.log('⏭️ [useFaceTracking] No video metrics need ML models');
        setIsModelLoaded(false);
        return;
      }

      console.log('🚀 [useFaceTracking] Initializing TensorFlow.js...');
      console.log('📊 [useFaceTracking] Enabled video metrics:', enabledMetrics);
      console.log('🔍 [useFaceTracking] Need face model:', needsFace, '| Need hand model:', needsHands);
      await tf.ready();
      await tf.setBackend('webgl');
      console.log('✅ [useFaceTracking] TensorFlow.js backend:', tf.getBackend());

      // Conditionally load face model
      if (needsFace) {
        console.log('📦 [useFaceTracking] Loading face landmarks model...');
        const faceModel = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
        const faceDetector = await faceLandmarksDetection.createDetector(faceModel, {
          runtime: 'tfjs',
          refineLandmarks: true,
          maxFaces: 1,
        });
        faceDetectorRef.current = faceDetector;
      }

      // Conditionally load hand model
      if (needsHands) {
        console.log('📦 [useFaceTracking] Loading hand pose model...');
        const handModel = handPoseDetection.SupportedModels.MediaPipeHands;
        const handDetector = await handPoseDetection.createDetector(handModel, {
          runtime: 'tfjs',
          modelType: 'lite',
          maxHands: 2,
        });
        handDetectorRef.current = handDetector;
      }

      setIsModelLoaded(true);
      setError(null);
      console.log('✅ [useFaceTracking] Tracking models loaded successfully!');
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

    console.log('🎬 [useFaceTracking] Starting tracking...',
      'faceDetector:', !!faceDetectorRef.current,
      'handDetector:', !!handDetectorRef.current);

    // Reset all counters
    frameNumberRef.current = 0;
    frameCountRef.current = 0;
    eyeContactFramesRef.current = 0;
    blinkCountRef.current = 0;
    lastBlinkStateRef.current = false;
    blinkStartTimeRef.current = 0;
    lastBlinkTimeRef.current = 0;
    eyeContactHistoryRef.current = [];
    hand1PositionsRef.current = [];
    hand2PositionsRef.current = [];
    smoothedHandMovementRef.current = 0;
    startTimeRef.current = Date.now();
    lastMetricsUpdateRef.current = 0;

    currentFaceRef.current = null;
    currentHandsRef.current = [];
    metricsRef.current = {
      eyeContactScore: 0,
      handMovementScore: 0,
      blinkRate: 0,
      isLookingAtCamera: false,
      currentHeadPosition: null,
      handsDetected: 0,
    };

    setIsTracking(true);
    setMetrics({ ...metricsRef.current });
  }, [isModelLoaded, initialize]);

  // Stop tracking — flush final metrics to state immediately
  const stopTracking = useCallback(() => {
    console.log('🛑 [useFaceTracking] Stopping tracking. Final metrics:', { ...metricsRef.current },
      'Frames processed:', frameCountRef.current,
      'Eye contact frames:', eyeContactFramesRef.current,
      'Blinks:', blinkCountRef.current);

    // Flush final metrics to React state before stopping
    setMetrics({ ...metricsRef.current });
    setIsTracking(false);
    return metricsRef.current;
  }, []);

  // Process a video frame — uses frame counter for alternating face/hand inference
  const processFrame = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!isTracking) return;

    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    videoDimsRef.current = { width: videoWidth, height: videoHeight };

    frameNumberRef.current++;

    // Alternating inference: face ~5fps, hand ~3fps at 60fps loop
    // frame % 12 === 0 → every 12th frame at 60fps = ~5fps
    // frame % 20 === 6 → every 20th frame at 60fps = ~3fps, offset to avoid collision
    const shouldProcessFace = (frameNumberRef.current % 12 === 0) && faceDetectorRef.current !== null;
    const shouldProcessHands = (frameNumberRef.current % 20 === 6) && handDetectorRef.current !== null;

    // Periodic diagnostic logging (every 60 frames = ~1 sec)
    if (frameNumberRef.current % 60 === 0) {
      console.log(`📊 [useFaceTracking] Frame #${frameNumberRef.current}`,
        `face=${!!faceDetectorRef.current}`,
        `hand=${!!handDetectorRef.current}`,
        `faceFrames=${frameCountRef.current}`,
        `eyeContact=${metricsRef.current.eyeContactScore}%`,
        `movement=${metricsRef.current.handMovementScore}`,
        `blinks=${blinkCountRef.current}`);
    }

    try {
      // --- FACE DETECTION (5fps) ---
      if (shouldProcessFace && faceDetectorRef.current) {
        const faces = await faceDetectorRef.current.estimateFaces(videoElement);

        if (faces.length > 0) {
          const face = faces[0];
          const keypoints = face.keypoints;

          // Update ref (no React re-render)
          currentFaceRef.current = {
            keypoints: keypoints as Array<{ x: number; y: number; z?: number; name?: string }>,
            box: face.box ? {
              xMin: face.box.xMin,
              yMin: face.box.yMin,
              xMax: face.box.xMax,
              yMax: face.box.yMax,
            } : undefined,
          };

          frameCountRef.current++;

          // Normalize keypoints for metric calculations
          const normalizedKeypoints = keypoints.map(kp => ({
            x: kp.x / videoWidth,
            y: kp.y / videoHeight,
          }));

          // --- Eye contact detection (with smoothing) ---
          const rawLooking = checkEyeContact(normalizedKeypoints);
          const isLookingSmoothed = smoothEyeContact(rawLooking);
          if (isLookingSmoothed) {
            eyeContactFramesRef.current++;
          }

          // --- Blink detection (with debounce & quality check) ---
          const eyesVisible = areEyeLandmarksVisible(normalizedKeypoints, LEFT_EYE_INDICES) &&
                              areEyeLandmarksVisible(normalizedKeypoints, RIGHT_EYE_INDICES);

          if (eyesVisible) {
            const leftEAR = calculateEAR(normalizedKeypoints, LEFT_EYE_INDICES);
            const rightEAR = calculateEAR(normalizedKeypoints, RIGHT_EYE_INDICES);
            const avgEAR = (leftEAR + rightEAR) / 2;
            const isBlinking = avgEAR < BLINK_EAR_THRESHOLD;

            const now = Date.now();

            if (isBlinking && !lastBlinkStateRef.current) {
              // Blink started
              blinkStartTimeRef.current = now;
            } else if (!isBlinking && lastBlinkStateRef.current) {
              // Blink ended — check duration and interval
              const blinkDuration = now - blinkStartTimeRef.current;
              const timeSinceLastBlink = now - lastBlinkTimeRef.current;

              if (blinkDuration >= MIN_BLINK_DURATION_MS &&
                  blinkDuration <= MAX_BLINK_DURATION_MS &&
                  timeSinceLastBlink >= MIN_BLINK_INTERVAL_MS) {
                blinkCountRef.current++;
                lastBlinkTimeRef.current = now;
              }
            }
            lastBlinkStateRef.current = isBlinking;
          }

          // Head position from nose tip
          const noseTip = keypoints[NOSE_TIP];
          if (noseTip) {
            metricsRef.current.currentHeadPosition = {
              x: noseTip.x / videoWidth,
              y: noseTip.y / videoHeight,
            };
          }
        } else {
          currentFaceRef.current = null;
        }
      }

      // --- HAND DETECTION (3fps) ---
      if (shouldProcessHands && handDetectorRef.current) {
        const hands = await handDetectorRef.current.estimateHands(videoElement);

        if (hands.length > 0) {
          currentHandsRef.current = hands.map(hand => ({
            keypoints: hand.keypoints as Array<{ x: number; y: number; z?: number; name?: string }>,
            handedness: hand.handedness,
          }));

          // Track wrist positions for each hand
          for (let i = 0; i < Math.min(hands.length, 2); i++) {
            const wrist = hands[i].keypoints[0];
            if (!wrist) continue;

            const normalizedPos = {
              x: wrist.x / videoWidth,
              y: wrist.y / videoHeight,
            };

            const positionsRef = i === 0 ? hand1PositionsRef : hand2PositionsRef;
            positionsRef.current.push(normalizedPos);

            // Keep last 30 frames
            if (positionsRef.current.length > 30) {
              positionsRef.current.shift();
            }
          }

          // Calculate and smooth hand movement
          const rawMovement = calculateHandMovement(
            hand1PositionsRef.current,
            hand2PositionsRef.current,
          );
          smoothedHandMovementRef.current =
            smoothedHandMovementRef.current * (1 - HAND_SMOOTHING_ALPHA) +
            rawMovement * HAND_SMOOTHING_ALPHA;
        } else {
          currentHandsRef.current = [];
        }
      }

      // --- UPDATE METRICS REF (every frame, cheap) ---
      const eyeContactScore = frameCountRef.current > 0
        ? Math.round((eyeContactFramesRef.current / frameCountRef.current) * 100)
        : 0;

      const handMovementScore = Math.round(smoothedHandMovementRef.current);

      const elapsedMs = startTimeRef.current ? Date.now() - startTimeRef.current : 1;
      const elapsedMinutes = elapsedMs / 60000;
      const blinkRate = elapsedMinutes > 0.1 ? Math.round(blinkCountRef.current / elapsedMinutes) : 0;

      metricsRef.current = {
        ...metricsRef.current,
        eyeContactScore,
        handMovementScore,
        blinkRate,
        isLookingAtCamera: eyeContactHistoryRef.current.length > 0
          ? eyeContactHistoryRef.current[eyeContactHistoryRef.current.length - 1]
          : false,
        handsDetected: currentHandsRef.current.length,
      };

      // --- THROTTLED REACT STATE UPDATE (every 500ms) ---
      const now = Date.now();
      if (now - lastMetricsUpdateRef.current >= METRICS_UPDATE_INTERVAL) {
        setMetrics({ ...metricsRef.current });
        lastMetricsUpdateRef.current = now;
      }

    } catch (err) {
      console.error('Frame processing error:', err);
    }
  }, [isTracking, checkEyeContact, smoothEyeContact, areEyeLandmarksVisible, calculateEAR, calculateHandMovement]);

  // Get final metrics
  const getFinalMetrics = useCallback(() => {
    return metricsRef.current;
  }, []);

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
    currentFace: currentFaceRef.current,
    currentHands: currentHandsRef.current,
    getCurrentFace,
    getCurrentHands,
    startTracking,
    stopTracking,
    processFrame,
    getFinalMetrics,
  };
}
