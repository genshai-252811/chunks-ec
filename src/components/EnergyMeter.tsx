import { motion } from 'framer-motion';
import { Volume, Volume1, Volume2 } from 'lucide-react';
import { getDisplayThresholds } from '@/hooks/useDisplaySettings';

interface EnergyMeterProps {
  audioLevel: number;
  speechProbability?: number;
  isSpeaking?: boolean;
}

export function EnergyMeter({ audioLevel, speechProbability = 0, isSpeaking = false }: EnergyMeterProps) {
  const thresholds = getDisplayThresholds();
  // Normalize to 0-100
  const level = Math.min(audioLevel * 100, 100);
  
  // Use speech probability if available (more accurate), otherwise fall back to audio level
  const effectiveLevel = speechProbability > 0.1 ? speechProbability * 100 : level;
  
  // Get color, label and icon based on configurable thresholds and VAD speaking state
  const getEnergyState = () => {
    const quietPercent = thresholds.quiet * 100;
    const goodPercent = thresholds.good * 100;
    
    // If VAD says we're speaking, boost the state
    if (isSpeaking) {
      if (effectiveLevel >= goodPercent) {
        return { 
          label: 'Powerful!', 
          color: 'from-energy-cyan/80 to-energy-cyan',
          bgColor: 'bg-energy-cyan/20',
          textColor: 'text-energy-cyan',
          Icon: Volume2,
        };
      }
      return { 
        label: 'Good!', 
        color: 'from-energy-green/70 to-energy-green',
        bgColor: 'bg-energy-green/20',
        textColor: 'text-energy-green',
        Icon: Volume1,
      };
    }
    
    if (effectiveLevel < quietPercent) {
      return { 
        label: 'Quiet', 
        color: 'from-primary/50 to-primary',
        bgColor: 'bg-primary/20',
        textColor: 'text-primary',
        Icon: Volume,
      };
    }
    if (effectiveLevel < goodPercent) {
      return { 
        label: 'Good!', 
        color: 'from-energy-green/70 to-energy-green',
        bgColor: 'bg-energy-green/20',
        textColor: 'text-energy-green',
        Icon: Volume1,
      };
    }
    return { 
      label: 'Powerful!', 
      color: 'from-energy-cyan/80 to-energy-cyan',
      bgColor: 'bg-energy-cyan/20',
      textColor: 'text-energy-cyan',
      Icon: Volume2,
    };
  };

  const state = getEnergyState();

  return (
    <div className="w-full max-w-xs mx-auto">
      {/* Label with icon */}
      <motion.div 
        className="flex justify-between items-center mb-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Energy</span>
          {isSpeaking && (
            <motion.span
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-energy-green/20 text-energy-green font-medium"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              Speaking
            </motion.span>
          )}
        </div>
        <motion.div 
          className={`flex items-center gap-1 ${state.textColor}`}
          key={state.label}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500 }}
        >
          <state.Icon className="w-4 h-4" />
          <span className="text-sm font-semibold">{state.label}</span>
        </motion.div>
      </motion.div>

      {/* Progress Bar */}
      <div className={`relative h-4 rounded-full overflow-hidden ${state.bgColor} backdrop-blur-sm`}>
        {/* Fill - use effectiveLevel for more accurate display */}
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${state.color}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(level, effectiveLevel)}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
        
        {/* Glow effect at the edge */}
        <motion.div
          className="absolute inset-y-0 w-8 rounded-full"
          style={{ 
            left: `calc(${level}% - 16px)`,
            background: `radial-gradient(circle, ${level > 60 ? 'rgba(0,255,255,0.6)' : level > 30 ? 'rgba(50,255,150,0.5)' : 'rgba(100,200,255,0.4)'} 0%, transparent 70%)`
          }}
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />

        {/* Level markers */}
        <div className="absolute inset-0 flex justify-between px-1 items-center pointer-events-none">
          <div className="w-px h-2 bg-white/20" />
          <div className="w-px h-2 bg-white/20" />
          <div className="w-px h-2 bg-white/20" />
          <div className="w-px h-2 bg-white/20" />
          <div className="w-px h-2 bg-white/20" />
        </div>
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-1 text-[10px] text-muted-foreground/50">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}
