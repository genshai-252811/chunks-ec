import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface RealtimeWaveformProps {
  isRecording: boolean;
  getAudioLevel: () => number;
}

export function RealtimeWaveform({ isRecording, getAudioLevel }: RealtimeWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const audioHistoryRef = useRef<number[]>([]);
  const maxHistoryLength = 100;

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

      const currentLevel = getAudioLevel();

      audioHistoryRef.current.push(currentLevel);
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

      // Draw main waveform
      ctx.beginPath();
      ctx.lineWidth = 2;

      const step = width / maxHistoryLength;

      for (let i = 0; i < history.length; i++) {
        const x = i * step;
        const level = history[i];
        const amplitude = level * (height / 2) * 0.8;
        const y = centerY + Math.sin((i / 5)) * amplitude;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        // Color based on audio level - cyan to green to yellow
        let r, g, b;
        if (level < 0.3) {
          // Low - Cyan/Blue
          r = 50;
          g = 180 + level * 75;
          b = 200 + level * 55;
        } else if (level < 0.6) {
          // Medium - Green/Yellow
          r = 100 + level * 155;
          g = 200;
          b = 50;
        } else {
          // High - Cyan glow
          r = 0;
          g = 255;
          b = 255 - level * 55;
        }

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.6 + level * 0.4})`;
      }

      ctx.stroke();

      // Draw mirror wave (more subtle)
      ctx.beginPath();
      ctx.lineWidth = 1.5;

      for (let i = 0; i < history.length; i++) {
        const x = i * step;
        const level = history[i];
        const amplitude = level * (height / 2) * 0.5;
        const y = centerY - Math.sin((i / 5)) * amplitude;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.strokeStyle = `rgba(147, 51, 234, 0.3)`; // Purple accent
      ctx.stroke();

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

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="glass-card p-3 backdrop-blur-md">
        <canvas
          ref={canvasRef}
          className="w-full h-16 rounded"
          style={{ display: 'block' }}
        />

        {/* Legend */}
        <div className="flex justify-center items-center gap-4 mt-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary/50" />
            <span>Quiet</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-energy-green/50" />
            <span>Good</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-energy-cyan" />
            <span>Powerful</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
