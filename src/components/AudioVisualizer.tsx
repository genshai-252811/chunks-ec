import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface AudioVisualizerProps {
  isRecording: boolean;
  getAudioLevel: () => number;
}

export function AudioVisualizer({ isRecording, getAudioLevel }: AudioVisualizerProps) {
  const [levels, setLevels] = useState<number[]>(Array(20).fill(0.1));

  useEffect(() => {
    if (!isRecording) {
      setLevels(Array(20).fill(0.1));
      return;
    }

    const interval = setInterval(() => {
      const currentLevel = getAudioLevel();
      setLevels(prev => {
        const newLevels = [...prev.slice(1)];
        // Add some randomness based on audio level for more dynamic visualization
        const variation = (Math.random() - 0.5) * 0.3;
        newLevels.push(Math.max(0.1, Math.min(1, currentLevel + variation)));
        return newLevels;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isRecording, getAudioLevel]);

  if (!isRecording) return null;

  return (
    <motion.div
      className="flex items-center justify-center gap-1 h-16 my-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {levels.map((level, index) => (
        <motion.div
          key={index}
          className="w-1.5 rounded-full gradient-primary"
          animate={{
            height: `${Math.max(8, level * 64)}px`,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
          }}
        />
      ))}
    </motion.div>
  );
}
