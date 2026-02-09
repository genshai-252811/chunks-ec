import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Save, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MetricSettingsCard, MetricSetting } from '@/components/MetricSettingsCard';
import { MetricWeightDistribution } from '@/components/MetricWeightDistribution';
import { CalibrationWizard } from '@/components/CalibrationWizard';
import { CalibrationTest } from '@/components/CalibrationTest';
import { rebalanceWeights } from '@/lib/metricsUtils';

const METRIC_LABELS: Record<string, { name: string; description: string; unit: string; color: string; category: 'audio' | 'video' }> = {
  // Audio metrics
  volume: { name: 'Energy (Volume)', description: 'Average loudness in dB', unit: 'dB', color: 'bg-blue-500', category: 'audio' },
  speechRate: { name: 'Pace (Speech Rate)', description: 'Speed in words per minute', unit: 'WPM', color: 'bg-green-500', category: 'audio' },
  acceleration: { name: 'Tonality (Acceleration)', description: 'Variation in speed and volume', unit: 'Score', color: 'bg-purple-500', category: 'audio' },
  responseTime: { name: 'Response Time', description: 'Time to start speaking', unit: 'ms', color: 'bg-yellow-500', category: 'audio' },
  pauseManagement: { name: 'Filler Words (Pauses)', description: 'Effective use of pauses', unit: 'Ratio', color: 'bg-orange-500', category: 'audio' },
  // Video-based metrics
  eyeContact: { name: 'Eye Contact', description: 'Maintaining eye contact', unit: '%', color: 'bg-cyan-500', category: 'video' },
  handMovement: { name: 'Hand Gestures', description: 'Use of hand movements', unit: 'Score', color: 'bg-pink-500', category: 'video' },
  blinkRate: { name: 'Blink Rate', description: 'Natural blink frequency', unit: 'bpm', color: 'bg-indigo-500', category: 'video' },
};

