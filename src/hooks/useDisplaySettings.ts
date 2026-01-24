import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DisplayThresholds {
  quiet: number;
  good: number;
  powerful: number;
}

const DEFAULT_THRESHOLDS: DisplayThresholds = {
  quiet: 0.3,
  good: 0.6,
  powerful: 0.8,
};

const STORAGE_KEY = 'display_settings';

export function useDisplaySettings() {
  const [thresholds, setThresholds] = useState<DisplayThresholds>(DEFAULT_THRESHOLDS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // First try localStorage for instant access
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setThresholds({
          quiet: parsed.quiet_threshold ?? DEFAULT_THRESHOLDS.quiet,
          good: parsed.good_threshold ?? DEFAULT_THRESHOLDS.good,
          powerful: parsed.powerful_threshold ?? DEFAULT_THRESHOLDS.powerful,
        });
      } catch (e) {
        console.error('Failed to parse display settings from localStorage:', e);
      }
    }

    // Then fetch from database for latest values
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('display_settings')
          .select('*')
          .eq('setting_key', 'energy_display')
          .single();

        if (error) {
          console.error('Failed to fetch display settings:', error);
          return;
        }

        if (data) {
          const newThresholds = {
            quiet: Number(data.quiet_threshold),
            good: Number(data.good_threshold),
            powerful: Number(data.powerful_threshold),
          };
          setThresholds(newThresholds);
          
          // Update localStorage for next time
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            quiet_threshold: newThresholds.quiet,
            good_threshold: newThresholds.good,
            powerful_threshold: newThresholds.powerful,
          }));
        }
      } catch (e) {
        console.error('Error fetching display settings:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { thresholds, isLoading };
}

// Simpler hook for components that just need thresholds synchronously
export function getDisplayThresholds(): DisplayThresholds {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        quiet: parsed.quiet_threshold ?? DEFAULT_THRESHOLDS.quiet,
        good: parsed.good_threshold ?? DEFAULT_THRESHOLDS.good,
        powerful: parsed.powerful_threshold ?? DEFAULT_THRESHOLDS.powerful,
      };
    } catch (e) {
      console.error('Failed to parse display settings:', e);
    }
  }
  return DEFAULT_THRESHOLDS;
}
