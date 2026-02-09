-- Migration: Create admin-facing learner stats aggregation functions
-- Date: 2026-02-09
-- Purpose: Admin needs to see per-learner practice counts, avg scores, and last active dates.
--          Also need a function to fetch a specific learner's recent results for the detail view.

-- 1. Bulk stats for all learners (used by LearnersTab to show summary per learner)
CREATE OR REPLACE FUNCTION get_all_learner_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(json_agg(row_data), '[]'::json)
  FROM (
    SELECT
      p.user_id,
      COUNT(pr.id)::int AS total_sessions,
      COALESCE(ROUND(AVG(pr.score))::int, 0) AS avg_score,
      COALESCE(MAX(pr.score)::int, 0) AS best_score,
      COALESCE(ROUND(SUM(pr.duration_seconds))::int, 0) AS total_practice_seconds,
      MAX(pr.created_at) AS last_session_at
    FROM profiles p
    LEFT JOIN practice_results pr ON pr.user_id = p.user_id
    GROUP BY p.user_id
  ) row_data;
$$;

-- 2. Detailed stats for a specific learner (reuses existing get_user_practice_stats for score data,
--    but admin also needs to fetch that learner's recent results for charts)
CREATE OR REPLACE FUNCTION get_learner_results(p_user_id uuid, p_limit int DEFAULT 50)
RETURNS SETOF practice_results
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT *
  FROM practice_results
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;
