import { MetricWeightDistribution } from '@/components/MetricWeightDistribution';
import { rebalanceWeights } from '@/lib/metricsUtils';
import { RotateCcw } from 'lucide-react';

// ... (existing imports)

// ... inside Settings component

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
      const defaults = adminSettings.map(s => ({
        ...s,
        id: '',
        metric_id: s.metric_id,
        enabled: s.weight > 0
      }));
      setMetrics(defaults);
      setHasChanges(true);
      toast({ title: 'Reset', description: 'Metrics reset to system defaults. Click Save to apply.' });
    }
  } catch (error) {
    console.error('Error resetting:', error);
    toast({ variant: 'destructive', title: 'Error', description: 'Failed to reset settings' });
  } finally {
    setIsLoading(false);
  }
};

// ... (existing saveSettings)

// Calculate total weight for UI
const enabledMetrics = metrics.filter(m => m.enabled);
const totalWeight = enabledMetrics.reduce((sum, m) => sum + m.weight, 0);


if (isLoading) {
  // ...
}

if (!isAllowed) {
  // ...
}

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
          // ... existing mapping
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
