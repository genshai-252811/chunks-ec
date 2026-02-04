import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useAdmin() {
  const { user, isLoading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      // IMPORTANT: don't resolve admin loading until auth has resolved.
      // Otherwise /admin can redirect to / before the session/user is available.
      if (authLoading) {
        setIsLoading(true);
        return;
      }

      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
        }
      } catch (err) {
        console.error('Failed to check admin status:', err);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, authLoading]);

  return { isAdmin, isLoading };
}

export interface Sentence {
  id: string;
  vietnamese: string;
  english: string;
  category: string;
  difficulty: number | null;
  created_at: string;
}

export function useSentenceManagement() {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSentences = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('sentences')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setSentences(data || []);
    }

    setIsLoading(false);
  }, []);

  const addSentence = useCallback(async (sentence: Omit<Sentence, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('sentences')
      .insert(sentence)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    setSentences(prev => [data, ...prev]);
    return { data, error: null };
  }, []);

  const updateSentence = useCallback(async (id: string, updates: Partial<Omit<Sentence, 'id' | 'created_at'>>) => {
    const { data, error } = await supabase
      .from('sentences')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    setSentences(prev => prev.map(s => s.id === id ? data : s));
    return { data, error: null };
  }, []);

  const deleteSentence = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('sentences')
      .delete()
      .eq('id', id);

    if (error) {
      return { error };
    }

    setSentences(prev => prev.filter(s => s.id !== id));
    return { error: null };
  }, []);

  return {
    sentences,
    isLoading,
    error,
    fetchSentences,
    addSentence,
    updateSentence,
    deleteSentence,
  };
}
