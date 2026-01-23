import { motion } from 'framer-motion';

interface RecordingTimerProps {
  seconds: number;
  isRecording: boolean;
}

export function RecordingTimer({ seconds, isRecording }: RecordingTimerProps) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  const formatTime = () => {
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {isRecording && (
        <motion.div
          className="w-3 h-3 rounded-full bg-destructive"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
      <span className={`text-xl font-mono font-bold tracking-wider ${
        isRecording ? 'text-foreground text-glow' : 'text-muted-foreground'
      }`}>
        {formatTime()}
      </span>
    </motion.div>
  );
}
