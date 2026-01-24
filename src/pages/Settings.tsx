import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, RotateCcw, Sliders } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MetricSetting {
  id: string;
  metric_id: string;
  weight: number;
  min_threshold: number;
  ideal_threshold: number;
  max_threshold: number;
  method: string | null;
}

const METRIC_INFO: Record<string, { label: string; description: string; icon: string }> = {
  volume: {
    label: 'Volume / Energy',
    description: 'How loud and energetic your voice is',
    icon: '🔊',
  },
  speechRate: {
    label: 'Speech Rate',
    description: 'Words per minute - fluency of speech',
    icon: '🗣️',
  },
  acceleration: {
    label: 'Acceleration',
    description: 'Dynamic changes in volume and pace',
    icon: '📈',
  },
  responseTime: {
    label: 'Response Time',
    description: 'How quickly you start speaking',
    icon: '⚡',
  },
  pauseManagement: {
    label: 'Pause Management',
    description: 'Balance of speech and silence',
    icon: '⏸️',
  },
};

const Settings = () => {
  const [settings, setSettings] = useState<MetricSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('metric_settings')
        .select('*')
        .order('metric_id');

      if (error) throw error;

      setSettings(data || []);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const updateWeight = (metricId: string, newWeight: number) => {
    setSettings(prev =>
      prev.map(s =>
        s.metric_id === metricId ? { ...s, weight: newWeight } : s
      )
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Validate total weight equals 100
      const totalWeight = settings.reduce((sum, s) => sum + s.weight, 0);
      if (totalWeight !== 100) {
        toast.error(`Total weights must equal 100% (currently ${totalWeight}%)`);
        return;
      }

      // Update each setting
      for (const setting of settings) {
        const { error } = await supabase
          .from('metric_settings')
          .update({ weight: setting.weight, updated_at: new Date().toISOString() })
          .eq('id', setting.id);

        if (error) throw error;
      }

      // Also save to localStorage for the analysis logic
      const configForAnalysis = settings.map(s => ({
        id: s.metric_id,
        weight: s.weight,
        thresholds: {
          min: s.min_threshold,
          ideal: s.ideal_threshold,
          max: s.max_threshold,
        },
        method: s.method || undefined,
      }));
      localStorage.setItem('metricConfig', JSON.stringify(configForAnalysis));

      toast.success('Settings saved successfully!');
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    const defaults = [
      { metric_id: 'volume', weight: 40 },
      { metric_id: 'speechRate', weight: 40 },
      { metric_id: 'acceleration', weight: 5 },
      { metric_id: 'responseTime', weight: 5 },
      { metric_id: 'pauseManagement', weight: 10 },
    ];

    setSettings(prev =>
      prev.map(s => {
        const def = defaults.find(d => d.metric_id === s.metric_id);
        return def ? { ...s, weight: def.weight } : s;
      })
    );
    setHasChanges(true);
    toast.info('Weights reset to defaults. Click Save to apply.');
  };

  const totalWeight = settings.reduce((sum, s) => sum + s.weight, 0);
  const isValid = totalWeight === 100;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Sliders className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Settings</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6">
        {/* Weight Summary */}
        <motion.div
          className={`mb-6 p-4 rounded-xl border ${
            isValid ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'
          }`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Weight</span>
            <span className={`text-2xl font-bold ${isValid ? 'text-primary' : 'text-destructive'}`}>
              {totalWeight}%
            </span>
          </div>
          {!isValid && (
            <p className="text-xs text-destructive mt-2">
              Weights must add up to exactly 100%
            </p>
          )}
        </motion.div>

        {/* Metric Settings */}
        <div className="space-y-4">
          {settings.map((setting, index) => {
            const info = METRIC_INFO[setting.metric_id] || {
              label: setting.metric_id,
              description: '',
              icon: '📊',
            };

            return (
              <motion.div
                key={setting.id}
                className="p-4 rounded-xl border border-border bg-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{info.icon}</span>
                    <div>
                      <h3 className="font-medium text-foreground">{info.label}</h3>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-primary">{setting.weight}%</span>
                </div>

                <Slider
                  value={[setting.weight]}
                  onValueChange={([value]) => updateWeight(setting.metric_id, value)}
                  max={100}
                  min={0}
                  step={5}
                  className="mt-2"
                />

                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <motion.div
          className="flex gap-3 mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleReset}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleSave}
            disabled={!hasChanges || !isValid || isSaving}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </motion.div>

        {/* Info */}
        <p className="text-xs text-muted-foreground text-center mt-6">
          Adjust the weight of each metric to customize how your speaking energy is scored.
          Higher weight means that metric has more impact on your final score.
        </p>
      </main>
    </div>
  );
};

export default Settings;
