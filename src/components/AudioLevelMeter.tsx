import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Volume2, VolumeX } from 'lucide-react';

interface AudioLevelMeterProps {
  audioLevel: number; // 0-1 range
  lufs?: number | null; // Optional LUFS display
  targetLUFS?: number; // Optional target LUFS (default: -23)
  showWaveform?: boolean;
  height?: number;
}

export function AudioLevelMeter({
  audioLevel,
  lufs,
  targetLUFS = -23,
  showWaveform = false,
  height = 100,
}: AudioLevelMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);

  // Update waveform data
  useEffect(() => {
    if (showWaveform) {
      setWaveformData(prev => {
        const newData = [...prev, audioLevel];
        return newData.slice(-100); // Keep last 100 samples
      });
    }
  }, [audioLevel, showWaveform]);

  // Draw waveform
  useEffect(() => {
    if (!showWaveform || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    ctx.beginPath();
    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 2;

    waveformData.forEach((level, i) => {
      const x = (i / waveformData.length) * width;
      const y = height / 2 + (level - 0.5) * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw center line
    ctx.beginPath();
    ctx.strokeStyle = 'hsl(var(--muted-foreground))';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [waveformData, showWaveform]);

  const levelPercentage = Math.min(100, audioLevel * 100);
  const isActive = audioLevel > 0.01;

  // Calculate LUFS color
  let lufsColor = 'text-muted-foreground';
  if (lufs !== undefined && lufs !== null) {
    const diff = Math.abs(lufs - targetLUFS);
    if (diff < 2) {
      lufsColor = 'text-green-500';
    } else if (diff < 5) {
      lufsColor = 'text-yellow-500';
    } else {
      lufsColor = 'text-orange-500';
    }
  }

  return (
    <div className="space-y-3">
      {/* Level Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          {isActive ? (
            <Volume2 className="w-5 h-5 text-primary animate-pulse" />
          ) : (
            <VolumeX className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 relative">
          <div className="h-8 bg-muted rounded-full overflow-hidden">
            {/* Level bar with gradient */}
            <div
              className={`h-full transition-all duration-100 ${
                levelPercentage > 80
                  ? 'bg-gradient-to-r from-green-500 via-yellow-500 to-red-500'
                  : levelPercentage > 50
                  ? 'bg-gradient-to-r from-green-500 to-yellow-500'
                  : 'bg-gradient-to-r from-blue-500 to-green-500'
              }`}
              style={{ width: `${levelPercentage}%` }}
            >
              <div className="h-full w-full bg-white/20 animate-pulse" />
            </div>
          </div>

          {/* Tick marks */}
          <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
            {[25, 50, 75].map(tick => (
              <div
                key={tick}
                className="w-px h-8 bg-border"
                style={{ marginLeft: `${tick}%` }}
              />
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 w-12 text-right">
          <span className="text-sm font-medium">
            {Math.round(levelPercentage)}%
          </span>
        </div>
      </div>

      {/* LUFS Display */}
      {lufs !== undefined && lufs !== null && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div>
            <div className="text-xs text-muted-foreground">Current LUFS</div>
            <div className={`text-2xl font-bold ${lufsColor}`}>
              {lufs.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Target</div>
            <div className="text-lg font-medium">{targetLUFS.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Waveform */}
      {showWaveform && (
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={400}
            height={height}
            className="w-full h-auto bg-muted rounded-lg"
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {!isActive && (
              <span className="text-sm text-muted-foreground">
                Start speaking to see waveform
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
