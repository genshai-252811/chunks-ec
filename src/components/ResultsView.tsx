import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, ChevronDown, ChevronUp, Volume2, Zap, TrendingUp, Clock, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreDisplay } from "./ScoreDisplay";
import { MetricCard } from "./MetricCard";
import { AnalysisResult } from "@/lib/audioAnalysis";

interface ResultsViewProps {
  results: AnalysisResult;
  onRetry: () => void;
}

export function ResultsView({ results, onRetry }: ResultsViewProps) {
  const [showDetails, setShowDetails] = useState(false);

  const metrics = [
    {
      title: "Voice Power",
      titleVi: "Công suất giọng nói",
      score: results.volume.score,
      value: `Average: ${results.volume.averageDb.toFixed(1)} dB`,
      rawValue: results.volume.averageDb,
      tag: "POWER",
      icon: Volume2,
    },
    {
      title: "Speech Tempo",
      titleVi: "Nhịp độ nói",
      score: results.speechRate.score,
      value: `${results.speechRate.wordsPerMinute} WPM`,
      rawValue: results.speechRate.wordsPerMinute,
      tag: "TEMPO",
      icon: Zap,
    },
    {
      title: "Energy Boost",
      titleVi: "Tăng cường năng lượng",
      score: results.acceleration.score,
      value: results.acceleration.isAccelerating
        ? `↑ Power: ${results.acceleration.segment1Volume}→${results.acceleration.segment2Volume}dB | Tempo: ${results.acceleration.segment1Rate}→${results.acceleration.segment2Rate}WPM`
        : "→ Steady energy throughout",
      rawValue: results.acceleration.score,
      tag: "BOOST",
      icon: TrendingUp,
    },
    {
      title: "Response Spark",
      titleVi: "Phản ứng nhanh",
      score: results.responseTime.score,
      value: `Started in ${results.responseTime.responseTimeMs}ms`,
      rawValue: results.responseTime.responseTimeMs,
      tag: "SPARK",
      icon: Clock,
    },
    {
      title: "Flow Control",
      titleVi: "Kiểm soát nhịp",
      score: results.pauses.score,
      value: `Pause ratio: ${(results.pauses.pauseRatio * 100).toFixed(0)}%`,
      rawValue: results.pauses.pauseRatio,
      tag: "FLOW",
      icon: Waves,
    },
  ];

  return (
    <div className="w-full max-w-md mx-auto px-4 pb-8">
      {/* Score Display */}
      <div className="mb-8">
        <ScoreDisplay
          score={results.overallScore}
          emotionalFeedback={results.emotionalFeedback}
        />
      </div>

      {/* Show Details Toggle */}
      <motion.button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
        whileTap={{ scale: 0.98 }}
      >
        {showDetails ? (
          <>
            <ChevronUp className="w-4 h-4" />
            Hide Details
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            Show Details
          </>
        )}
      </motion.button>

      {/* Detailed Metrics */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3 mb-8 overflow-hidden"
          >
            {metrics.map((metric, index) => (
              <MetricCard
                key={metric.tag}
                {...metric}
                index={index}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Retry Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          onClick={onRetry}
          size="lg"
          className="w-full gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Try Again
        </Button>
      </motion.div>
    </div>
  );
}
