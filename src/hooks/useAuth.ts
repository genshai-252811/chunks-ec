import { useState, useEffect, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializedRef = useRef(false);

  // Fetch user profile
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (!error && data) {
      setProfile(data);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Subscribe to changes (sign-in/out, token refresh). We intentionally
    // do NOT mark loading as finished here to avoid a race where the initial
    // callback fires before getSession() resolves.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        // Defer profile fetch to avoid potential auth state change deadlocks
        setTimeout(() => {
          fetchProfile(nextSession.user.id);
        }, 0);
      } else {
        setProfile(null);
      }
    });

    // Single source of truth for initial auth resolution
    (async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        await fetchProfile(initialSession.user.id);
      } else {
        setProfile(null);
      }

      initializedRef.current = true;
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName,
        },
      },
    });
    
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const updateProfile = async (updates: { display_name?: string }) => {
    if (!user) return { error: new Error('Not authenticated') };
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (!error && data) {
      setProfile(data);
    }
    
    return { data, error };
  };

  return {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated: !!session?.user,
    signUp,
    signIn,
    signOut,
    updateProfile,
    fetchProfile,
  };
}
