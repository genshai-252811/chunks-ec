/**
 * Utility functions for checking metric configurations
 */

export interface MetricConfigItem {
    id: string;
    weight: number;
    enabled: boolean;
    thresholds?: {
        min: number;
        ideal: number;
        max: number;
    };
    method?: string;
}

// Video metric IDs
const VIDEO_METRIC_IDS = ['eyeContact', 'handMovement', 'blinkRate'];

/**
 * Get all metric configurations from localStorage
 */
function getMetricConfig(): MetricConfigItem[] {
    try {
        const stored = localStorage.getItem('metricConfig');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.warn('Failed to parse metricConfig from localStorage:', error);
    }
    return [];
}

/**
 * Check if a specific metric is enabled
 * A metric is considered enabled if it has enabled: true AND weight > 0
 */
export function isMetricEnabled(metricId: string): boolean {
    const config = getMetricConfig();
    const metric = config.find(m => m.id === metricId);

    if (!metric) {
        return false;
    }

    return metric.enabled === true && metric.weight > 0;
}

/**
 * Check if any video metrics are enabled
 * Returns true if at least one video metric (eyeContact, handMovement, blinkRate) is enabled
 */
export function areVideoMetricsEnabled(): boolean {
    const hasEnabled = VIDEO_METRIC_IDS.some(metricId => isMetricEnabled(metricId));

    console.log('🎥 [metricUtils] Video metrics enabled check:', {
        eyeContact: isMetricEnabled('eyeContact'),
        handMovement: isMetricEnabled('handMovement'),
        blinkRate: isMetricEnabled('blinkRate'),
        anyEnabled: hasEnabled
    });

    return hasEnabled;
}

/**
 * Get all enabled video metric IDs
 */
export function getEnabledVideoMetrics(): string[] {
    return VIDEO_METRIC_IDS.filter(metricId => isMetricEnabled(metricId));
}
