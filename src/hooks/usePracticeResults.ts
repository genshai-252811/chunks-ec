import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnalysisResult } from '@/lib/audioAnalysis';

export interface PracticeResult {
  id: string;
  user_id: string;
  sentence_id: string | null;
  score: number;
  duration_seconds: number;
  energy_score: number | null;
  clarity_score: number | null;
  pace_score: number | null;
  volume_avg: number | null;
  speech_ratio: number | null;
  created_at: string;
}

export function usePracticeResults() {
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveResult = useCallback(async (
    analysisResult: AnalysisResult,
    sentenceId: string | null,
    durationSeconds: number
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
        volume_avg: analysisResult.volume?.averageDb ?? null,
        speech_ratio: analysisResult.pauses?.pauseRatio ?? null,
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

    const { data, error: fetchError } = await supabase
      .from('practice_results')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fetchError) {
      console.error('Failed to fetch practice results:', fetchError);
      setError(fetchError.message);
    } else {
      setResults(data || []);
    }

    setIsLoading(false);
    return { data, error: fetchError };
  }, []);

  const getStats = useCallback(() => {
    if (results.length === 0) return null;

    const totalSessions = results.length;
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / totalSessions;
    const bestScore = Math.max(...results.map(r => r.score));
    const totalPracticeTime = results.reduce((sum, r) => sum + Number(r.duration_seconds), 0);

    return {
      totalSessions,
      avgScore: Math.round(avgScore),
      bestScore,
      totalPracticeTime: Math.round(totalPracticeTime),
    };
  }, [results]);

  return {
    results,
    isLoading,
    error,
    saveResult,
    fetchResults,
    getStats,
  };
}
