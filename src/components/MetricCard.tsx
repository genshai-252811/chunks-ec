import { motion } from 'framer-motion';
import { Volume2, Mic2, Flame, Timer, Waves, LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  titleVi: string;
  score: number;
  tag: string;
  value?: string;
  index: number;
  rawValue?: number;
  icon?: LucideIcon;
}

const tagColors: Record<string, string> = {
  POWER: 'bg-tag-energy/20 text-tag-energy border-tag-energy/30',
  TEMPO: 'bg-tag-fluency/20 text-tag-fluency border-tag-fluency/30',
  BOOST: 'bg-tag-dynamics/20 text-tag-dynamics border-tag-dynamics/30',
  SPARK: 'bg-tag-readiness/20 text-tag-readiness border-tag-readiness/30',
  FLOW: 'bg-tag-fluidity/20 text-tag-fluidity border-tag-fluidity/30',
};

const tagIcons: Record<string, React.ReactNode> = {
  POWER: <Volume2 className="w-4 h-4" />,
  TEMPO: <Mic2 className="w-4 h-4" />,
  BOOST: <Flame className="w-4 h-4" />,
  SPARK: <Timer className="w-4 h-4" />,
  FLOW: <Waves className="w-4 h-4" />,
};

function getScoreColor(score: number): string {
  if (score >= 71) return 'from-energy-green to-primary';
  if (score >= 41) return 'from-energy-yellow to-energy-green';
  return 'from-energy-red to-energy-yellow';
}

function getPerformanceLabel(tag: string, score: number, rawValue?: number): { label: string; color: string } {
  if (tag === 'POWER') {
    if (score >= 80) return { label: '⚡ High Power', color: 'text-energy-green' };
    if (score >= 50) return { label: '🔋 Medium Power', color: 'text-energy-yellow' };
    return { label: '🪫 Low Power', color: 'text-energy-red' };
  }

  if (tag === 'TEMPO') {
    if (rawValue !== undefined) {
      if (rawValue < 100) return { label: '🐢 Too Slow', color: 'text-energy-yellow' };
      if (rawValue > 200) return { label: '🚀 Too Fast', color: 'text-energy-yellow' };
      if (rawValue >= 140 && rawValue <= 170) return { label: '✨ Perfect Pace', color: 'text-energy-green' };
    }
    if (score >= 70) return { label: '🎯 Good Pace', color: 'text-energy-green' };
    return { label: '📊 Adjust Pace', color: 'text-energy-yellow' };
  }

  if (tag === 'BOOST') {
    if (score >= 70) return { label: '📈 Great Build-up', color: 'text-energy-green' };
    if (score >= 50) return { label: '➡️ Steady', color: 'text-energy-yellow' };
    return { label: '📉 Low Momentum', color: 'text-energy-red' };
  }

  if (tag === 'SPARK') {
    if (score >= 80) return { label: '⚡ Quick Start', color: 'text-energy-green' };
    if (score >= 50) return { label: '🕐 Normal Start', color: 'text-energy-yellow' };
    return { label: '😴 Slow Start', color: 'text-energy-red' };
  }

  if (tag === 'FLOW') {
    if (score >= 80) return { label: '🌊 Smooth Flow', color: 'text-energy-green' };
    if (score >= 50) return { label: '💧 Some Breaks', color: 'text-energy-yellow' };
    return { label: '🧊 Too Many Pauses', color: 'text-energy-red' };
  }

  return { label: '', color: '' };
}

export const MetricCard = ({ title, titleVi, score, tag, value, index, rawValue }: MetricCardProps) => {
  const performance = getPerformanceLabel(tag, score, rawValue);

  return (
    <motion.div
      className="glass-card p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {/* Tag Badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${tagColors[tag] || ''}`}>
              {tagIcons[tag]}
              {tag}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{titleVi}</p>
        </div>

        {/* Score */}
        <div className="text-right">
          <div className={`text-2xl font-bold bg-gradient-to-r ${getScoreColor(score)} bg-clip-text text-transparent`}>
            {score}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
        <motion.div
          className={`h-full bg-gradient-to-r ${getScoreColor(score)} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
        />
      </div>

      {/* Value and Performance Label */}
      <div className="flex items-center justify-between">
        {value && (
          <p className="text-xs text-muted-foreground">{value}</p>
        )}
        {performance.label && (
          <p className={`text-xs font-medium ${performance.color}`}>
            {performance.label}
          </p>
        )}
      </div>
    </motion.div>
  );
}
