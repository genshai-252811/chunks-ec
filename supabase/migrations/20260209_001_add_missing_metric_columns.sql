-- Migration: Add missing metric columns to practice_results
-- Date: 2026-02-09
-- Purpose: acceleration_score and response_time_score were computed but never saved.
--          Also adds raw WPM and response time ms for future analytics.

ALTER TABLE practice_results
  ADD COLUMN IF NOT EXISTS acceleration_score numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS response_time_score numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS response_time_ms numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS words_per_minute numeric DEFAULT NULL;

COMMENT ON COLUMN practice_results.acceleration_score IS 'Energy boost/dynamics score (0-100)';
COMMENT ON COLUMN practice_results.response_time_score IS 'Response readiness score (0-100)';
COMMENT ON COLUMN practice_results.response_time_ms IS 'Raw time to first speech in milliseconds';
COMMENT ON COLUMN practice_results.words_per_minute IS 'Raw speech rate in words per minute';
