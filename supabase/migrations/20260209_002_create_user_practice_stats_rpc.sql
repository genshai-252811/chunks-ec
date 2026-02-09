-- Migration: Create server-side stats aggregation function
-- Date: 2026-02-09
-- Purpose: Progress page was computing stats client-side from a capped 100-row fetch,
--          giving wrong results for users with >100 sessions. This RPC aggregates
--          across ALL rows server-side.

CREATE OR REPLACE FUNCTION get_user_practice_stats(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'total_sessions', COUNT(*)::int,
    'avg_score', COALESCE(ROUND(AVG(score))::int, 0),
    'best_score', COALESCE(MAX(score)::int, 0),
    'total_practice_seconds', COALESCE(ROUND(SUM(duration_seconds))::int, 0),
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
