import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

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

      // Draw bars instead of wave for clearer energy visualization
      const barWidth = width / maxHistoryLength;
      const gap = 1;

      for (let i = 0; i < history.length; i++) {
        const x = i * barWidth;
        const level = history[i];
        const barHeight = level * height * 0.9;
        
        // Color based on level
        let color;
        if (level < 0.3) {
          color = `rgba(100, 200, 255, ${0.4 + level})`; // Cyan - quiet
        } else if (level < 0.6) {
          color = `rgba(50, 255, 150, ${0.5 + level * 0.5})`; // Green - good
        } else {
          color = `rgba(0, 255, 255, ${0.7 + level * 0.3})`; // Bright cyan - powerful
        }

        ctx.fillStyle = color;
        ctx.fillRect(x + gap/2, centerY - barHeight/2, barWidth - gap, barHeight);
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

  // Get energy label
  const getEnergyLabel = () => {
    if (currentLevel < 0.3) return { text: 'Quiet', color: 'text-primary/70' };
    if (currentLevel < 0.6) return { text: 'Good', color: 'text-energy-green' };
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
          className="w-full h-8 rounded"
          style={{ display: 'block' }}
        />
      </div>
    </motion.div>
  );
}
