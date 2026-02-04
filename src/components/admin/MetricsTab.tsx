import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Slider } from '@/components/ui/slider';

interface MetricSetting {
  id: string;
  metric_id: string;
  weight: number;
  min_threshold: number;
  ideal_threshold: number;
  max_threshold: number;
  method: string | null;
}

const DEFAULT_METRICS: Omit<MetricSetting, 'id'>[] = [
  { metric_id: 'volume', weight: 40, min_threshold: -35, ideal_threshold: -15, max_threshold: 0, method: null },
  { metric_id: 'speechRate', weight: 40, min_threshold: 90, ideal_threshold: 150, max_threshold: 220, method: 'energy-peaks' },
  { metric_id: 'acceleration', weight: 5, min_threshold: 0, ideal_threshold: 50, max_threshold: 100, method: null },
  { metric_id: 'responseTime', weight: 5, min_threshold: 2000, ideal_threshold: 200, max_threshold: 0, method: null },
  { metric_id: 'pauseManagement', weight: 10, min_threshold: 0, ideal_threshold: 0, max_threshold: 2.71, method: null },
];

const METRIC_LABELS: Record<string, { name: string; description: string; unit: string }> = {
  volume: { name: 'Energy (Volume)', description: 'Average loudness in dB', unit: 'dB' },
  speechRate: { name: 'Fluency (Speech Rate)', description: 'Words per minute', unit: 'WPM' },
  acceleration: { name: 'Dynamics (Acceleration)', description: 'Energy increase over time', unit: '%' },
  responseTime: { name: 'Readiness (Response Time)', description: 'Time before speaking', unit: 'ms' },
  pauseManagement: { name: 'Fluidity (Pauses)', description: 'Pause ratio', unit: 'ratio' },
};

export const MetricsTab = () => {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<MetricSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('metric_settings')
        .select('*');

      if (error) throw error;

      // If no settings, use defaults
      if (!data || data.length === 0) {
        setMetrics(DEFAULT_METRICS.map((m, i) => ({ ...m, id: `temp-${i}` })));
      } else {
        setMetrics(data);
      }
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Delete all existing and re-insert
      await supabase.from('metric_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      const toInsert = metrics.map(m => ({
        metric_id: m.metric_id,
        weight: m.weight,
        min_threshold: m.min_threshold,
        ideal_threshold: m.ideal_threshold,
        max_threshold: m.max_threshold,
        method: m.method,
      }));

      const { error } = await supabase.from('metric_settings').insert(toInsert);
      if (error) throw error;

      // Also update localStorage for immediate effect
      const localConfig = metrics.map(m => ({
        id: m.metric_id,
        weight: m.weight,
        thresholds: {
          min: m.min_threshold,
          ideal: m.ideal_threshold,
          max: m.max_threshold,
        },
        method: m.method,
      }));
      localStorage.setItem('metricConfig', JSON.stringify(localConfig));

      toast({ title: 'Success', description: 'Metric settings saved.' });
      await fetchMetrics();
    } catch (err: any) {
      console.error('Failed to save metrics:', err);
      toast({ title: 'Error', description: err.message || 'Failed to save settings.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setMetrics(DEFAULT_METRICS.map((m, i) => ({ ...m, id: `temp-${i}` })));
  };

  const updateMetric = (metricId: string, field: keyof MetricSetting, value: number | string | null) => {
    setMetrics(prev =>
      prev.map(m => m.metric_id === metricId ? { ...m, [field]: value } : m)
    );
  };

  // Calculate total weight for validation
  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Total weight: <span className={totalWeight === 100 ? 'text-green-500' : 'text-destructive'}>{totalWeight}%</span>
          {totalWeight !== 100 && <span className="ml-2">(should equal 100%)</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Defaults
          </Button>
          <Button onClick={handleSave} disabled={isSaving || totalWeight !== 100}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {metrics.map((metric) => {
          const label = METRIC_LABELS[metric.metric_id] || { name: metric.metric_id, description: '', unit: '' };

          return (
            <Card key={metric.metric_id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{label.name}</CardTitle>
                <CardDescription className="text-xs">{label.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Weight */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>Weight</Label>
                    <span className="text-muted-foreground">{metric.weight}%</span>
                  </div>
                  <Slider
                    value={[metric.weight]}
                    onValueChange={([v]) => updateMetric(metric.metric_id, 'weight', v)}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>

                {/* Thresholds */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Min ({label.unit})</Label>
                    <Input
                      type="number"
                      value={metric.min_threshold}
                      onChange={(e) => updateMetric(metric.metric_id, 'min_threshold', parseFloat(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ideal ({label.unit})</Label>
                    <Input
                      type="number"
                      value={metric.ideal_threshold}
                      onChange={(e) => updateMetric(metric.metric_id, 'ideal_threshold', parseFloat(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Max ({label.unit})</Label>
                    <Input
                      type="number"
                      value={metric.max_threshold}
                      onChange={(e) => updateMetric(metric.metric_id, 'max_threshold', parseFloat(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
