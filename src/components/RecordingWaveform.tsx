import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface RecordingWaveformProps {
  getAudioLevel: () => number;
  isActive: boolean;
}

export function RecordingWaveform({ getAudioLevel, isActive }: RecordingWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const historyRef = useRef<number[]>([]);
  const barCount = 48;

  useEffect(() => {
    if (!isActive || !canvasRef.current) {
      historyRef.current = [];
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
      if (!isActive) return;

      const level = getAudioLevel();
      
      historyRef.current.push(level);
      if (historyRef.current.length > barCount) {
        historyRef.current.shift();
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.getBoundingClientRect().width;
      const height = canvas.getBoundingClientRect().height;
      const centerY = height / 2;
      const barWidth = width / barCount;
      const gap = 3;

      // Draw center line
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Draw bars from center outward (mirrored)
      for (let i = 0; i < historyRef.current.length; i++) {
        const x = i * barWidth;
        const amplitude = historyRef.current[i];
        const barHeight = Math.max(4, amplitude * height * 0.8);

        // Create gradient based on amplitude
        const gradient = ctx.createLinearGradient(x, centerY - barHeight / 2, x, centerY + barHeight / 2);
        
        if (amplitude < 0.3) {
          // Low - cyan tones
          gradient.addColorStop(0, `rgba(34, 211, 238, ${0.6 + amplitude})`);
          gradient.addColorStop(0.5, `rgba(6, 182, 212, ${0.8 + amplitude})`);
          gradient.addColorStop(1, `rgba(34, 211, 238, ${0.6 + amplitude})`);
        } else if (amplitude < 0.6) {
          // Medium - cyan to green
          gradient.addColorStop(0, `rgba(52, 211, 153, ${0.7 + amplitude * 0.3})`);
          gradient.addColorStop(0.5, `rgba(16, 185, 129, ${0.9})`);
          gradient.addColorStop(1, `rgba(52, 211, 153, ${0.7 + amplitude * 0.3})`);
        } else {
          // High - bright cyan/white
          gradient.addColorStop(0, `rgba(255, 255, 255, ${0.8})`);
          gradient.addColorStop(0.5, `rgba(34, 211, 238, 1)`);
          gradient.addColorStop(1, `rgba(255, 255, 255, ${0.8})`);
        }

        // Glow effect
        ctx.shadowColor = amplitude < 0.3 
          ? 'rgba(34, 211, 238, 0.5)' 
          : amplitude < 0.6 
            ? 'rgba(52, 211, 153, 0.6)' 
            : 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = amplitude * 20 + 5;

        ctx.fillStyle = gradient;
        ctx.beginPath();
        
        const radius = Math.min((barWidth - gap) / 2, 4);
        ctx.roundRect(
          x + gap / 2, 
          centerY - barHeight / 2, 
          barWidth - gap, 
          barHeight, 
          radius
        );
        ctx.fill();
        
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
  }, [isActive, getAudioLevel]);

  if (!isActive) return null;

  return (
    <motion.div
      className="absolute bottom-20 left-4 right-4 z-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-background/20 backdrop-blur-md rounded-2xl p-3 border border-white/10">
        <canvas
          ref={canvasRef}
          className="w-full h-20 rounded-xl"
          style={{ display: 'block' }}
        />
      </div>
    </motion.div>
  );
}
