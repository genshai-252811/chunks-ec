import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, ChevronDown, ChevronUp, Volume2, Zap, TrendingUp, Clock, Waves, Sliders, ArrowRight, Eye, Hand, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreDisplay } from "./ScoreDisplay";
import { MetricCard } from "./MetricCard";
import { AnalysisResult } from "@/lib/audioAnalysis";
import { FaceTrackingMetrics } from "@/hooks/useFaceTracking";

interface MetricSetting {
  metric_id: string;
  weight: number;
  enabled: boolean;
}

// Load enabled metrics from localStorage (synced from Admin panel)
function getEnabledMetrics(): Set<string> {
  try {
    const stored = localStorage.getItem('audio_metric_settings');
    if (stored) {
      const settings: MetricSetting[] = JSON.parse(stored);
      return new Set(settings.filter(m => m.enabled && m.weight > 0).map(m => m.metric_id));
    }
  } catch (e) {
    console.error('Failed to load metric settings:', e);
  }
  // Default: all enabled
  return new Set(['volume', 'speechRate', 'acceleration', 'responseTime', 'pauseManagement', 'eyeContact', 'handMovement', 'blinkRate']);
}

interface ResultsViewProps {
  results: AnalysisResult;
  faceMetrics?: FaceTrackingMetrics | null;
  onRetry: () => void;
}

export function ResultsView({ results, faceMetrics, onRetry }: ResultsViewProps) {
  const [showDetails, setShowDetails] = useState(false);
  const enabledMetrics = useMemo(() => getEnabledMetrics(), []);

  const allAudioMetrics = [
    {
      id: 'volume',
      title: "Voice Power",
      titleVi: "Công suất giọng nói",
      score: results.volume.score,
      value: `Average: ${results.volume.averageDb.toFixed(1)} dB`,
      rawValue: results.volume.averageDb,
      tag: "POWER",
      icon: Volume2,
    },
    {
      id: 'speechRate',
      title: "Speech Tempo",
      titleVi: "Nhịp độ nói",
      score: results.speechRate.score,
      value: `${results.speechRate.wordsPerMinute} WPM`,
      rawValue: results.speechRate.wordsPerMinute,
      tag: "TEMPO",
      icon: Zap,
    },
    {
      id: 'acceleration',
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
      id: 'responseTime',
      title: "Response Spark",
      titleVi: "Phản ứng nhanh",
      score: results.responseTime.score,
      value: `Started in ${results.responseTime.responseTimeMs}ms`,
      rawValue: results.responseTime.responseTimeMs,
      tag: "SPARK",
      icon: Clock,
    },
    {
      id: 'pauseManagement',
      title: "Flow Control",
      titleVi: "Kiểm soát nhịp",
      score: results.pauses.score,
      value: `Pause ratio: ${(results.pauses.pauseRatio * 100).toFixed(0)}%`,
      rawValue: results.pauses.pauseRatio,
      tag: "FLOW",
      icon: Waves,
    },
  ];

  // Video metrics from face tracking
  const allVideoMetrics = faceMetrics ? [
    {
      id: 'eyeContact',
      title: "Eye Contact",
      titleVi: "Giao tiếp bằng mắt",
      score: faceMetrics.eyeContactScore,
      value: `${faceMetrics.eyeContactScore}% of time`,
      rawValue: faceMetrics.eyeContactScore,
      tag: "FOCUS",
      icon: Eye,
    },
    {
      id: 'handMovement',
      title: "Hand Movement",
      titleVi: "Cử chỉ tay",
      score: Math.min(100, faceMetrics.handMovementScore),
      value: `${faceMetrics.handMovementScore} activity`,
      rawValue: faceMetrics.handMovementScore,
      tag: "GESTURE",
      icon: Hand,
    },
    {
      id: 'blinkRate',
      title: "Blink Rate",
      titleVi: "Tần suất chớp mắt",
      score: faceMetrics.blinkRate >= 10 && faceMetrics.blinkRate <= 25 ? 80 : 
             faceMetrics.blinkRate >= 5 && faceMetrics.blinkRate <= 30 ? 60 : 40,
      value: `${faceMetrics.blinkRate} blinks/min`,
      rawValue: faceMetrics.blinkRate,
      tag: "NATURAL",
      icon: Sparkles,
    },
  ] : [];

  // Filter based on enabled settings from Admin panel
  const audioMetrics = allAudioMetrics.filter(m => enabledMetrics.has(m.id));
  const videoMetrics = allVideoMetrics.filter(m => enabledMetrics.has(m.id));
  const allMetrics = [...audioMetrics, ...videoMetrics];

  // Quick summary of top metrics
  const topMetric = allMetrics.reduce((a, b) => a.score > b.score ? a : b);
  const needsWork = allMetrics.reduce((a, b) => a.score < b.score ? a : b);

  return (
    <div className="w-full max-w-md mx-auto px-4 pb-8">
      {/* Score Display */}
      <motion.div 
        className="mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <ScoreDisplay
          score={results.overallScore}
          emotionalFeedback={results.emotionalFeedback}
        />
      </motion.div>

      {/* Quick Insights Card */}
      <motion.div
        className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border border-border/50"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Strongest</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <topMetric.icon className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{topMetric.title}</p>
                <p className="text-xs text-emerald-400">{topMetric.score} pts</p>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Focus Area</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <needsWork.icon className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{needsWork.title}</p>
                <p className="text-xs text-amber-400">{needsWork.score} pts</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Show Details Toggle */}
      <motion.button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-muted/50"
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {showDetails ? (
          <>
            <ChevronUp className="w-4 h-4" />
            Hide Detailed Breakdown
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            View Detailed Breakdown
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
            className="space-y-3 mb-8 overflow-hidden pt-4"
          >
            {results.normalization && (
              <motion.div 
                className="rounded-xl border border-border/50 bg-muted/30 p-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sliders className="h-4 w-4 text-primary" />
                  Calibration Data
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="p-2 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground">Original</p>
                    <p className="text-sm font-medium">{results.normalization.originalLUFS} LUFS</p>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground">Normalized</p>
                    <p className="text-sm font-medium">{results.normalization.finalLUFS} LUFS</p>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground">Device Gain</p>
                    <p className="text-sm font-medium">{results.normalization.deviceGain}x</p>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground">Normalization</p>
                    <p className="text-sm font-medium">{results.normalization.normalizationGain}x</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Audio Metrics Section */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Volume2 className="w-3 h-3" /> Audio Analysis
              </p>
            </motion.div>
            
            {audioMetrics.map((metric, index) => (
              <MetricCard
                key={metric.tag}
                {...metric}
                index={index}
              />
            ))}

            {/* Video Metrics Section */}
            {videoMetrics.length > 0 && (
              <>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="pt-4"
                >
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Video Analysis
                  </p>
                </motion.div>
                
                {videoMetrics.map((metric, index) => (
                  <MetricCard
                    key={metric.tag}
                    {...metric}
                    index={index + audioMetrics.length}
                  />
                ))}
              </>
            )}
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
          className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-400 text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:shadow-cyan-500/40 hover:scale-[1.02]"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Practice Again
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </motion.div>
    </div>
  );
}
