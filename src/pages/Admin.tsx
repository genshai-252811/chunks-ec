import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, BookOpen, Users, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import { LessonsTab } from '@/components/admin/LessonsTab';
import { LearnersTab } from '@/components/admin/LearnersTab';
import { MetricsTab } from '@/components/admin/MetricsTab';

const Admin = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && isAuthenticated && !isAdmin) {
      toast({
        title: 'Access Denied',
        description: 'You do not have admin privileges.',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [isAdmin, adminLoading, isAuthenticated, navigate, toast]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto p-4">
        {/* Header */}
        <motion.div
          className="flex items-center gap-4 mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs defaultValue="lessons" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="lessons" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Lessons
              </TabsTrigger>
              <TabsTrigger value="learners" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Learners
              </TabsTrigger>
              <TabsTrigger value="metrics" className="flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                Metrics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lessons">
              <LessonsTab />
            </TabsContent>

            <TabsContent value="learners">
              <LearnersTab />
            </TabsContent>

            <TabsContent value="metrics">
              <MetricsTab />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Admin;
