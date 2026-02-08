import { MetricSetting } from '@/components/MetricSettingsCard';

export const rebalanceWeights = (currentMetrics: MetricSetting[]): MetricSetting[] => {
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
