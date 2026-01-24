import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, RotateCcw, Sliders, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

const METRIC_INFO: Record<string, { 
  label: string; 
  description: string; 
  icon: string;
  unit: string;
  thresholdLabels: { min: string; ideal: string; max: string };
}> = {
  volume: {
    label: 'Volume / Energy',
    description: 'How loud and energetic your voice is',
    icon: '🔊',
    unit: 'dB',
    thresholdLabels: { min: 'Too Quiet', ideal: 'Perfect', max: 'Too Loud' },
  },
  speechRate: {
    label: 'Speech Rate',
    description: 'Words per minute - fluency of speech',
    icon: '🗣️',
    unit: 'WPM',
    thresholdLabels: { min: 'Too Slow', ideal: 'Perfect', max: 'Too Fast' },
  },
  acceleration: {
    label: 'Acceleration',
    description: 'Dynamic changes in volume and pace',
    icon: '📈',
    unit: '%',
    thresholdLabels: { min: 'Min Change', ideal: 'Ideal Change', max: 'Max Change' },
  },
  responseTime: {
    label: 'Response Time',
    description: 'How quickly you start speaking',
    icon: '⚡',
    unit: 'ms',
    thresholdLabels: { min: 'Too Slow', ideal: 'Perfect', max: 'Instant' },
  },
  pauseManagement: {
    label: 'Pause Management',
    description: 'Balance of speech and silence',
    icon: '⏸️',
    unit: 'ratio',
    thresholdLabels: { min: 'Min Pause', ideal: 'Ideal', max: 'Max Pause' },
  },
};

const DEFAULT_SETTINGS: Record<string, { weight: number; min: number; ideal: number; max: number }> = {
  volume: { weight: 40, min: -35, ideal: -15, max: 0 },
  speechRate: { weight: 40, min: 90, ideal: 150, max: 220 },
  acceleration: { weight: 5, min: 0, ideal: 50, max: 100 },
  responseTime: { weight: 5, min: 2000, ideal: 200, max: 0 },
  pauseManagement: { weight: 10, min: 0, ideal: 0, max: 2.71 },
};

const Settings = () => {
  const [settings, setSettings] = useState<MetricSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());

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

  const toggleExpanded = (metricId: string) => {
    setExpandedMetrics(prev => {
      const next = new Set(prev);
      if (next.has(metricId)) {
        next.delete(metricId);
      } else {
        next.add(metricId);
      }
      return next;
    });
  };

  const updateSetting = (metricId: string, field: keyof MetricSetting, value: number) => {
    setSettings(prev =>
      prev.map(s =>
        s.metric_id === metricId ? { ...s, [field]: value } : s
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
          .update({ 
            weight: setting.weight,
            min_threshold: setting.min_threshold,
            ideal_threshold: setting.ideal_threshold,
            max_threshold: setting.max_threshold,
            updated_at: new Date().toISOString() 
          })
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
    setSettings(prev =>
      prev.map(s => {
        const def = DEFAULT_SETTINGS[s.metric_id];
        return def ? { 
          ...s, 
          weight: def.weight,
          min_threshold: def.min,
          ideal_threshold: def.ideal,
          max_threshold: def.max,
        } : s;
      })
    );
    setHasChanges(true);
    toast.info('Settings reset to defaults. Click Save to apply.');
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
              unit: '',
              thresholdLabels: { min: 'Min', ideal: 'Ideal', max: 'Max' },
            };
            const isExpanded = expandedMetrics.has(setting.metric_id);

            return (
              <motion.div
                key={setting.id}
                className="rounded-xl border border-border bg-card overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                {/* Main Weight Section */}
                <div className="p-4">
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

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Weight</Label>
                    <Slider
                      value={[setting.weight]}
                      onValueChange={([value]) => updateSetting(setting.metric_id, 'weight', value)}
                      max={100}
                      min={0}
                      step={5}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                {/* Expandable Thresholds Section */}
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(setting.metric_id)}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full px-4 py-2 flex items-center justify-between text-sm text-muted-foreground hover:bg-muted/50 transition-colors border-t border-border">
                      <span>Threshold Settings</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-2 space-y-4 bg-muted/20">
                      {/* Min Threshold */}
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center justify-between">
                          <span>{info.thresholdLabels.min}</span>
                          <span className="text-muted-foreground">{info.unit}</span>
                        </Label>
                        <Input
                          type="number"
                          step="any"
                          value={setting.min_threshold}
                          onChange={(e) => updateSetting(setting.metric_id, 'min_threshold', parseFloat(e.target.value) || 0)}
                          className="h-9"
                        />
                      </div>

                      {/* Ideal Threshold */}
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center justify-between">
                          <span>{info.thresholdLabels.ideal}</span>
                          <span className="text-muted-foreground">{info.unit}</span>
                        </Label>
                        <Input
                          type="number"
                          step="any"
                          value={setting.ideal_threshold}
                          onChange={(e) => updateSetting(setting.metric_id, 'ideal_threshold', parseFloat(e.target.value) || 0)}
                          className="h-9"
                        />
                      </div>

                      {/* Max Threshold */}
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center justify-between">
                          <span>{info.thresholdLabels.max}</span>
                          <span className="text-muted-foreground">{info.unit}</span>
                        </Label>
                        <Input
                          type="number"
                          step="any"
                          value={setting.max_threshold}
                          onChange={(e) => updateSetting(setting.metric_id, 'max_threshold', parseFloat(e.target.value) || 0)}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
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
          Adjust weights to customize scoring impact. Expand each metric to fine-tune thresholds for more precise analysis.
        </p>
      </main>
    </div>
  );
};

export default Settings;
