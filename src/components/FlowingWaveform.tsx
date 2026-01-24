import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDisplayThresholds } from '@/hooks/useDisplaySettings';

interface FlowingWaveformProps {
  isRecording: boolean;
  getAudioLevel: () => number;
}

export function FlowingWaveform({ isRecording, getAudioLevel }: FlowingWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const timeRef = useRef<number>(0);
  const audioHistoryRef = useRef<number[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const thresholds = getDisplayThresholds();

  // Color schemes based on energy level
  const getColorScheme = (level: number) => {
    if (level < thresholds.quiet) {
      return {
        primary: 'hsl(200, 80%, 60%)',
        secondary: 'hsl(220, 70%, 50%)',
        glow: 'rgba(100, 180, 255, 0.6)',
        gradient: ['rgba(30, 100, 180, 0.8)', 'rgba(80, 160, 220, 0.9)', 'rgba(140, 200, 255, 1)'],
      };
    }
    if (level < thresholds.good) {
      return {
        primary: 'hsl(160, 80%, 55%)',
        secondary: 'hsl(140, 70%, 50%)',
        glow: 'rgba(50, 255, 180, 0.7)',
        gradient: ['rgba(0, 150, 100, 0.8)', 'rgba(50, 220, 150, 0.9)', 'rgba(100, 255, 200, 1)'],
      };
    }
    return {
      primary: 'hsl(180, 90%, 60%)',
      secondary: 'hsl(50, 90%, 60%)',
      glow: 'rgba(0, 255, 255, 0.8)',
      gradient: ['rgba(0, 180, 200, 0.8)', 'rgba(0, 255, 255, 0.95)', 'rgba(255, 255, 200, 1)'],
    };
  };

  useEffect(() => {
    if (!isRecording || !canvasRef.current) {
      audioHistoryRef.current = [];
      timeRef.current = 0;
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
      
      // Track peak for visual feedback
      if (level > peakLevel) {
        setPeakLevel(level);
      } else {
        setPeakLevel(prev => prev * 0.995); // Slow decay
      }

      // Keep audio history for smooth wave
      audioHistoryRef.current.push(level);
      if (audioHistoryRef.current.length > 120) {
        audioHistoryRef.current.shift();
      }

      timeRef.current += 0.05;

      const width = canvas.getBoundingClientRect().width;
      const height = canvas.getBoundingClientRect().height;
      const centerY = height / 2;

      // Clear with fade effect for trail
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, width, height);

      const colors = getColorScheme(level);
      const history = audioHistoryRef.current;

      if (history.length < 2) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Draw multiple wave layers for depth
      for (let layer = 0; layer < 3; layer++) {
        const layerOpacity = 1 - layer * 0.25;
        const layerOffset = layer * 0.3;
        const layerAmplitude = 1 - layer * 0.2;

        ctx.beginPath();
        ctx.moveTo(0, centerY);

        // Create flowing sine wave modulated by audio
        for (let x = 0; x <= width; x += 2) {
          const progress = x / width;
          const historyIndex = Math.floor(progress * (history.length - 1));
          const audioInfluence = history[historyIndex] || 0;

          // Multiple sine waves combined for organic feel
          const wave1 = Math.sin(progress * 4 + timeRef.current + layerOffset) * 0.5;
          const wave2 = Math.sin(progress * 8 + timeRef.current * 1.5 + layerOffset) * 0.3;
          const wave3 = Math.sin(progress * 2 + timeRef.current * 0.7 + layerOffset) * 0.2;
          
          const combinedWave = (wave1 + wave2 + wave3) * layerAmplitude;
          
          // Amplitude based on audio level
          const amplitude = (audioInfluence * 0.7 + level * 0.3) * height * 0.4;
          const y = centerY + combinedWave * amplitude;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        // Create gradient stroke
        const gradient = ctx.createLinearGradient(0, centerY - height / 2, 0, centerY + height / 2);
        gradient.addColorStop(0, colors.gradient[0]);
        gradient.addColorStop(0.5, colors.gradient[1]);
        gradient.addColorStop(1, colors.gradient[2]);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = (4 - layer) * (1 + level * 0.5);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Glow effect
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 15 + level * 20;
        ctx.globalAlpha = layerOpacity;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      // Draw mirrored wave below for symmetry (subtle)
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.scale(1, -1);
      ctx.translate(0, -height);
      
      ctx.beginPath();
      for (let x = 0; x <= width; x += 3) {
        const progress = x / width;
        const historyIndex = Math.floor(progress * (history.length - 1));
        const audioInfluence = history[historyIndex] || 0;
        
        const wave = Math.sin(progress * 4 + timeRef.current) * 0.5 +
                     Math.sin(progress * 8 + timeRef.current * 1.5) * 0.3;
        const amplitude = audioInfluence * height * 0.25;
        const y = centerY + wave * amplitude;

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      const mirrorGradient = ctx.createLinearGradient(0, centerY - 30, 0, centerY + 30);
      mirrorGradient.addColorStop(0, colors.gradient[0]);
      mirrorGradient.addColorStop(1, 'transparent');
      ctx.strokeStyle = mirrorGradient;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Add sparkle particles when energy is high
      if (level > thresholds.good) {
        const particleCount = Math.floor(level * 8);
        for (let i = 0; i < particleCount; i++) {
          const px = Math.random() * width;
          const py = centerY + (Math.random() - 0.5) * height * level * 0.6;
          const size = Math.random() * 3 + 1;
          
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.8})`;
          ctx.shadowColor = colors.glow;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
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
  }, [isRecording, getAudioLevel, thresholds, peakLevel]);

  // Get energy feedback
  const getEnergyFeedback = useMemo(() => {
    if (currentLevel < thresholds.quiet) {
      return { 
        emoji: '😴', 
        text: 'Speak louder!', 
        color: 'text-primary',
        subtext: 'Project your voice'
      };
    }
    if (currentLevel < thresholds.good) {
      return { 
        emoji: '🔥', 
        text: 'Good energy!', 
        color: 'text-energy-green',
        subtext: 'Keep it up'
      };
    }
    return { 
      emoji: '⚡', 
      text: 'POWERFUL!', 
      color: 'text-energy-cyan',
      subtext: 'Amazing presence!'
    };
  }, [currentLevel, thresholds]);

  if (!isRecording) {
    return null;
  }

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
    >
      {/* Energy Feedback Badge */}
      <motion.div 
        className="flex items-center justify-center gap-2 mb-2"
        key={getEnergyFeedback.text}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400 }}
      >
        <motion.span 
          className="text-2xl"
          animate={{ 
            scale: currentLevel > thresholds.good ? [1, 1.2, 1] : 1,
            rotate: currentLevel > thresholds.good ? [-5, 5, -5] : 0
          }}
          transition={{ duration: 0.3, repeat: currentLevel > thresholds.good ? Infinity : 0 }}
        >
          {getEnergyFeedback.emoji}
        </motion.span>
        <div className="text-center">
          <span className={`text-sm font-bold ${getEnergyFeedback.color}`}>
            {getEnergyFeedback.text}
          </span>
          <p className="text-[10px] text-muted-foreground">
            {getEnergyFeedback.subtext}
          </p>
        </div>
      </motion.div>

      {/* Waveform Canvas */}
      <div className="relative rounded-xl overflow-hidden bg-background/20 backdrop-blur-md border border-white/10">
        {/* Ambient glow behind */}
        <motion.div 
          className="absolute inset-0 opacity-30"
          animate={{
            background: currentLevel < thresholds.quiet 
              ? 'radial-gradient(circle at 50% 50%, rgba(100, 180, 255, 0.3), transparent 70%)'
              : currentLevel < thresholds.good
                ? 'radial-gradient(circle at 50% 50%, rgba(50, 255, 180, 0.4), transparent 70%)'
                : 'radial-gradient(circle at 50% 50%, rgba(0, 255, 255, 0.5), transparent 70%)'
          }}
        />
        
        <canvas
          ref={canvasRef}
          className="w-full h-20 relative z-10"
          style={{ display: 'block' }}
        />

        {/* Energy level indicator bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
          <motion.div 
            className="h-full"
            style={{
              background: currentLevel < thresholds.quiet 
                ? 'linear-gradient(90deg, hsl(200, 80%, 50%), hsl(220, 80%, 60%))'
                : currentLevel < thresholds.good
                  ? 'linear-gradient(90deg, hsl(160, 80%, 50%), hsl(140, 80%, 60%))'
                  : 'linear-gradient(90deg, hsl(180, 90%, 50%), hsl(60, 90%, 60%))'
            }}
            animate={{ width: `${currentLevel * 100}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>

      {/* Level percentage */}
      <div className="flex justify-between items-center mt-1 px-1">
        <span className="text-[10px] text-muted-foreground">Energy Level</span>
        <span className={`text-xs font-mono font-medium ${getEnergyFeedback.color}`}>
          {Math.round(currentLevel * 100)}%
        </span>
      </div>
    </motion.div>
  );
}
