import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnalysisResult } from '@/lib/audioAnalysis';
import { FaceTrackingMetrics } from '@/hooks/useFaceTracking';

export interface PracticeResult {
  id: string;
  user_id: string;
  sentence_id: string | null;
  score: number;
  duration_seconds: number;
  energy_score: number | null;
  clarity_score: number | null;
  pace_score: number | null;
  acceleration_score: number | null;
  response_time_score: number | null;
  volume_avg: number | null;
  speech_ratio: number | null;
  response_time_ms: number | null;
  words_per_minute: number | null;
  eye_contact_score: number | null;
  hand_movement_score: number | null;
  blink_rate: number | null;
  created_at: string;
  // Joined from sentences table
  sentence_category: string | null;
  sentence_english: string | null;
}

export interface VideoMetrics {
  eyeContactScore?: number;
  handMovementScore?: number;
  blinkRate?: number;
}

export interface UserStats {
  totalSessions: number;
  avgScore: number;
  bestScore: number;
  totalPracticeSeconds: number;
  firstSessionAt: string | null;
  lastSessionAt: string | null;
  avgEnergy: number | null;
  avgClarity: number | null;
  avgPace: number | null;
  avgAcceleration: number | null;
  avgResponseTime: number | null;
}

export function usePracticeResults() {
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveResult = useCallback(async (
    analysisResult: AnalysisResult,
    sentenceId: string | null,
    durationSeconds: number,
    videoMetrics?: VideoMetrics
  ) => {
    setError(null);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No user logged in, skipping result save');
      return { data: null, error: null };
    }

    const { data, error: insertError } = await supabase
      .from('practice_results')
      .insert({
        user_id: user.id,
        sentence_id: sentenceId,
        score: Math.round(analysisResult.overallScore),
        duration_seconds: durationSeconds,
        energy_score: analysisResult.volume?.score ?? null,
        clarity_score: analysisResult.speechRate?.score ?? null,
        pace_score: analysisResult.pauses?.score ?? null,
        acceleration_score: analysisResult.acceleration?.score ?? null,
        response_time_score: analysisResult.responseTime?.score ?? null,
        volume_avg: analysisResult.volume?.averageDb ?? null,
        speech_ratio: analysisResult.pauses?.pauseRatio ?? null,
        response_time_ms: analysisResult.responseTime?.responseTimeMs ?? null,
        words_per_minute: analysisResult.speechRate?.wordsPerMinute ?? null,
        eye_contact_score: videoMetrics?.eyeContactScore ?? null,
        hand_movement_score: videoMetrics?.handMovementScore ?? null,
        blink_rate: videoMetrics?.blinkRate ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to save practice result:', insertError);
      setError(insertError.message);
      return { data: null, error: insertError };
    }

    return { data, error: null };
  }, []);

  const fetchResults = useCallback(async (limit = 20) => {
    setIsLoading(true);
    setError(null);

    // Join with sentences table to get category and english text
    const { data, error: fetchError } = await supabase
      .from('practice_results')
      .select('*, sentences(category, english)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fetchError) {
      console.error('Failed to fetch practice results:', fetchError);
      setError(fetchError.message);
    } else {
      // Flatten the joined sentence data into the result
      const mapped: PracticeResult[] = (data || []).map((row: any) => ({
        ...row,
        sentence_category: row.sentences?.category ?? null,
        sentence_english: row.sentences?.english ?? null,
        sentences: undefined, // Remove nested object
      }));
      setResults(mapped);
    }

    setIsLoading(false);
    return { data, error: fetchError };
  }, []);

  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoadingStats(false);
      return null;
    }

    const { data, error: rpcError } = await supabase
      .rpc('get_user_practice_stats', { p_user_id: user.id });

    if (rpcError) {
      console.error('Failed to fetch user stats:', rpcError);
      setIsLoadingStats(false);
      return null;
    }

    const raw = data as any;
    const userStats: UserStats = {
      totalSessions: raw?.total_sessions ?? 0,
      avgScore: raw?.avg_score ?? 0,
      bestScore: raw?.best_score ?? 0,
      totalPracticeSeconds: raw?.total_practice_seconds ?? 0,
      firstSessionAt: raw?.first_session_at ?? null,
      lastSessionAt: raw?.last_session_at ?? null,
      avgEnergy: raw?.avg_energy ?? null,
      avgClarity: raw?.avg_clarity ?? null,
      avgPace: raw?.avg_pace ?? null,
      avgAcceleration: raw?.avg_acceleration ?? null,
      avgResponseTime: raw?.avg_response_time ?? null,
    };

    setStats(userStats);
    setIsLoadingStats(false);
    return userStats;
  }, []);

  return {
    results,
    isLoading,
    isLoadingStats,
    error,
    stats,
    saveResult,
    fetchResults,
    fetchStats,
  };
}
