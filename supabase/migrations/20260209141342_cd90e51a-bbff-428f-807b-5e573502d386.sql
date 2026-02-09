
-- Fix search_path for get_user_practice_stats
CREATE OR REPLACE FUNCTION get_user_practice_stats(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
