import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, RotateCcw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MetricSetting {
  id: string;
  metric_id: string;
  weight: number;
  min_threshold: number;
  ideal_threshold: number;
  max_threshold: number;
  method: string | null;
  enabled: boolean; // Local state - weight > 0 means enabled
}

const DEFAULT_METRICS: Omit<MetricSetting, 'id'>[] = [
  { metric_id: 'volume', weight: 30, min_threshold: -35, ideal_threshold: -15, max_threshold: 0, method: null, enabled: true },
  { metric_id: 'speechRate', weight: 30, min_threshold: 90, ideal_threshold: 150, max_threshold: 220, method: 'spectral-flux', enabled: true },
  { metric_id: 'acceleration', weight: 5, min_threshold: 0, ideal_threshold: 50, max_threshold: 100, method: null, enabled: true },
  { metric_id: 'responseTime', weight: 5, min_threshold: 2000, ideal_threshold: 200, max_threshold: 0, method: null, enabled: true },
  { metric_id: 'pauseManagement', weight: 10, min_threshold: 0, ideal_threshold: 0, max_threshold: 2.71, method: null, enabled: true },
  // Video-based metrics
  { metric_id: 'eyeContact', weight: 10, min_threshold: 0, ideal_threshold: 80, max_threshold: 100, method: 'percentage', enabled: true },
  { metric_id: 'handMovement', weight: 5, min_threshold: 0, ideal_threshold: 50, max_threshold: 100, method: 'activity_score', enabled: true },
  { metric_id: 'blinkRate', weight: 5, min_threshold: 10, ideal_threshold: 15, max_threshold: 25, method: 'count_per_minute', enabled: true },
];

const METRIC_LABELS: Record<string, { name: string; description: string; unit: string; color: string; category: 'audio' | 'video' }> = {
  // Audio metrics
  volume: { name: 'Energy (Volume)', description: 'Average loudness in dB', unit: 'dB', color: 'bg-blue-500', category: 'audio' },
  speechRate: { name: 'Fluency (Speech Rate)', description: 'Words per minute', unit: 'WPM', color: 'bg-green-500', category: 'audio' },
  acceleration: { name: 'Dynamics (Acceleration)', description: 'Energy increase over time', unit: '%', color: 'bg-purple-500', category: 'audio' },
  responseTime: { name: 'Readiness (Response Time)', description: 'Time before speaking', unit: 'ms', color: 'bg-orange-500', category: 'audio' },
  pauseManagement: { name: 'Fluidity (Pauses)', description: 'Pause ratio', unit: 'ratio', color: 'bg-pink-500', category: 'audio' },
  // Video metrics
  eyeContact: { name: 'Eye Contact', description: 'Looking at camera percentage', unit: '%', color: 'bg-cyan-500', category: 'video' },
  handMovement: { name: 'Hand Movement', description: 'Hand gesture activity level', unit: 'score', color: 'bg-amber-500', category: 'video' },
  blinkRate: { name: 'Blink Rate', description: 'Blinks per minute (natural is 15-20)', unit: 'bpm', color: 'bg-rose-500', category: 'video' },
};

