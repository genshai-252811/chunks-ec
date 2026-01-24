import { motion } from 'framer-motion';
import { getDisplayThresholds } from '@/hooks/useDisplaySettings';

interface EnergyMeterProps {
  audioLevel: number;
}

export function EnergyMeter({ audioLevel }: EnergyMeterProps) {
  const thresholds = getDisplayThresholds();
  
  // Normalize to 0-100
  const level = Math.min(audioLevel * 100, 100);
  
  // Get color and label based on configurable thresholds
  const getEnergyState = () => {
    const quietPercent = thresholds.quiet * 100;
    const goodPercent = thresholds.good * 100;
    
    if (level < quietPercent) {
      return { 
        label: '😴 Quiet', 
        color: 'from-primary/50 to-primary',
        bgColor: 'bg-primary/20',
        textColor: 'text-primary'
      };
    }
    if (level < goodPercent) {
      return { 
        label: '🔥 Good!', 
        color: 'from-energy-green/70 to-energy-green',
        bgColor: 'bg-energy-green/20',
        textColor: 'text-energy-green'
      };
    }
    return { 
      label: '⚡ Powerful!', 
      color: 'from-energy-cyan/80 to-energy-cyan',
      bgColor: 'bg-energy-cyan/20',
      textColor: 'text-energy-cyan'
    };
  };

  const state = getEnergyState();

  return (
    <div className="w-full max-w-xs mx-auto">
      {/* Label */}
      <motion.div 
        className="flex justify-between items-center mb-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Energy</span>
        <motion.span 
          className={`text-sm font-semibold ${state.textColor}`}
          key={state.label}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500 }}
        >
          {state.label}
        </motion.span>
      </motion.div>

      {/* Progress Bar */}
      <div className={`relative h-4 rounded-full overflow-hidden ${state.bgColor} backdrop-blur-sm`}>
        {/* Fill */}
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${state.color}`}
          initial={{ width: 0 }}
          animate={{ width: `${level}%` }}
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
