import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Target, Clock, TrendingUp, Loader2, Flame, Volume2, Zap, Timer, Waves, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { usePracticeResults, PracticeResult } from '@/hooks/usePracticeResults';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import { format, subDays, startOfDay, differenceInCalendarDays } from 'date-fns';

type TimeRange = '7d' | '14d' | '30d' | 'all';

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '14d', label: '14 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'all', label: 'All Time' },
];

const METRIC_COLORS: Record<string, string> = {
  power: '#22c55e',
  tempo: '#3b82f6',
  flow: '#a855f7',
  boost: '#f59e0b',
  spark: '#ef4444',
};

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'greeting', label: 'Greeting' },
  { value: 'daily', label: 'Daily' },
  { value: 'business', label: 'Business' },
  { value: 'expression', label: 'Expression' },
  { value: 'question', label: 'Question' },
  { value: 'vocab', label: 'Vocab' },
  { value: 'slang', label: 'Slang' },
];

const RADAR_METRICS = [
  { key: 'power', label: 'Power', field: 'energy_score' as const, color: METRIC_COLORS.power },
  { key: 'tempo', label: 'Tempo', field: 'clarity_score' as const, color: METRIC_COLORS.tempo },
  { key: 'flow', label: 'Flow', field: 'pace_score' as const, color: METRIC_COLORS.flow },
  { key: 'boost', label: 'Boost', field: 'acceleration_score' as const, color: METRIC_COLORS.boost },
  { key: 'spark', label: 'Spark', field: 'response_time_score' as const, color: METRIC_COLORS.spark },
] as const;

const ALL_RADAR_KEYS = RADAR_METRICS.map(m => m.key);

const SESSIONS_PER_PAGE = 20;

// Calculate streak from results
function calculateStreak(results: PracticeResult[]): { current: number; best: number } {
  if (results.length === 0) return { current: 0, best: 0 };

  // Get unique practice dates sorted descending
  const uniqueDates = [...new Set(
    results.map(r => startOfDay(new Date(r.created_at)).getTime())
  )].sort((a, b) => b - a);

  if (uniqueDates.length === 0) return { current: 0, best: 0 };

  // Current streak: count consecutive days from today backwards
  const today = startOfDay(new Date()).getTime();
  const yesterday = startOfDay(subDays(new Date(), 1)).getTime();

  let currentStreak = 0;
  // Start counting if the most recent session is today or yesterday
  if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
    let expectedDate = uniqueDates[0];
    for (const date of uniqueDates) {
      if (date === expectedDate) {
        currentStreak++;
        expectedDate = startOfDay(subDays(new Date(date), 1)).getTime();
      } else if (date < expectedDate) {
        break;
      }
    }
  }

  // Best streak: scan all dates
  let bestStreak = 1;
  let runStreak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const diff = differenceInCalendarDays(new Date(uniqueDates[i - 1]), new Date(uniqueDates[i]));
    if (diff === 1) {
      runStreak++;
      bestStreak = Math.max(bestStreak, runStreak);
    } else {
      runStreak = 1;
    }
  }

  return { current: currentStreak, best: bestStreak };
}

// Calculate week-over-week improvement
function calculateImprovement(results: PracticeResult[]): { scoreDiff: number; sessionsDiff: number } | null {
  if (results.length === 0) return null;

  const now = new Date();
  const thisWeekStart = startOfDay(subDays(now, 7));
  const lastWeekStart = startOfDay(subDays(now, 14));

  const thisWeek = results.filter(r => {
    const d = new Date(r.created_at);
    return d >= thisWeekStart;
  });
  const lastWeek = results.filter(r => {
    const d = new Date(r.created_at);
    return d >= lastWeekStart && d < thisWeekStart;
  });

  if (lastWeek.length === 0) return null;

  const thisAvg = thisWeek.length > 0
    ? Math.round(thisWeek.reduce((s, r) => s + r.score, 0) / thisWeek.length)
    : 0;
  const lastAvg = Math.round(lastWeek.reduce((s, r) => s + r.score, 0) / lastWeek.length);

  return {
    scoreDiff: thisAvg - lastAvg,
    sessionsDiff: thisWeek.length - lastWeek.length,
  };
}

