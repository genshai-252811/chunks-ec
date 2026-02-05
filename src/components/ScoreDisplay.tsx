import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, TrendingUp, Zap } from 'lucide-react';
import { useCelebrationSound } from '@/hooks/useCelebrationSound';

interface ScoreDisplayProps {
  score: number;
  emotionalFeedback: 'excellent' | 'good' | 'poor';
}

const feedbackConfig = {
  excellent: { 
    emoji: '🔥',
    en: 'High Energy!', 
    vi: 'Năng lượng cao!',
    gradient: 'from-emerald-400 via-cyan-400 to-blue-500',
    ringColor: 'ring-emerald-400/50',
    glowColor: 'shadow-emerald-400/50',
    icon: Sparkles,
  },
  good: { 
    emoji: '⚡',
    en: 'Good Energy', 
    vi: 'Năng lượng ổn',
    gradient: 'from-cyan-400 via-blue-400 to-purple-500',
    ringColor: 'ring-cyan-400/50',
    glowColor: 'shadow-cyan-400/50',
    icon: TrendingUp,
  },
  poor: { 
    emoji: '💤',
    en: 'Low Energy', 
    vi: 'Năng lượng thấp',
    gradient: 'from-slate-400 via-zinc-400 to-gray-500',
    ringColor: 'ring-slate-400/50',
    glowColor: 'shadow-slate-400/30',
    icon: Zap,
  },
};

export function ScoreDisplay({ score, emotionalFeedback }: ScoreDisplayProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);
  const { playSuccessSound } = useCelebrationSound();
  const config = feedbackConfig[emotionalFeedback];
  const Icon = config.icon;

  const triggerCelebration = () => {
    const colors = ['#22d3ee', '#a855f7', '#22c55e', '#facc15', '#3b82f6'];

    // Play sound effect
    playSuccessSound();

    // Left side burst
    confetti({
      particleCount: 100,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.6 },
      colors,
    });

    // Right side burst
    confetti({
      particleCount: 100,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.6 },
      colors,
    });

    // Center burst with stars
    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 120,
        origin: { x: 0.5, y: 0.4 },
        colors,
        shapes: ['star'],
        scalar: 1.3,
      });
    }, 200);
  };

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(score, Math.round(increment * step));
      setDisplayScore(current);

      if (step >= steps) {
        clearInterval(timer);
        setDisplayScore(score);

        if (emotionalFeedback === 'excellent' && !hasTriggeredConfetti) {
          triggerCelebration();
          setHasTriggeredConfetti(true);
        }
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score, emotionalFeedback, hasTriggeredConfetti, playSuccessSound]);

  // Calculate ring progress (0-100 mapped to stroke-dashoffset)
  const circumference = 2 * Math.PI * 70; // radius = 70
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  return (
    <motion.div
      className="flex flex-col items-center pt-6 pb-4"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
    >
      {/* Large Score Circle with animated ring */}
      <motion.div
        className="relative"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 180 }}
      >
        {/* Background glow */}
        <div className={`absolute inset-0 blur-3xl opacity-30 bg-gradient-to-br ${config.gradient} rounded-full scale-150`} />
        
        {/* SVG Ring */}
        <svg className="w-44 h-44 -rotate-90" viewBox="0 0 160 160">
          {/* Background track */}
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-secondary/50"
          />
          {/* Progress ring */}
          <motion.circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={`stroke-current`}
            style={{
              stroke: `url(#scoreGradient)`,
              strokeDasharray: circumference,
            }}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              {emotionalFeedback === 'excellent' ? (
                <>
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="50%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </>
              ) : emotionalFeedback === 'good' ? (
                <>
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="50%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#a855f7" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#94a3b8" />
                  <stop offset="100%" stopColor="#64748b" />
                </>
              )}
            </linearGradient>
          </defs>
        </svg>

        {/* Inner content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Emoji */}
          <motion.div
            className="text-4xl mb-1"
            animate={{
              scale: emotionalFeedback === 'excellent' ? [1, 1.15, 1] : 1,
              rotate: emotionalFeedback === 'excellent' ? [0, -8, 8, 0] : 0,
            }}
            transition={{
              duration: 0.6,
              repeat: emotionalFeedback === 'excellent' ? 3 : 0,
            }}
          >
            {config.emoji}
          </motion.div>
          
          {/* Score number */}
          <motion.span 
            className={`text-5xl font-bold bg-gradient-to-br ${config.gradient} bg-clip-text text-transparent`}
            key={displayScore}
          >
            {displayScore}
          </motion.span>
        </div>

      </motion.div>

      {/* Feedback Badge */}
      <motion.div
        className="mt-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r ${config.gradient} shadow-lg ${config.glowColor}`}>
          <Icon className="w-5 h-5 text-white" />
          <span className="text-white font-semibold text-lg">
            {config.en}
          </span>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-2">
          {config.vi}
        </p>
      </motion.div>
    </motion.div>
  );
}
