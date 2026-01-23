import { motion } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';

interface ScoreDisplayProps {
  score: number;
  emotionalFeedback: 'excellent' | 'good' | 'poor';
}

const emojis = {
  excellent: '🔥',
  good: '⚡',
  poor: '💤',
};

const feedbackText = {
  excellent: { en: 'High Energy!', vi: 'Năng lượng cao!' },
  good: { en: 'Good Energy', vi: 'Năng lượng ổn' },
  poor: { en: 'Low Energy', vi: 'Năng lượng thấp' },
};

export function ScoreDisplay({ score, emotionalFeedback }: ScoreDisplayProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);

  const triggerConfetti = useCallback(() => {
    const colors = ['#00ffff', '#a855f7', '#22c55e', '#facc15'];

    // Left side burst
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors,
    });

    // Right side burst
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors,
    });

    // Center burst with stars
    setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
        colors,
        shapes: ['star'],
        scalar: 1.2,
      });
    }, 200);
  }, []);

  useEffect(() => {
    // Animate score counting up
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

        // Trigger confetti for excellent scores
        if (emotionalFeedback === 'excellent' && !hasTriggeredConfetti) {
          triggerConfetti();
          setHasTriggeredConfetti(true);
        }
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score, emotionalFeedback, hasTriggeredConfetti, triggerConfetti]);

  const getScoreGradient = () => {
    if (emotionalFeedback === 'excellent') return 'gradient-score-excellent';
    if (emotionalFeedback === 'good') return 'gradient-score-good';
    return 'gradient-score-poor';
  };

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
    >
      {/* Emoji */}
      <motion.div
        className="text-6xl mb-4"
        animate={{
          scale: emotionalFeedback === 'excellent' ? [1, 1.2, 1] : 1,
          rotate: emotionalFeedback === 'excellent' ? [0, -10, 10, 0] : 0,
        }}
        transition={{
          duration: 0.5,
          repeat: emotionalFeedback === 'excellent' ? 2 : 0,
        }}
      >
        {emojis[emotionalFeedback]}
      </motion.div>

      {/* Score Circle */}
      <motion.div
        className={`relative w-40 h-40 rounded-full ${getScoreGradient()} flex items-center justify-center energy-glow`}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
      >
        {/* Inner circle */}
        <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center">
          <span className="text-5xl font-bold text-foreground">{displayScore}</span>
        </div>

        {/* Rotating ring effect */}
        {emotionalFeedback === 'excellent' && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary/50"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </motion.div>

      {/* Feedback Text */}
      <motion.div
        className="mt-4 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-xl font-semibold text-foreground">
          {feedbackText[emotionalFeedback].en}
        </p>
        <p className="text-sm text-muted-foreground">
          {feedbackText[emotionalFeedback].vi}
        </p>
      </motion.div>
    </motion.div>
  );
}
