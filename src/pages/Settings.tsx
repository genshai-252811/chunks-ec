import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Save, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface MetricSetting {
  id: string; // This is actually the UUID of the row
  metric_id: string;
  weight: number;
  min_threshold: number;
  ideal_threshold: number;
  max_threshold: number;
  method: string | null;
  enabled: boolean;
}

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
        const mappedSettings = userSettings.map(s => ({
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
          const defaults = adminSettings.map(s => ({
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

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Normalize weights
      const totalWeight = metrics
        .filter(m => m.enabled)
        .reduce((sum, m) => sum + m.weight, 0);

      const normalizedMetrics = metrics.map(m => ({
        ...m,
        // If disabled, saved weight should be 0 effectively for logic, but we might want to preserve the UI weight?
        // Actually, existing logic often treats weight=0 as disabled.
        // Let's save the actual weight but if disabled maybe we don't zero it in DB?
        // The table has 'enabled' column.
        weight: m.weight, // Save the weight as is
        enabled: m.enabled
      }));


      // Upsert into user_metric_settings
      // We need to upsert by (user_id, metric_id)
      const updates = normalizedMetrics.map(m => ({
        user_id: user.id,
        metric_id: m.metric_id,
        weight: m.weight,
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
      // The logic in ResultsView loads from localStorage 'metricConfig'
      // We should update 'metricConfig' with USER settings now

      const localConfig = normalizedMetrics.map(m => ({
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Metrics Settings</h1>
              <p className="text-muted-foreground">Customize how your speech is scored.</p>
            </div>
          </div>

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

        <div className="grid gap-6 md:grid-cols-2">
          {metrics.map((metric, index) => {
            const label = METRIC_LABELS[metric.metric_id];
            if (!label) return null;

            return (
              <Card key={metric.metric_id} className={`overflow-hidden transition-all ${metric.enabled ? '' : 'opacity-70 grayscale'}`}>
                <div className={`h-1 w-full ${metric.enabled ? label.color.replace('bg-', 'bg-opacity-80 bg-') : 'bg-gray-200'}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {label.name}
                    </CardTitle>
                    <Switch
                      checked={metric.enabled}
                      onCheckedChange={(checked) => toggleMetric(index, checked)}
                    />
                  </div>
                  <CardDescription>{label.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <label className="font-medium">Impact Weight</label>
                        <span className="text-muted-foreground">{metric.weight} points</span>
                      </div>
                      <Slider
                        value={[metric.weight]}
                        min={0}
                        max={100}
                        step={5}
                        disabled={!metric.enabled}
                        onValueChange={(val) => handleWeightChange(index, val[0])}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
