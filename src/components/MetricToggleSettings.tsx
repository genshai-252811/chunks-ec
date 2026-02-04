import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Info, RotateCcw } from 'lucide-react';
import {
  MetricSettings,
  DEFAULT_METRIC_SETTINGS,
  loadMetricSettings,
  saveMetricSettings,
  rebalanceWeights,
  METRIC_LABELS,
  METRIC_DESCRIPTIONS,
} from '@/lib/metricSettings';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function MetricToggleSettings() {
  const [settings, setSettings] = useState<MetricSettings>(loadMetricSettings());
  const [hasChanges, setHasChanges] = useState(false);

  // Calculate total weight of enabled metrics
  const totalWeight = Object.values(settings)
    .filter(config => config.enabled)
    .reduce((sum, config) => sum + config.weight, 0);

  const handleToggle = (metric: keyof MetricSettings) => {
    const newSettings = {
      ...settings,
      [metric]: {
        ...settings[metric],
        enabled: !settings[metric].enabled,
      },
    };

    // Auto-rebalance when toggling
    const rebalanced = rebalanceWeights(newSettings);
    setSettings(rebalanced);
    setHasChanges(true);
  };

  const handleWeightChange = (metric: keyof MetricSettings, value: number[]) => {
    const newSettings = {
      ...settings,
      [metric]: {
        ...settings[metric],
        weight: value[0],
      },
    };
    setSettings(newSettings);
    setHasChanges(true);
  };

  const handleRebalance = () => {
    const rebalanced = rebalanceWeights(settings);
    setSettings(rebalanced);
    setHasChanges(true);
  };

  const handleReset = () => {
    setSettings(DEFAULT_METRIC_SETTINGS);
    setHasChanges(true);
  };

  const handleSave = () => {
    const rebalanced = rebalanceWeights(settings);
    saveMetricSettings(rebalanced);
    setSettings(rebalanced);
    setHasChanges(false);
  };

  const handleCancel = () => {
    setSettings(loadMetricSettings());
    setHasChanges(false);
  };

  // Auto-save on unmount if there are changes
  useEffect(() => {
    return () => {
      if (hasChanges) {
        const rebalanced = rebalanceWeights(settings);
        saveMetricSettings(rebalanced);
      }
    };
  }, [hasChanges, settings]);

  const metricKeys: (keyof MetricSettings)[] = [
    'volume',
    'speechRate',
    'acceleration',
    'responseTime',
    'pauses',
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metric Configuration</CardTitle>
        <CardDescription>
          Customize which metrics to use and their relative importance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Weight Distribution Display */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Total Weight</span>
            <span
              className={`text-lg font-bold ${
                totalWeight === 100 ? 'text-green-600' : 'text-orange-600'
              }`}
            >
              {totalWeight}%
            </span>
          </div>
          <div className="h-4 bg-background rounded-full overflow-hidden flex">
            {metricKeys.map(key => {
              const config = settings[key];
              if (!config.enabled) return null;

              const colors: Record<keyof MetricSettings, string> = {
                volume: 'bg-blue-500',
                speechRate: 'bg-green-500',
                acceleration: 'bg-purple-500',
                responseTime: 'bg-orange-500',
                pauses: 'bg-pink-500',
              };

              return (
                <div
                  key={key}
                  className={`${colors[key]} flex items-center justify-center text-xs text-white font-medium`}
                  style={{ width: `${config.weight}%` }}
                  title={`${METRIC_LABELS[key]}: ${config.weight}%`}
                >
                  {config.weight > 10 && `${config.weight}%`}
                </div>
              );
            })}
          </div>
          {totalWeight !== 100 && (
            <div className="mt-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-orange-600" />
              <span className="text-xs text-orange-600">
                Weights should total 100%. Click "Rebalance" to auto-adjust.
              </span>
            </div>
          )}
        </div>

        {/* Metric Controls */}
        <div className="space-y-4">
          {metricKeys.map(key => {
            const config = settings[key];
            return (
              <div
                key={key}
                className={`p-4 border rounded-lg transition-opacity ${
                  !config.enabled && 'opacity-50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`toggle-${key}`}
                      checked={config.enabled}
                      onCheckedChange={() => handleToggle(key)}
                    />
                    <div>
                      <Label htmlFor={`toggle-${key}`} className="cursor-pointer">
                        {METRIC_LABELS[key]}
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-muted-foreground inline ml-1 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{METRIC_DESCRIPTIONS[key]}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <span className="text-sm font-medium">{config.weight}%</span>
                </div>

                {config.enabled && (
                  <div className="pl-10">
                    <Slider
                      value={[config.weight]}
                      onValueChange={(value) => handleWeightChange(key, value)}
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRebalance}
            disabled={totalWeight === 100}
          >
            Rebalance
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
          <div className="flex-1" />
          {hasChanges && (
            <>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save Changes
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
