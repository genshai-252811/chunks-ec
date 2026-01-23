import { motion } from "framer-motion";
import { Mic, Square, Loader2 } from "lucide-react";

interface RecordButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  onStart: () => void;
  onStop: () => void;
}

export function RecordButton({ isRecording, isProcessing, audioLevel, onStart, onStop }: RecordButtonProps) {
  const handleClick = () => {
    if (isProcessing) return;
    if (isRecording) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow rings when recording */}
      {isRecording && (
        <>
          <motion.div
            className="absolute rounded-full bg-destructive/20"
            animate={{
              width: [100, 140 + audioLevel * 40],
              height: [100, 140 + audioLevel * 40],
              opacity: [0.5, 0.1],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
          <motion.div
            className="absolute rounded-full bg-destructive/30"
            animate={{
              width: [90, 120 + audioLevel * 30],
              height: [90, 120 + audioLevel * 30],
              opacity: [0.6, 0.2],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.2,
            }}
          />
        </>
      )}

      {/* Static glow for idle state */}
      {!isRecording && !isProcessing && (
        <motion.div
          className="absolute w-28 h-28 rounded-full energy-glow"
          animate={{
            opacity: [0.5, 0.8, 0.5],
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Main button */}
      <motion.button
        onClick={handleClick}
        disabled={isProcessing}
        className={`
          relative z-10 w-20 h-20 rounded-full flex items-center justify-center
          transition-all duration-300 cursor-pointer
          ${
            isRecording
              ? "bg-destructive recording-pulse"
              : isProcessing
                ? "bg-muted cursor-not-allowed"
                : "gradient-primary energy-glow hover:scale-105"
          }
        `}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {isProcessing ? (
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
        ) : isRecording ? (
          <Square className="w-6 h-6 text-destructive-foreground fill-current" />
        ) : (
          <Mic className="w-8 h-8 text-primary-foreground" />
        )}
      </motion.button>

      {/* Label */}
      <motion.p
        className="absolute -bottom-10 text-sm text-muted-foreground font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {isProcessing ? "Analyzing..." : isRecording ? "Tap to stop" : "Tap to record"}
      </motion.p>
    </div>
  );
}
