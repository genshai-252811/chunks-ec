import { useState, useEffect, useCallback } from 'react';
import { Loader2, Search, Shield, User, ShieldOff, ChevronRight, Target, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LearnerProgressDetail } from './LearnerProgressDetail';
import { format } from 'date-fns';

interface LearnerStats {
  user_id: string;
  total_sessions: number;
  avg_score: number;
  best_score: number;
  total_practice_seconds: number;
  last_session_at: string | null;
}

interface Learner {
  user_id: string;
  display_name: string | null;
  created_at: string;
  is_admin: boolean;
  stats: LearnerStats | null;
}

export const LearnersTab = () => {
  const { toast } = useToast();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toggleAdminTarget, setToggleAdminTarget] = useState<Learner | null>(null);
  const [expandedLearnerId, setExpandedLearnerId] = useState<string | null>(null);

  const fetchLearners = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch admin roles
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      // Fetch all learner stats
      const { data: allStats, error: statsError } = await supabase
        .rpc('get_all_learner_stats');

      if (statsError) {
        console.error('Failed to fetch learner stats:', statsError);
      }

      const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);

      // Build stats lookup map
      const statsMap = new Map<string, LearnerStats>();
      if (allStats && Array.isArray(allStats)) {
        for (const s of allStats as LearnerStats[]) {
          statsMap.set(s.user_id, s);
        }
      }

      const mappedLearners: Learner[] = (profiles || []).map(p => ({
        user_id: p.user_id,
        display_name: p.display_name,
        created_at: p.created_at,
        is_admin: adminUserIds.has(p.user_id),
        stats: statsMap.get(p.user_id) || null,
      }));

      setLearners(mappedLearners);
    } catch (err) {
      console.error('Failed to fetch learners:', err);
      toast({ title: 'Error', description: 'Failed to load learners.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLearners();
  }, [fetchLearners]);

  const handleToggleAdmin = async () => {
    if (!toggleAdminTarget) return;

    const { user_id, is_admin } = toggleAdminTarget;

    try {
      if (is_admin) {
        // Remove admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user_id)
          .eq('role', 'admin');

        if (error) throw error;
        toast({ title: 'Success', description: 'Admin role removed.' });
      } else {
        // Add admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id, role: 'admin' });

        if (error) throw error;
        toast({ title: 'Success', description: 'Admin role granted.' });
      }

      await fetchLearners();
    } catch (err: any) {
      console.error('Failed to toggle admin:', err);
      toast({ title: 'Error', description: err.message || 'Failed to update role.', variant: 'destructive' });
    } finally {
      setToggleAdminTarget(null);
    }
  };

  const filteredLearners = learners.filter(l =>
    searchQuery === '' ||
    (l.display_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    l.user_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Class-wide summary
  const classSummary = {
    totalLearners: learners.length,
    activeLearners: learners.filter(l => (l.stats?.total_sessions ?? 0) > 0).length,
    totalSessions: learners.reduce((sum, l) => sum + (l.stats?.total_sessions ?? 0), 0),
    avgScore: (() => {
      const withScores = learners.filter(l => (l.stats?.total_sessions ?? 0) > 0);
      if (withScores.length === 0) return 0;
      return Math.round(withScores.reduce((sum, l) => sum + (l.stats?.avg_score ?? 0), 0) / withScores.length);
    })(),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Class Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
          <p className="text-xl font-bold">{classSummary.totalLearners}</p>
          <p className="text-[10px] text-muted-foreground">Total Learners</p>
        </div>
        <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10 text-center">
          <p className="text-xl font-bold text-green-600">{classSummary.activeLearners}</p>
          <p className="text-[10px] text-muted-foreground">Active</p>
        </div>
        <div className="p-3 rounded-lg bg-accent/5 border border-accent/10 text-center">
          <p className="text-xl font-bold">{classSummary.totalSessions}</p>
          <p className="text-[10px] text-muted-foreground">Total Sessions</p>
        </div>
        <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10 text-center">
          <p className="text-xl font-bold">{classSummary.avgScore}</p>
          <p className="text-[10px] text-muted-foreground">Class Avg</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search learners by name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Learners List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Learners ({filteredLearners.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLearners.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No learners found.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredLearners.map((learner) => (
                <div key={learner.user_id}>
                  {/* Learner Row */}
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                      expandedLearnerId === learner.user_id
                        ? 'bg-muted'
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                    onClick={() => setExpandedLearnerId(
                      expandedLearnerId === learner.user_id ? null : learner.user_id
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        learner.is_admin ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/20 text-muted-foreground'
                      }`}>
                        {learner.is_admin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{learner.display_name || 'Unnamed User'}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {learner.stats && learner.stats.total_sessions > 0 ? (
                            <>
                              <span className="flex items-center gap-1">
                                <Target className="w-3 h-3" />
                                {learner.stats.total_sessions} sessions
                              </span>
                              <span className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                Avg: {learner.stats.avg_score}
                              </span>
                              {learner.stats.last_session_at && (
                                <span>
                                  Last: {format(new Date(learner.stats.last_session_at), 'MMM d')}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground/60">No practice yet</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Score Badge */}
                      {learner.stats && learner.stats.total_sessions > 0 && (
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                          learner.stats.avg_score >= 80 ? 'bg-green-500/20 text-green-500' :
                          learner.stats.avg_score >= 60 ? 'bg-yellow-500/20 text-yellow-500' :
                          'bg-red-500/20 text-red-500'
                        }`}>
                          {learner.stats.avg_score}
                        </div>
                      )}

                      {learner.is_admin && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          Admin
                        </span>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setToggleAdminTarget(learner);
                        }}
                      >
                        {learner.is_admin ? (
                          <>
                            <ShieldOff className="w-4 h-4 mr-1" />
                            Revoke
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4 mr-1" />
                            Make Admin
                          </>
                        )}
                      </Button>

                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${
                        expandedLearnerId === learner.user_id ? 'rotate-90' : ''
                      }`} />
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {expandedLearnerId === learner.user_id && (
                    <div className="mt-2 ml-4 mr-2 p-4 rounded-lg border border-border/50 bg-background">
                      <LearnerProgressDetail
                        userId={learner.user_id}
                        displayName={learner.display_name}
                        onClose={() => setExpandedLearnerId(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Toggle Admin Confirmation */}
      <AlertDialog open={!!toggleAdminTarget} onOpenChange={(open) => !open && setToggleAdminTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleAdminTarget?.is_admin ? 'Revoke Admin' : 'Grant Admin'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleAdminTarget?.is_admin
                ? `Remove admin privileges from "${toggleAdminTarget?.display_name || 'this user'}"?`
                : `Grant admin privileges to "${toggleAdminTarget?.display_name || 'this user'}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleAdmin}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