export default function Settings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);
  const [metrics, setMetrics] = useState<MetricSetting[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Check if customization is allowed
      const { data: appSettings, error: appSettingsError } = await (supabase as any)
        .from('app_settings')
        .select('value')
        .eq('key', 'allow_user_metrics_customization')
        .single();

      const allowed = appSettings?.value === true;
      setIsAllowed(allowed);

      if (!allowed) {
        setIsLoading(false);
        return;
      }

      // 2. Fetch user's existing settings
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Error', description: 'You must be logged in.' });
        return;
      }

      const { data: userSettings, error: userSettingsError } = await (supabase as any)
        .from('user_metric_settings')
        .select('*')
        .eq('user_id', user.id);

      if (userSettingsError) throw userSettingsError;

      // 3. If user has settings, load them. Else load global defaults to start with.
      if (userSettings && userSettings.length > 0) {
        // Map to our state structure
        const mappedSettings = userSettings.map((s: any) => ({
          ...s,
          enabled: s.weight > 0 // Logic: if weight > 0, it's enabled
        }));
        setMetrics(mappedSettings);
        console.log('Loaded user custom settings:', mappedSettings);
      } else {
        // Load defaults from valid metric_settings (admin config)
        const { data: adminSettings, error: adminError } = await supabase
          .from('metric_settings')
          .select('*');

        if (adminError) throw adminError;

        if (adminSettings) {
          const defaults = adminSettings.map((s: any) => ({
            ...s,
            id: '', // New rows will be created
            metric_id: s.metric_id, // Ensure metric_id is preserved
            enabled: s.weight > 0
          }));
          setMetrics(defaults);
          console.log('Loaded admin settings as defaults:', defaults);
        }
      }

    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error loading settings',
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleWeightChange = (index: number, newWeight: number) => {
    const updated = [...metrics];
    updated[index].weight = newWeight;
    setMetrics(updated);
    setHasChanges(true);
  };

  const toggleMetric = (index: number, enabled: boolean) => {
    const updated = [...metrics];
    updated[index].enabled = enabled;
    // If enabling, restore weight if it was 0, or keep 0 if it was manually set to 0?
    // Let's set a default small weight if it was 0 when enabling
    if (enabled && updated[index].weight === 0) {
      updated[index].weight = 10;
    }
    setMetrics(updated);
    setHasChanges(true);
  };

  const handleThresholdChange = (index: number, field: 'min' | 'ideal' | 'max', value: number) => {
    const updated = [...metrics];
    const fieldMap = {
      min: 'min_threshold',
      ideal: 'ideal_threshold',
      max: 'max_threshold'
    };
    (updated[index] as any)[fieldMap[field]] = value;
    setMetrics(updated);
    setHasChanges(true);
  };

  const handleMethodChange = (index: number, method: string) => {
    const updated = [...metrics];
    updated[index].method = method;
    setMetrics(updated);
    setHasChanges(true);
  };

  const handleRebalance = () => {
    setMetrics(prev => rebalanceWeights(prev));
    setHasChanges(true);
  };

  const handleReset = async () => {
    setIsLoading(true);
    try {
      // Fetch global defaults from metric_settings
      const { data: adminSettings, error: adminError } = await supabase
        .from('metric_settings')
        .select('*');

      if (adminError) throw adminError;

      if (adminSettings) {
        const defaults = adminSettings.map((s: any) => ({
          ...s,
          id: '',
          metric_id: s.metric_id,
          enabled: s.weight > 0
        }));
        setMetrics(defaults);
        setHasChanges(true);
        toast({ title: 'Reset', description: 'Metrics reset to system defaults. Click Save to apply.' });
      }
    } catch (error: any) {
      console.error('Error resetting:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to reset settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Auto-rebalance weights to 100% before saving
      const rebalanced = rebalanceWeights(metrics);
      setMetrics(rebalanced);

      // Upsert into user_metric_settings
      const updates = rebalanced.map(m => ({
        user_id: user.id,
        metric_id: m.metric_id,
        weight: m.enabled ? m.weight : 0,
        enabled: m.enabled,
        min_threshold: m.min_threshold,
        ideal_threshold: m.ideal_threshold,
        max_threshold: m.max_threshold,
        method: m.method
      }));

      const { error } = await (supabase as any)
        .from('user_metric_settings')
        .upsert(updates, { onConflict: 'user_id,metric_id' });

      if (error) throw error;

      // Update localStorage to reflect new user settings immediately
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
      localStorage.setItem('metricConfig', JSON.stringify(localConfig));
      console.log('💾 Saved user settings to localStorage metricConfig');

      toast({ title: 'Success', description: 'Settings saved successfully.' });
      setHasChanges(false);
      // Re-fetch to get IDs
      fetchSettings();

    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error saving settings',
        description: error.message
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Settings Locked</h1>
        <p className="text-muted-foreground mb-4">Metrics customization is currently managed by administrators.</p>
        <Button onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // Calculate total weight for UI
  const enabledMetrics = metrics.filter(m => m.enabled);
  const totalWeight = enabledMetrics.reduce((sum, m) => sum + m.weight, 0);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Metrics Settings</h1>
              <p className="text-muted-foreground">Customize your personal speech scoring model.</p>
            </div>
          </div>
          {/* Top Save Action is redundant if we have bottom actions, but good for mobile? 
                Actually, let's keep the main actions near the visualization like Admin panel 
            */}
        </div>

        {/* Device Calibration */}
        <CalibrationWizard />

        {/* Test Calibration */}
        <CalibrationTest />

        {/* Weight Distribution Visualization */}
        <MetricWeightDistribution metrics={metrics} metricLabels={METRIC_LABELS} />

        {/* Actions Bar */}
        <div className="flex flex-wrap gap-2 justify-between items-center bg-muted/30 p-4 rounded-lg border">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRebalance} disabled={totalWeight === 100}>
              Rebalance Weights
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground hover:text-foreground">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Defaults
            </Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveSettings} disabled={!hasChanges || isSaving}>
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
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {metrics.map((metric, index) => {
            const label = METRIC_LABELS[metric.metric_id];
            if (!label) return null;

            return (
              <MetricSettingsCard
                key={metric.metric_id}
                metric={metric}
                label={label}
                onToggle={(id, checked) => toggleMetric(index, checked)}
                onWeightChange={(id, val) => handleWeightChange(index, val)}
                onThresholdChange={(id, field, val) => handleThresholdChange(index, field, val)}
                onMethodChange={(id, method) => handleMethodChange(index, method)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
