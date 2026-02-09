
-- Migration 1: Add missing metric columns to practice_results
ALTER TABLE practice_results
  ADD COLUMN IF NOT EXISTS acceleration_score numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS response_time_score numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS response_time_ms numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS words_per_minute numeric DEFAULT NULL;

COMMENT ON COLUMN practice_results.acceleration_score IS 'Energy boost/dynamics score (0-100)';
COMMENT ON COLUMN practice_results.response_time_score IS 'Response readiness score (0-100)';
COMMENT ON COLUMN practice_results.response_time_ms IS 'Raw time to first speech in milliseconds';
COMMENT ON COLUMN practice_results.words_per_minute IS 'Raw speech rate in words per minute';

-- Migration 2: Server-side stats aggregation RPC
CREATE OR REPLACE FUNCTION get_user_practice_stats(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'total_sessions', COUNT(*)::int,
    'avg_score', ROUND(AVG(score))::int,
    'best_score', MAX(score)::int,
    'total_practice_seconds', ROUND(SUM(duration_seconds))::int,
    'first_session_at', MIN(created_at),
    'last_session_at', MAX(created_at),
    'avg_energy', ROUND(AVG(energy_score))::int,
    'avg_clarity', ROUND(AVG(clarity_score))::int,
    'avg_pace', ROUND(AVG(pace_score))::int,
    'avg_acceleration', ROUND(AVG(acceleration_score))::int,
    'avg_response_time', ROUND(AVG(response_time_score))::int
  )
  FROM practice_results
  WHERE user_id = p_user_id;
$$;
