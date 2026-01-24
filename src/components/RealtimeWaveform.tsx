import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getDisplayThresholds } from '@/hooks/useDisplaySettings';

interface RealtimeWaveformProps {
  isRecording: boolean;
  getAudioLevel: () => number;
}

export function RealtimeWaveform({ isRecording, getAudioLevel }: RealtimeWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const audioHistoryRef = useRef<number[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0);
  const maxHistoryLength = 80;
  const thresholds = getDisplayThresholds();

  useEffect(() => {
    if (!isRecording || !canvasRef.current) {
      audioHistoryRef.current = [];
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    const draw = () => {
      if (!isRecording) return;

      const level = getAudioLevel();
      setCurrentLevel(level);

      audioHistoryRef.current.push(level);
      if (audioHistoryRef.current.length > maxHistoryLength) {
        audioHistoryRef.current.shift();
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.getBoundingClientRect().width;
      const height = canvas.getBoundingClientRect().height;
      const centerY = height / 2;
      const history = audioHistoryRef.current;

      if (history.length < 2) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Draw bars with gradient and glow effects
      const barWidth = width / maxHistoryLength;
      const gap = 2;

      for (let i = 0; i < history.length; i++) {
        const x = i * barWidth;
        const level = history[i];
        const barHeight = Math.max(4, level * height * 0.85);
        const barY = centerY - barHeight / 2;
        
        // Create vertical gradient for each bar using configurable thresholds
        const gradient = ctx.createLinearGradient(x, barY + barHeight, x, barY);
        
        if (level < thresholds.quiet) {
          // Quiet - Cool cyan/blue gradient
          gradient.addColorStop(0, `rgba(30, 80, 120, ${0.3 + level})`);
          gradient.addColorStop(0.5, `rgba(80, 180, 220, ${0.5 + level})`);
          gradient.addColorStop(1, `rgba(120, 220, 255, ${0.7 + level})`);
        } else if (level < thresholds.good) {
          // Good - Cyan to green gradient
          gradient.addColorStop(0, `rgba(0, 150, 136, ${0.5 + level * 0.3})`);
          gradient.addColorStop(0.5, `rgba(0, 230, 180, ${0.7 + level * 0.3})`);
          gradient.addColorStop(1, `rgba(100, 255, 200, ${0.9})`);
        } else {
          // Powerful - Bright cyan/white gradient
          gradient.addColorStop(0, `rgba(0, 180, 200, ${0.7})`);
          gradient.addColorStop(0.5, `rgba(0, 255, 255, ${0.9})`);
          gradient.addColorStop(1, `rgba(200, 255, 255, 1)`);
        }

        // Draw glow effect (blur shadow)
        ctx.shadowColor = level < thresholds.quiet 
          ? 'rgba(100, 200, 255, 0.5)' 
          : level < thresholds.good 
            ? 'rgba(0, 255, 180, 0.6)' 
            : 'rgba(0, 255, 255, 0.8)';
        ctx.shadowBlur = level * 15 + 5;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Draw the bar with rounded corners
        ctx.fillStyle = gradient;
        ctx.beginPath();
        const radius = Math.min(barWidth / 2 - gap, 3);
        ctx.roundRect(x + gap / 2, barY, barWidth - gap, barHeight, radius);
        ctx.fill();
        
        // Reset shadow for next iteration
        ctx.shadowBlur = 0;
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [isRecording, getAudioLevel]);

  if (!isRecording) {
    return null;
  }

  // Get energy label using configurable thresholds
  const getEnergyLabel = () => {
    if (currentLevel < thresholds.quiet) return { text: 'Quiet', color: 'text-primary/70' };
    if (currentLevel < thresholds.good) return { text: 'Good', color: 'text-energy-green' };
    return { text: 'Powerful!', color: 'text-energy-cyan' };
  };

  const energy = getEnergyLabel();

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Energy Level Text */}
      <motion.div 
        className="text-center mb-1"
        key={energy.text}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
      >
        <span className={`text-xs font-medium ${energy.color}`}>
          {energy.text}
        </span>
      </motion.div>

      {/* Compact Waveform */}
      <div className="bg-background/30 backdrop-blur-sm rounded-lg p-1.5">
        <canvas
          ref={canvasRef}
          className="w-full h-16 rounded"
          style={{ display: 'block' }}
        />
      </div>
    </motion.div>
  );
}
