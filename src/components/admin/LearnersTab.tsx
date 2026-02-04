import { useState, useEffect, useCallback } from 'react';
import { Loader2, Search, Shield, User, ShieldOff } from 'lucide-react';
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

interface Learner {
  user_id: string;
  display_name: string | null;
  created_at: string;
  is_admin: boolean;
}

export const LearnersTab = () => {
  const { toast } = useToast();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toggleAdminTarget, setToggleAdminTarget] = useState<Learner | null>(null);

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

      const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);

      const mappedLearners: Learner[] = (profiles || []).map(p => ({
        user_id: p.user_id,
        display_name: p.display_name,
        created_at: p.created_at,
        is_admin: adminUserIds.has(p.user_id),
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {filteredLearners.map((learner) => (
                <div
                  key={learner.user_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${learner.is_admin ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                      {learner.is_admin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{learner.display_name || 'Unnamed User'}</p>
                      <p className="text-xs text-muted-foreground truncate">{learner.user_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {learner.is_admin && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        Admin
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setToggleAdminTarget(learner)}
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
                  </div>
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
