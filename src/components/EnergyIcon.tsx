import { motion } from 'framer-motion';
import { getEnergyLevel } from '@/lib/energyCalculator';

interface EnergyIconProps {
  audioLevel: number;
  size?: 'md' | 'lg';
}

export function EnergyIcon({ audioLevel, size = 'md' }: EnergyIconProps) {
  const energyLevel = getEnergyLevel(audioLevel);

  const sizeClass = size === 'lg' ? 'text-6xl' : 'text-5xl';

  return (
    <motion.div
      className="flex flex-col items-center gap-1"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <motion.span
        className={sizeClass}
        animate={{
          scale: audioLevel > 0.6 ? [1, 1.2, 1] : 1,
        }}
        transition={{
          duration: 0.3,
          repeat: audioLevel > 0.6 ? Infinity : 0,
          repeatDelay: 0.2,
        }}
      >
        {energyLevel.icon}
      </motion.span>
      <motion.span
        className={`text-xs font-medium ${energyLevel.color}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {energyLevel.label}
      </motion.span>
    </motion.div>
  );
}