const Progress = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { results, isLoading, isLoadingStats, fetchResults, fetchStats, stats } = usePracticeResults();
  const [timeRange, setTimeRange] = useState<TimeRange>('14d');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sessionsPage, setSessionsPage] = useState(0);
  const [selectedRadarMetrics, setSelectedRadarMetrics] = useState<string[]>([...ALL_RADAR_KEYS]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      // Fetch enough results for the selected range
      const limit = timeRange === 'all' ? 1000 : timeRange === '30d' ? 500 : 200;
      fetchResults(limit);
      fetchStats();
    }
  }, [isAuthenticated, fetchResults, fetchStats, timeRange]);

  const streak = useMemo(() => calculateStreak(results), [results]);
  const improvement = useMemo(() => calculateImprovement(results), [results]);

  // Filter results by time range
  const filteredResults = useMemo(() => {
    if (timeRange === 'all') return results;
    const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
    const cutoff = startOfDay(subDays(new Date(), days));
    return results.filter(r => new Date(r.created_at) >= cutoff);
  }, [results, timeRange]);

  // Prepare chart data for the selected time range
  const chartData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : timeRange === '30d' ? 30 : Math.min(60, differenceInCalendarDays(new Date(), new Date(results[results.length - 1]?.created_at || new Date())) + 1);
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = startOfDay(subDays(new Date(), i));
      const dayResults = filteredResults.filter(r => {
        const resultDate = startOfDay(new Date(r.created_at));
        return resultDate.getTime() === date.getTime();
      });

      const avg = (arr: (number | null)[]): number | null => {
        const valid = arr.filter((v): v is number => v != null);
        return valid.length > 0 ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length) : null;
      };

      const avgScore = avg(dayResults.map(r => r.score));

      data.push({
        date: format(date, days <= 14 ? 'MMM d' : 'd'),
        fullDate: format(date, 'MMM d, yyyy'),
        score: avgScore,
        sessions: dayResults.length,
        power: avg(dayResults.map(r => r.energy_score)),
        tempo: avg(dayResults.map(r => r.clarity_score)),
        flow: avg(dayResults.map(r => r.pace_score)),
        boost: avg(dayResults.map(r => r.acceleration_score)),
        spark: avg(dayResults.map(r => r.response_time_score)),
      });
    }

    return data;
  }, [filteredResults, timeRange, results]);

  // Filter sessions by category, then paginate
  const categoryFilteredSessions = useMemo(() => {
    if (categoryFilter === 'all') return filteredResults;
    return filteredResults.filter(r => r.sentence_category === categoryFilter);
  }, [filteredResults, categoryFilter]);

  const totalSessionPages = Math.max(1, Math.ceil(categoryFilteredSessions.length / SESSIONS_PER_PAGE));
  const paginatedSessions = categoryFilteredSessions.slice(
    sessionsPage * SESSIONS_PER_PAGE,
    (sessionsPage + 1) * SESSIONS_PER_PAGE
  );

  // Get unique categories that exist in current results for showing counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of filteredResults) {
      const cat = r.sentence_category || 'uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [filteredResults]);

  // Radar chart data: average per selected metric from filtered results
  const radarData = useMemo(() => {
    if (filteredResults.length === 0) return [];

    return RADAR_METRICS
      .filter(m => selectedRadarMetrics.includes(m.key))
      .map(m => {
        const values = filteredResults
          .map(r => r[m.field])
          .filter((v): v is number => v != null);
        const avg = values.length > 0
          ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
          : 0;
        return {
          metric: m.label,
          value: avg,
          fullMark: 100,
        };
      });
  }, [filteredResults, selectedRadarMetrics]);

  // Toggle a metric for radar chart (enforce min 2)
  const toggleRadarMetric = (key: string) => {
    setSelectedRadarMetrics(prev => {
      if (prev.includes(key)) {
        // Don't allow deselecting if only 2 remain
        if (prev.length <= 2) return prev;
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  };

  if (authLoading || isLoading || isLoadingStats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto p-4">
        {/* Header with Time Range */}
        <motion.div
          className="flex items-center justify-between mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Your Progress</h1>
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {TIME_RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTimeRange(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  timeRange === opt.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Stats Cards - Row 1 */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.totalSessions || 0}</p>
                  <p className="text-xs text-muted-foreground">Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <TrendingUp className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.avgScore || 0}</p>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.bestScore || 0}</p>
                  <p className="text-xs text-muted-foreground">Best Score</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Clock className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats?.totalPracticeSeconds ? Math.round(stats.totalPracticeSeconds / 60) : 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Minutes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Cards - Row 2: Streak + Improvement */}
        <motion.div
          className="grid grid-cols-2 gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {/* Streak Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold">{streak.current}</p>
                    <span className="text-xs text-muted-foreground">day{streak.current !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Current Streak {streak.best > streak.current ? `(Best: ${streak.best})` : streak.current > 0 ? '(Personal best!)' : ''}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Week-over-Week Improvement Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  improvement && improvement.scoreDiff > 0 ? 'bg-emerald-500/10' :
                  improvement && improvement.scoreDiff < 0 ? 'bg-red-500/10' : 'bg-muted'
                }`}>
                  {improvement && improvement.scoreDiff >= 0 ? (
                    <ArrowUpRight className={`w-5 h-5 ${improvement.scoreDiff > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                  ) : (
                    <ArrowDownRight className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div>
                  {improvement ? (
                    <>
                      <div className="flex items-baseline gap-1">
                        <p className={`text-2xl font-bold ${
                          improvement.scoreDiff > 0 ? 'text-emerald-500' :
                          improvement.scoreDiff < 0 ? 'text-red-500' : ''
                        }`}>
                          {improvement.scoreDiff > 0 ? '+' : ''}{improvement.scoreDiff}
                        </p>
                        <span className="text-xs text-muted-foreground">pts</span>
                      </div>
                      <p className="text-xs text-muted-foreground">vs Last Week</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-muted-foreground">—</p>
                      <p className="text-xs text-muted-foreground">Need 2 weeks of data</p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Score Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Score Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      fill="url(#scoreGradient)"
                      strokeWidth={2}
                      connectNulls
                      name="Overall Score"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Per-Metric Trends Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Metric Breakdown
                <span className="text-xs font-normal text-muted-foreground">(daily averages)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                    <Line type="monotone" dataKey="power" stroke={METRIC_COLORS.power} strokeWidth={2} dot={false} connectNulls name="Power" />
                    <Line type="monotone" dataKey="tempo" stroke={METRIC_COLORS.tempo} strokeWidth={2} dot={false} connectNulls name="Tempo" />
                    <Line type="monotone" dataKey="flow" stroke={METRIC_COLORS.flow} strokeWidth={2} dot={false} connectNulls name="Flow" />
                    <Line type="monotone" dataKey="boost" stroke={METRIC_COLORS.boost} strokeWidth={2} dot={false} connectNulls name="Boost" />
                    <Line type="monotone" dataKey="spark" stroke={METRIC_COLORS.spark} strokeWidth={2} dot={false} connectNulls name="Spark" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Radar Chart - Skill Profile */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
        >
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Skill Profile</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {selectedRadarMetrics.length}/{RADAR_METRICS.length} metrics
                </span>
              </div>
              {/* Metric Toggle Buttons */}
              <div className="flex gap-1.5 flex-wrap pt-2">
                {RADAR_METRICS.map(m => {
                  const isSelected = selectedRadarMetrics.includes(m.key);
                  const canDeselect = selectedRadarMetrics.length > 2;
                  return (
                    <button
                      key={m.key}
                      onClick={() => toggleRadarMetric(m.key)}
                      disabled={isSelected && !canDeselect}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all border ${
                        isSelected
                          ? 'text-white border-transparent'
                          : 'bg-muted/50 text-muted-foreground border-border hover:border-foreground/30'
                      } ${isSelected && !canDeselect ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
                      style={isSelected ? { backgroundColor: m.color } : undefined}
                      title={isSelected && !canDeselect ? 'Minimum 2 metrics required' : `Toggle ${m.label}`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent>
              {radarData.length >= 2 ? (
                <div className="h-72 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis
                        dataKey="metric"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        tickCount={5}
                      />
                      <Radar
                        name="Average"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number) => [`${value}`, 'Score']}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-12">
                  No data yet. Complete practice sessions to see your skill profile.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Sessions per Day Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Daily Practice Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''}
                    />
                    <Line
                      type="monotone"
                      dataKey="sessions"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--accent))' }}
                      name="Sessions"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Sessions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Sessions ({categoryFilteredSessions.length})</CardTitle>
              </div>
              {/* Category Filter */}
              <div className="flex gap-1 flex-wrap pt-2">
                {CATEGORY_OPTIONS.map(opt => {
                  const count = opt.value === 'all'
                    ? filteredResults.length
                    : (categoryCounts[opt.value] || 0);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { setCategoryFilter(opt.value); setSessionsPage(0); }}
                      className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                        categoryFilter === opt.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label} {count > 0 && <span className="opacity-70">({count})</span>}
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent>
              {paginatedSessions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {categoryFilter !== 'all'
                    ? `No sessions for "${categoryFilter}" in this time range.`
                    : 'No practice sessions yet. Start practicing to see your progress!'}
                </p>
              ) : (
                <div className="space-y-3">
                  {paginatedSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          session.score >= 80 ? 'bg-green-500/20 text-green-500' :
                          session.score >= 60 ? 'bg-yellow-500/20 text-yellow-500' :
                          'bg-red-500/20 text-red-500'
                        }`}>
                          {session.score}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {format(new Date(session.created_at), 'MMM d, h:mm a')}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{Math.round(Number(session.duration_seconds))}s</span>
                            {session.sentence_category && (
                              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] capitalize">
                                {session.sentence_category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground space-y-0.5">
                        <div className="flex gap-2 justify-end">
                          <span style={{ color: METRIC_COLORS.power }}>
                            {session.energy_score != null ? Math.round(Number(session.energy_score)) : '-'}
                          </span>
                          <span style={{ color: METRIC_COLORS.tempo }}>
                            {session.clarity_score != null ? Math.round(Number(session.clarity_score)) : '-'}
                          </span>
                          <span style={{ color: METRIC_COLORS.flow }}>
                            {session.pace_score != null ? Math.round(Number(session.pace_score)) : '-'}
                          </span>
                          <span style={{ color: METRIC_COLORS.boost }}>
                            {session.acceleration_score != null ? Math.round(Number(session.acceleration_score)) : '-'}
                          </span>
                          <span style={{ color: METRIC_COLORS.spark }}>
                            {session.response_time_score != null ? Math.round(Number(session.response_time_score)) : '-'}
                          </span>
                        </div>
                        <div className="flex gap-2 justify-end text-[10px]">
                          <span>Power</span>
                          <span>Tempo</span>
                          <span>Flow</span>
                          <span>Boost</span>
                          <span>Spark</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalSessionPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSessionsPage(p => Math.max(0, p - 1))}
                    disabled={sessionsPage === 0}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {sessionsPage + 1} of {totalSessionPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSessionsPage(p => Math.min(totalSessionPages - 1, p + 1))}
                    disabled={sessionsPage >= totalSessionPages - 1}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Progress;