export const MetricsTab = () => {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<MetricSetting[]>([]);
  const [originalMetrics, setOriginalMetrics] = useState<MetricSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [allowUserCustomization, setAllowUserCustomization] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch global app settings
      const { data: appSettings, error: appSettingsError } = await (supabase as any)
        .from('app_settings')
        .select('value')
        .eq('key', 'allow_user_metrics_customization')
        .single();

      if (!appSettingsError && appSettings) {
        setAllowUserCustomization(!!appSettings.value);
      }

      const { data, error } = await supabase
        .from('metric_settings')
        .select('*');

      if (error) throw error;

      let loadedMetrics: MetricSetting[];
      if (!data || data.length === 0) {
        loadedMetrics = DEFAULT_METRICS.map((m, i) => ({ ...m, id: `temp-${i}` }));
      } else {
        loadedMetrics = data.map(m => ({ ...m, enabled: m.weight > 0 }));
      }

      setMetrics(loadedMetrics);
      setOriginalMetrics(JSON.parse(JSON.stringify(loadedMetrics)));
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      toast({ title: 'Error', description: 'Failed to load metric settings.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Check for changes
  useEffect(() => {
    const changed = JSON.stringify(metrics) !== JSON.stringify(originalMetrics);
    setHasChanges(changed);
  }, [metrics, originalMetrics]);

  const rebalanceWeights = (currentMetrics: MetricSetting[]): MetricSetting[] => {
    const enabledMetrics = currentMetrics.filter(m => m.enabled);

    if (enabledMetrics.length === 0) {
      return currentMetrics;
    }

    const totalWeight = enabledMetrics.reduce((sum, m) => sum + m.weight, 0);

    if (totalWeight === 100) {
      return currentMetrics;
    }

    // Proportionally adjust weights to sum to 100
    const rebalanced = currentMetrics.map(m => {
      if (!m.enabled) return { ...m, weight: 0 };
      const newWeight = Math.round((m.weight / totalWeight) * 100);
      return { ...m, weight: newWeight };
    });

    // Handle rounding errors
    const newTotal = rebalanced.filter(m => m.enabled).reduce((sum, m) => sum + m.weight, 0);
    if (newTotal !== 100 && enabledMetrics.length > 0) {
      const firstEnabled = rebalanced.find(m => m.enabled);
      if (firstEnabled) {
        firstEnabled.weight += 100 - newTotal;
      }
    }

    return rebalanced;
  };

  const handleToggle = (metricId: string) => {
    setMetrics(prev => {
      const updated = prev.map(m => {
        if (m.metric_id === metricId) {
          const wasEnabled = m.enabled;
          // If disabling, set weight to 0; if enabling, restore default weight
          const defaultMetric = DEFAULT_METRICS.find(d => d.metric_id === metricId);
          return {
            ...m,
            enabled: !wasEnabled,
            weight: !wasEnabled ? (defaultMetric?.weight || 20) : 0
          };
        }
        return m;
      });
      return rebalanceWeights(updated);
    });
  };

  const handleWeightChange = (metricId: string, value: number) => {
    setMetrics(prev =>
      prev.map(m => m.metric_id === metricId ? { ...m, weight: value } : m)
    );
  };

  const handleThresholdChange = (metricId: string, field: 'min_threshold' | 'ideal_threshold' | 'max_threshold', value: number) => {
    setMetrics(prev =>
      prev.map(m => m.metric_id === metricId ? { ...m, [field]: value } : m)
    );
  };

  const handleMethodChange = (metricId: string, method: string) => {
    setMetrics(prev =>
      prev.map(m => m.metric_id === metricId ? { ...m, method } : m)
    );
  };

  const handleRebalance = () => {
    setMetrics(prev => rebalanceWeights(prev));
  };

  const handleReset = () => {
    setMetrics(DEFAULT_METRICS.map((m, i) => ({ ...m, id: `temp-${i}` })));
  };

  const handleCancel = () => {
    setMetrics(JSON.parse(JSON.stringify(originalMetrics)));
  };

  const handleSave = async () => {
    const rebalanced = rebalanceWeights(metrics);
    setIsSaving(true);
    try {
      // Use upsert instead of delete+insert to avoid unique constraint issues
      for (const m of rebalanced) {
        const { error } = await supabase
          .from('metric_settings')
          .upsert({
            metric_id: m.metric_id,
            weight: m.enabled ? m.weight : 0,
            min_threshold: m.min_threshold,
            ideal_threshold: m.ideal_threshold,
            max_threshold: m.max_threshold,
            method: m.method,
          }, { onConflict: 'metric_id' });

        if (error) throw error;
      }

      // Update localStorage for immediate effect
      const localConfig = rebalanced.map(m => ({
        id: m.metric_id,
        weight: m.enabled ? m.weight : 0,
        enabled: m.enabled,
        thresholds: {
          min: m.min_threshold,
          ideal: m.ideal_threshold,
          max: m.max_threshold,
        },
        method: m.method,
      }));
      console.log('💾 [MetricsTab] Saving to localStorage:', localConfig);
      localStorage.setItem('metricConfig', JSON.stringify(localConfig));
      console.log('✅ [MetricsTab] Saved metricConfig to localStorage');

      // Save global app setting
      const { error: appSettingsError } = await (supabase as any)
        .from('app_settings')
        .upsert({
          key: 'allow_user_metrics_customization',
          value: allowUserCustomization
        }, { onConflict: 'key' });

      if (appSettingsError) throw appSettingsError;

      toast({ title: 'Success', description: 'Settings saved successfully.' });
      await fetchMetrics();
    } catch (err: any) {
      console.error('Error saving metrics:', err);
      toast({
        variant: 'destructive',
        title: 'Error saving settings',
        description: err.message,
      });
    } finally {
      setIsSaving(false);
      setHasChanges(false);
    }
  };

  // Calculate totals
  const enabledMetrics = metrics.filter(m => m.enabled);
  const totalWeight = enabledMetrics.reduce((sum, m) => sum + m.weight, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Global Settings</CardTitle>
          <CardDescription>Configure system-wide behavior for metrics.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-1">
              <Label htmlFor="allow-customization">Allow User Customization</Label>
              <p className="text-sm text-muted-foreground">
                If enabled, users can override these default settings in their own profile.
                If disabled, all users will use the settings configured here.
              </p>
            </div>
            <Switch
              id="allow-customization"
              checked={allowUserCustomization}
              onCheckedChange={(checked) => {
                setAllowUserCustomization(checked);
                setHasChanges(true);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="w-full sm:w-auto"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Weight Distribution Visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Weight Distribution</CardTitle>
          <CardDescription>Visual allocation of metric weights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Total Weight</span>
            <span className={`text-lg font-bold ${totalWeight === 100 ? 'text-green-600' : 'text-orange-600'}`}>
              {totalWeight}%
            </span>
          </div>
          <div className="h-6 bg-secondary rounded-full overflow-hidden flex">
            {metrics.map(metric => {
              if (!metric.enabled || metric.weight === 0) return null;
              const label = METRIC_LABELS[metric.metric_id];
              return (
                <TooltipProvider key={metric.metric_id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={`${label?.color || 'bg-gray-500'} flex items-center justify-center text-xs text-white font-medium transition-all`}
                        style={{ width: `${metric.weight}%` }}
                      >
                        {metric.weight >= 10 && `${metric.weight}%`}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{label?.name}: {metric.weight}%</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
        </CardContent>
      </Card>

      {/* Actions Bar */}
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRebalance} disabled={totalWeight === 100}>
            Rebalance
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Audio Metrics */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          🎤 Audio Metrics
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {metrics.filter(m => METRIC_LABELS[m.metric_id]?.category === 'audio').map((metric) => {
            const label = METRIC_LABELS[metric.metric_id] || { name: metric.metric_id, description: '', unit: '', color: 'bg-muted', category: 'audio' };

            return (
              <Card key={metric.metric_id} className={`transition-opacity ${!metric.enabled && 'opacity-50'}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Switch
                        id={`toggle-${metric.metric_id}`}
                        checked={metric.enabled}
                        onCheckedChange={() => handleToggle(metric.metric_id)}
                      />
                      <div>
                        <CardTitle className="text-base">{label.name}</CardTitle>
                        <CardDescription className="text-xs">{label.description}</CardDescription>
                      </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${label.color}`} title="Color indicator" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Weight */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <Label>Weight</Label>
                      <span className="text-muted-foreground font-medium">{metric.weight}%</span>
                    </div>
                    <Slider
                      value={[metric.weight]}
                      onValueChange={([v]) => handleWeightChange(metric.metric_id, v)}
                      min={0}
                      max={100}
                      step={5}
                      disabled={!metric.enabled}
                    />
                  </div>

                  {/* Thresholds */}
                  {metric.enabled && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Min ({label.unit})</Label>
                        <Input
                          type="number"
                          value={metric.min_threshold}
                          onChange={(e) => handleThresholdChange(metric.metric_id, 'min_threshold', parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Ideal ({label.unit})</Label>
                        <Input
                          type="number"
                          value={metric.ideal_threshold}
                          onChange={(e) => handleThresholdChange(metric.metric_id, 'ideal_threshold', parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Max ({label.unit})</Label>
                        <Input
                          type="number"
                          value={metric.max_threshold}
                          onChange={(e) => handleThresholdChange(metric.metric_id, 'max_threshold', parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                    </div>
                  )}

                  {/* Detection Method (speechRate only) */}
                  {metric.enabled && metric.metric_id === 'speechRate' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Detection Method</Label>
                      <Select
                        value={metric.method || 'spectral-flux'}
                        onValueChange={(value) => handleMethodChange(metric.metric_id, value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="energy-peaks">Energy Peaks (Basic)</SelectItem>
                          <SelectItem value="vad-enhanced">VAD Enhanced (Better)</SelectItem>
                          <SelectItem value="spectral-flux">Spectral Flux (Best)</SelectItem>
                          <SelectItem value="web-speech-api">Web Speech API (Browser STT)</SelectItem>
                          <SelectItem value="deepgram-stt">Deepgram STT (Most Accurate)</SelectItem>
                        </SelectContent>
                      </Select>
                      {metric.method === 'web-speech-api' && (
                        <p className="text-xs text-muted-foreground">
                          Uses browser speech recognition. Works best in Chrome/Edge.
                        </p>
                      )}
                      {metric.method === 'deepgram-stt' && (
                        <p className="text-xs text-muted-foreground">
                          Uses Deepgram AI for most accurate transcription. Requires internet connection.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Video Metrics */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          📹 Video Metrics (MediaPipe)
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {metrics.filter(m => METRIC_LABELS[m.metric_id]?.category === 'video').map((metric) => {
            const label = METRIC_LABELS[metric.metric_id] || { name: metric.metric_id, description: '', unit: '', color: 'bg-muted', category: 'video' };

            return (
              <Card key={metric.metric_id} className={`transition-opacity ${!metric.enabled && 'opacity-50'}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Switch
                        id={`toggle-${metric.metric_id}`}
                        checked={metric.enabled}
                        onCheckedChange={() => handleToggle(metric.metric_id)}
                      />
                      <div>
                        <CardTitle className="text-base">{label.name}</CardTitle>
                        <CardDescription className="text-xs">{label.description}</CardDescription>
                      </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${label.color}`} title="Color indicator" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Weight */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <Label>Weight</Label>
                      <span className="text-muted-foreground font-medium">{metric.weight}%</span>
                    </div>
                    <Slider
                      value={[metric.weight]}
                      onValueChange={([v]) => handleWeightChange(metric.metric_id, v)}
                      min={0}
                      max={100}
                      step={5}
                      disabled={!metric.enabled}
                    />
                  </div>

                  {/* Thresholds */}
                  {metric.enabled && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Min ({label.unit})</Label>
                        <Input
                          type="number"
                          value={metric.min_threshold}
                          onChange={(e) => handleThresholdChange(metric.metric_id, 'min_threshold', parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Ideal ({label.unit})</Label>
                        <Input
                          type="number"
                          value={metric.ideal_threshold}
                          onChange={(e) => handleThresholdChange(metric.metric_id, 'ideal_threshold', parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Max ({label.unit})</Label>
                        <Input
                          type="number"
                          value={metric.max_threshold}
                          onChange={(e) => handleThresholdChange(metric.metric_id, 'max_threshold', parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};