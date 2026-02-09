import { useState, useEffect, useMemo } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { PracticeResult } from '@/hooks/usePracticeResults';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

interface LearnerProgressDetailProps {
  userId: string;
  displayName: string | null;
  onClose: () => void;
}

interface LearnerStats {
  totalSessions: number;
  avgScore: number;
  bestScore: number;
  totalPracticeSeconds: number;
}

const METRIC_COLORS: Record<string, string> = {
  power: '#22c55e',
  tempo: '#3b82f6',
  flow: '#a855f7',
  boost: '#f59e0b',
  spark: '#ef4444',
};

export const LearnerProgressDetail = ({ userId, displayName, onClose }: LearnerProgressDetailProps) => {
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [stats, setStats] = useState<LearnerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      // Fetch stats via RPC
      const { data: statsData } = await supabase
        .rpc('get_user_practice_stats', { p_user_id: userId });

      if (statsData) {
        const raw = statsData as any;
        setStats({
          totalSessions: raw?.total_sessions ?? 0,
          avgScore: raw?.avg_score ?? 0,
          bestScore: raw?.best_score ?? 0,
          totalPracticeSeconds: raw?.total_practice_seconds ?? 0,
        });
      }

      // Fetch recent results via RPC
      const { data: resultsData } = await supabase
        .rpc('get_learner_results', { p_user_id: userId, p_limit: 100 });

      if (resultsData) {
        setResults(resultsData as PracticeResult[]);
      }

      setIsLoading(false);
    };

    fetchData();
  }, [userId]);

  // Prepare 14-day chart data
  const chartData = useMemo(() => {
    const days = 14;
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = startOfDay(subDays(new Date(), i));
      const dayResults = results.filter(r => {
        const resultDate = startOfDay(new Date(r.created_at));
        return resultDate.getTime() === date.getTime();
      });

      const avg = (arr: (number | null)[]): number | null => {
        const valid = arr.filter((v): v is number => v != null);
        return valid.length > 0 ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length) : null;
      };

      data.push({
        date: format(date, 'MMM d'),
        score: avg(dayResults.map(r => r.score)),
        sessions: dayResults.length,
        power: avg(dayResults.map(r => r.energy_score)),
        tempo: avg(dayResults.map(r => r.clarity_score)),
        flow: avg(dayResults.map(r => r.pace_score)),
        boost: avg(dayResults.map(r => r.acceleration_score)),
        spark: avg(dayResults.map(r => r.response_time_score)),
      });
    }

    return data;
  }, [results]);

  // Recent 10 sessions
  const recentSessions = results.slice(0, 10);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{displayName || 'Unnamed User'}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <p className="text-xl font-bold">{stats?.totalSessions ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">Sessions</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <p className="text-xl font-bold">{stats?.avgScore ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">Avg Score</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <p className="text-xl font-bold">{stats?.bestScore ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">Best</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <p className="text-xl font-bold">{stats?.totalPracticeSeconds ? Math.round(stats.totalPracticeSeconds / 60) : 0}</p>
          <p className="text-[10px] text-muted-foreground">Minutes</p>
        </div>
      </div>

      {/* Score Trend (14 days) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Score Trend (14 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '10px' }} />
                <Line type="monotone" dataKey="power" stroke={METRIC_COLORS.power} strokeWidth={1.5} dot={false} connectNulls name="Power" />
                <Line type="monotone" dataKey="tempo" stroke={METRIC_COLORS.tempo} strokeWidth={1.5} dot={false} connectNulls name="Tempo" />
                <Line type="monotone" dataKey="flow" stroke={METRIC_COLORS.flow} strokeWidth={1.5} dot={false} connectNulls name="Flow" />
                <Line type="monotone" dataKey="boost" stroke={METRIC_COLORS.boost} strokeWidth={1.5} dot={false} connectNulls name="Boost" />
                <Line type="monotone" dataKey="spark" stroke={METRIC_COLORS.spark} strokeWidth={1.5} dot={false} connectNulls name="Spark" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4 text-sm">No sessions yet.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      session.score >= 80 ? 'bg-green-500/20 text-green-500' :
                      session.score >= 60 ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-red-500/20 text-red-500'
                    }`}>
                      {session.score}
                    </div>
                    <div>
                      <p className="font-medium">{format(new Date(session.created_at), 'MMM d, h:mm a')}</p>
                      <p className="text-muted-foreground">{Math.round(Number(session.duration_seconds))}s</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 text-[10px]">
                    <span style={{ color: METRIC_COLORS.power }}>{session.energy_score != null ? Math.round(Number(session.energy_score)) : '-'}</span>
                    <span style={{ color: METRIC_COLORS.tempo }}>{session.clarity_score != null ? Math.round(Number(session.clarity_score)) : '-'}</span>
                    <span style={{ color: METRIC_COLORS.flow }}>{session.pace_score != null ? Math.round(Number(session.pace_score)) : '-'}</span>
                    <span style={{ color: METRIC_COLORS.boost }}>{session.acceleration_score != null ? Math.round(Number(session.acceleration_score)) : '-'}</span>
                    <span style={{ color: METRIC_COLORS.spark }}>{session.response_time_score != null ? Math.round(Number(session.response_time_score)) : '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
