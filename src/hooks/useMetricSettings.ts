import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useMetricSettings = () => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const syncSettings = async () => {
            try {
                const stored = localStorage.getItem('metricConfig');
                if (stored) {
                    setIsLoading(false);
                    return;
                }

                console.log('🔄 [useMetricSettings] Syncing metric settings...');

                // 1. Check if user customization is allowed
                const { data: appSettings } = await (supabase as any)
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'allow_user_metrics_customization')
                    .single();

                const allowCustomization = appSettings?.value === true;

                // 2. Try to get user settings if allowed
                let settingsToCache = null;

                if (allowCustomization) {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { data: userSettings } = await (supabase as any)
                            .from('user_metric_settings')
                            .select('*')
                            .eq('user_id', user.id);

                        if (userSettings && userSettings.length > 0) {
                            settingsToCache = userSettings.map((s: any) => ({
                                id: s.metric_id,
                                weight: s.weight,
                                thresholds: {
                                    min: s.min_threshold,
                                    ideal: s.ideal_threshold,
                                    max: s.max_threshold,
                                },
                                method: s.method,
                                enabled: s.weight > 0
                            }));
                            console.log('✅ [useMetricSettings] Loaded user settings');
                        }
                    }
                }

                // 3. Fallback to admin settings
                if (!settingsToCache) {
                    const { data: adminSettings } = await supabase
                        .from('metric_settings')
                        .select('*');

                    if (adminSettings && adminSettings.length > 0) {
                        settingsToCache = adminSettings.map(s => ({
                            id: s.metric_id,
                            weight: s.weight,
                            thresholds: {
                                min: s.min_threshold,
                                ideal: s.ideal_threshold,
                                max: s.max_threshold,
                            },
                            method: s.method,
                            enabled: s.weight > 0
                        }));
                        console.log('✅ [useMetricSettings] Loaded admin settings');
                    }
                }

                // 4. Save to localStorage
                if (settingsToCache) {
                    localStorage.setItem('metricConfig', JSON.stringify(settingsToCache));
                    console.log('💾 [useMetricSettings] Saved to localStorage');
                }

            } catch (error) {
                console.error('❌ [useMetricSettings] Failed to sync settings:', error);
            } finally {
                setIsLoading(false);
            }
        };

        syncSettings();
    }, []);

    return { isLoading };
};
