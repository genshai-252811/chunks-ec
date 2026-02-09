# Progress Tracking Data Integrity & Accurate Stats - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two critical bugs: (1) 2 of 5 metric scores are silently discarded on save, and (2) all progress stats are wrong for users with >100 sessions because aggregation is client-side on a capped fetch.

**Architecture:** Add 4 missing columns to `practice_results` table (acceleration_score, response_time_score, response_time_ms, words_per_minute). Update the TypeScript types, save hook, and fetch hook. Replace client-side stat computation with a server-side Supabase RPC function that computes count/avg/max/sum across ALL rows. The Progress page consumes the new `fetchStats()` independently from `fetchResults()` (which stays capped for chart data).

**Tech Stack:** Supabase (PostgreSQL migration + RPC function), TypeScript, React hooks

---

## Phase 1: Fix Data Integrity (save all 5 metrics)

### Task 1: Add missing columns to Supabase database

**Context:** The `practice_results` table has columns for `energy_score` (volume), `clarity_score` (speech rate), and `pace_score` (pauses), but is missing columns for the acceleration and response time metrics. The `words_per_minute` raw value is also not stored (only the score). We need these columns so all 5 metric scores are persisted.

**Action:** Run this SQL migration in the Supabase Dashboard SQL editor (Dashboard > SQL Editor > New query):

```sql
-- Add missing metric columns to practice_results
ALTER TABLE practice_results
  ADD COLUMN IF NOT EXISTS acceleration_score numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS response_time_score numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS response_time_ms numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS words_per_minute numeric DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN practice_results.acceleration_score IS 'Energy boost/dynamics score (0-100)';
COMMENT ON COLUMN practice_results.response_time_score IS 'Response readiness score (0-100)';
COMMENT ON COLUMN practice_results.response_time_ms IS 'Raw time to first speech in milliseconds';
COMMENT ON COLUMN practice_results.words_per_minute IS 'Raw speech rate in words per minute';
```

**Verify:** Run `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'practice_results' ORDER BY ordinal_position;` and confirm the 4 new columns appear.

---

### Task 2: Update Supabase TypeScript types

**Files:**
- Modify: `src/integrations/supabase/types.ts` (lines 101-159, the `practice_results` table definition)

**What to do:** Add the 4 new columns to the Row, Insert, and Update types for `practice_results`.

**In the `Row` type** (after `volume_avg: number | null` at line 116), add:
```typescript
          acceleration_score: number | null
          response_time_score: number | null
          response_time_ms: number | null
          words_per_minute: number | null
```

**In the `Insert` type** (after `volume_avg?: number | null` at line 132), add:
```typescript
          acceleration_score?: number | null
          response_time_score?: number | null
          response_time_ms?: number | null
          words_per_minute?: number | null
```

**In the `Update` type** (after `volume_avg?: number | null` at line 148), add:
```typescript
          acceleration_score?: number | null
          response_time_score?: number | null
          response_time_ms?: number | null
          words_per_minute?: number | null
```

