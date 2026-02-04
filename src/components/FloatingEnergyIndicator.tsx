import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';
import { getDisplayThresholds } from '@/hooks/useDisplaySettings';

interface FloatingEnergyIndicatorProps {
  audioLevel: number;
  isActive: boolean;
}

export function FloatingEnergyIndicator({ audioLevel, isActive }: FloatingEnergyIndicatorProps) {
  const thresholds = getDisplayThresholds();
  
  // Normalize audio level (0-1)
  const level = Math.min(Math.max(audioLevel, 0), 1);
  
  // Determine energy state using configurable thresholds
  const getEnergyState = () => {
    // Create 5 zones based on the 3 thresholds
    const quietMid = thresholds.quiet * 0.66;
    const goodMid = thresholds.quiet + (thresholds.good - thresholds.quiet) * 0.5;
    
    if (level < quietMid) return { emoji: '😴', label: 'Quiet', color: 'text-blue-400', glowColor: 'rgba(96, 165, 250, 0.6)' };
    if (level < thresholds.quiet) return { emoji: '🙂', label: 'Warming up', color: 'text-cyan-400', glowColor: 'rgba(34, 211, 238, 0.6)' };
    if (level < goodMid) return { emoji: '😊', label: 'Good!', color: 'text-emerald-400', glowColor: 'rgba(52, 211, 153, 0.7)' };
    if (level < thresholds.good) return { emoji: '🔥', label: 'Great!', color: 'text-yellow-400', glowColor: 'rgba(250, 204, 21, 0.8)' };
    return { emoji: '⚡', label: 'POWERFUL!', color: 'text-amber-300', glowColor: 'rgba(252, 211, 77, 0.9)' };
  };

  const state = getEnergyState();
  const boltCount = Math.floor(level * 5) + 1;
  const pulseIntensity = 0.8 + level * 0.4;

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-20"
          initial={{ opacity: 0, y: 20, scale: 0.5 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.5 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          {/* Electric bolts container */}
          <div className="relative flex items-center justify-center">
            {/* Glow effect behind */}
            <motion.div
              className="absolute w-20 h-20 rounded-full blur-xl"
              style={{ backgroundColor: state.glowColor }}
              animate={{
                scale: [1, pulseIntensity, 1],
                opacity: [0.4, 0.7 * level + 0.3, 0.4],
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            
            {/* Main emoji */}
            <motion.span
              className="text-5xl relative z-10 drop-shadow-lg"
              animate={{
                scale: [1, 1.1 + level * 0.2, 1],
                rotate: level > 0.6 ? [-5, 5, -5] : 0,
              }}
              transition={{
                duration: level > 0.6 ? 0.3 : 0.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {state.emoji}
            </motion.span>

            {/* Floating lightning bolts around */}
            {Array.from({ length: boltCount }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  rotate: `${(360 / boltCount) * i}deg`,
                }}
              >
                <motion.div
                  className="relative"
                  style={{ transform: `translateY(-${32 + level * 10}px)` }}
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    scale: [0.8, 1.2, 0.8],
                  }}
                  transition={{
                    duration: 0.4 + Math.random() * 0.3,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                >
                  <Zap
                    className={`w-4 h-4 ${state.color} drop-shadow-lg`}
                    fill="currentColor"
                    style={{
                      filter: `drop-shadow(0 0 ${4 + level * 6}px ${state.glowColor})`,
                    }}
                  />
                </motion.div>
              </motion.div>
            ))}
          </div>

          {/* Energy label */}
          <motion.div
            className={`text-sm font-bold ${state.color} bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm`}
            style={{
              textShadow: `0 0 10px ${state.glowColor}`,
            }}
            animate={{
              scale: level > 0.6 ? [1, 1.05, 1] : 1,
            }}
            transition={{
              duration: 0.3,
              repeat: level > 0.6 ? Infinity : 0,
            }}
          >
            {state.label}
          </motion.div>

          {/* Electric sparks effect for high energy */}
          {level > 0.5 && (
            <>
              {Array.from({ length: Math.floor(level * 6) }).map((_, i) => (
                <motion.div
                  key={`spark-${i}`}
                  className="absolute w-1 h-1 rounded-full bg-yellow-300"
                  style={{
                    left: `${50 + (Math.random() - 0.5) * 80}%`,
                    top: `${Math.random() * 60}%`,
                    boxShadow: `0 0 6px 2px ${state.glowColor}`,
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0],
                    y: [0, -20 - Math.random() * 20],
                  }}
                  transition={{
                    duration: 0.5 + Math.random() * 0.3,
                    repeat: Infinity,
                    delay: Math.random() * 0.5,
                  }}
                />
              ))}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