**Verify:** Run `npm run build` — should compile with no errors (new optional fields don't break anything).

---

### Task 3: Update PracticeResult interface and saveResult hook

**Files:**
- Modify: `src/hooks/usePracticeResults.ts`

**Step 1:** Add the 4 new fields to the `PracticeResult` interface (after line 16 `speech_ratio`):

```typescript
  acceleration_score: number | null;
  response_time_score: number | null;
  response_time_ms: number | null;
  words_per_minute: number | null;
```

**Step 2:** Update the `saveResult` insert object (after line 60 `speech_ratio`) to include the missing metrics:

```typescript
        acceleration_score: analysisResult.acceleration?.score ?? null,
        response_time_score: analysisResult.responseTime?.score ?? null,
        response_time_ms: analysisResult.responseTime?.responseTimeMs ?? null,
        words_per_minute: analysisResult.speechRate?.wordsPerMinute ?? null,
```

**Verify:** Run `npm run build` — should compile cleanly. The `saveResult` function now persists all 5 metric scores plus 2 raw values.

---

### Task 4: Verify build passes

**Run:** `npm run build`

**Expected:** Clean build with no TypeScript errors. This confirms Phase 1 types are consistent across the codebase.

**Commit:**
```
feat: save all 5 metric scores to database

Previously only 3 of 5 audio metric scores were saved (volume, speech
rate, pauses). Acceleration and response time scores were computed but
silently discarded. Now all scores plus raw WPM and response time ms
are persisted.

Requires SQL migration: ALTER TABLE practice_results ADD COLUMN
acceleration_score, response_time_score, response_time_ms,
words_per_minute.
```

---

## Phase 2: Fix Stats Accuracy (server-side aggregation)

### Task 5: Create Supabase RPC function for user stats

**Context:** Currently the Progress page fetches 100 rows and computes stats client-side. For users with >100 sessions, totalSessions/avgScore/bestScore/totalMinutes are all wrong. We need a server-side function that aggregates across ALL rows.

**Action:** Run this SQL in the Supabase Dashboard SQL editor:

```sql
-- Server-side stats aggregation (no row limit)
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
```

**Verify:** Run in SQL editor:
```sql
SELECT get_user_practice_stats('00000000-0000-0000-0000-000000000000');
```
Should return a JSON object with all zeros/nulls (no data for fake user).

---

### Task 6: Register the RPC function in TypeScript types

**Files:**
- Modify: `src/integrations/supabase/types.ts` (the `Functions` section, around line 275)

**What to do:** Add the new function signature alongside the existing `has_role` function.

Replace the current Functions block:
```typescript
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
```

With:
```typescript
    Functions: {
      get_user_practice_stats: {
        Args: {
          p_user_id: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
```

**Verify:** `npm run build` — should compile cleanly.

---

### Task 7: Add fetchStats to usePracticeResults hook

**Files:**
- Modify: `src/hooks/usePracticeResults.ts`

**Context:** We need a new `fetchStats()` function that calls the RPC, and a `stats` state to hold the result. The old `getStats()` (client-side computation from capped results) gets replaced.

**Step 1:** Add a stats interface and state. After the `VideoMetrics` interface (line 27), add:

```typescript
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
```

**Step 2:** Add state for stats inside the hook (after the `error` state, line 32):

```typescript
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
```

**Step 3:** Add the `fetchStats` function (after `fetchResults`, before the old `getStats`):

```typescript
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
```

**Step 4:** Remove the old `getStats` function (the `useCallback` block at lines 98-112).

**Step 5:** Update the return object to expose the new state and function:

```typescript
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
```

**Verify:** `npm run build` — will fail because Progress.tsx still uses `getStats`. That's expected and gets fixed in the next task.

---

### Task 8: Update Progress page to use server-side stats

**Files:**
- Modify: `src/pages/Progress.tsx`

**Step 1:** Update the hook destructuring (line 25). Replace:
```typescript
  const { results, isLoading, fetchResults, getStats } = usePracticeResults();
```
With:
```typescript
  const { results, isLoading, isLoadingStats, fetchResults, fetchStats, stats } = usePracticeResults();
```

**Step 2:** Update the data-fetching useEffect (lines 33-37). Replace:
```typescript
  useEffect(() => {
    if (isAuthenticated) {
      fetchResults(100); // Fetch more for charts
    }
  }, [isAuthenticated, fetchResults]);
```
With:
```typescript
  useEffect(() => {
    if (isAuthenticated) {
      fetchResults(100); // For chart data (14-day window)
      fetchStats();      // Server-side aggregation (all sessions)
    }
  }, [isAuthenticated, fetchResults, fetchStats]);
```

**Step 3:** Remove the old `getStats()` call (line 39):
```typescript
  const stats = getStats();
```
Delete this line entirely — `stats` now comes from the hook's state.

**Step 4:** Update the loading check (line 70). Replace:
```typescript
  if (authLoading || isLoading) {
```
With:
```typescript
  if (authLoading || isLoading || isLoadingStats) {
```

**Step 5:** Update the stats card values. The stat fields changed names slightly:

- `stats?.totalSessions` stays the same
- `stats?.avgScore` stays the same
- `stats?.bestScore` stays the same
- `stats?.totalPracticeTime` changes to `stats?.totalPracticeSeconds`

So update the Minutes card (line 158). Replace:
```typescript
                    {stats?.totalPracticeTime ? Math.round(stats.totalPracticeTime / 60) : 0}
```
With:
```typescript
                    {stats?.totalPracticeSeconds ? Math.round(stats.totalPracticeSeconds / 60) : 0}
```

**Verify:** `npm run build` — should compile cleanly.

---

### Task 9: Update recent sessions list to show all 5 metrics

**Files:**
- Modify: `src/pages/Progress.tsx` (the recent sessions section, around lines 306-309)

**Context:** Currently only Energy and Clarity are shown in the recent sessions list. With the new columns, we can show all saved metrics.

**Replace** the right-side metric display (lines 306-309):
```typescript
                      <div className="text-right text-xs text-muted-foreground">
                        <p>Energy: {session.energy_score ? Math.round(Number(session.energy_score)) : '-'}</p>
                        <p>Clarity: {session.clarity_score ? Math.round(Number(session.clarity_score)) : '-'}</p>
                      </div>
```

**With:**
```typescript
                      <div className="text-right text-xs text-muted-foreground space-y-0.5">
                        <div className="flex gap-2 justify-end">
                          <span>Power: {session.energy_score != null ? Math.round(Number(session.energy_score)) : '-'}</span>
                          <span>Tempo: {session.clarity_score != null ? Math.round(Number(session.clarity_score)) : '-'}</span>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <span>Flow: {session.pace_score != null ? Math.round(Number(session.pace_score)) : '-'}</span>
                          <span>Boost: {session.acceleration_score != null ? Math.round(Number(session.acceleration_score)) : '-'}</span>
                          <span>Spark: {session.response_time_score != null ? Math.round(Number(session.response_time_score)) : '-'}</span>
                        </div>
                      </div>
```

**Verify:** `npm run build` — should compile cleanly.

---

### Task 10: Final build and commit

**Run:** `npm run build`

**Expected:** Clean production build with zero errors.

**Run:** `npm run test` (if tests exist)

**Expected:** All tests pass.

**Commit:**
```
feat: accurate progress stats via server-side aggregation

Stats (total sessions, avg score, best score, total minutes) are now
computed server-side via Supabase RPC instead of client-side from a
capped 100-row fetch. This fixes incorrect stats for active users.

Also shows all 5 metric scores in the recent sessions list instead
of only 2.

Requires SQL: CREATE FUNCTION get_user_practice_stats(p_user_id uuid)
```

---

## Summary of Changes

| File | Change |
|------|--------|
| **Supabase DB** | Add 4 columns to `practice_results` + create `get_user_practice_stats` RPC |
| `src/integrations/supabase/types.ts` | Add 4 columns to Row/Insert/Update + register RPC function |
| `src/hooks/usePracticeResults.ts` | Add 4 fields to PracticeResult, save all metrics in saveResult, add fetchStats via RPC, remove old getStats |
| `src/pages/Progress.tsx` | Use fetchStats for stat cards, show all 5 metrics in session list |

## SQL Migrations to Run (in order)

**Migration 1 (Task 1):**
```sql
ALTER TABLE practice_results
  ADD COLUMN IF NOT EXISTS acceleration_score numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS response_time_score numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS response_time_ms numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS words_per_minute numeric DEFAULT NULL;
```

**Migration 2 (Task 5):**
```sql
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
```
