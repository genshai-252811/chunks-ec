import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Sentence {
  id: string;
  vietnamese: string;
  english: string;
  category: 'greeting' | 'daily' | 'business' | 'expression' | 'question' | 'vocab' | 'slang';
  difficulty: number;
}

export function useSentences() {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentSentence, setCurrentSentence] = useState<Sentence | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all sentences on mount
  useEffect(() => {
    const fetchSentences = async () => {
      try {
        setIsLoading(true);
        const { data, error: fetchError } = await supabase
          .from('sentences')
          .select('*')
          .order('created_at', { ascending: true });

        if (fetchError) throw fetchError;

        const mappedSentences: Sentence[] = (data || []).map(s => ({
          id: s.id,
          vietnamese: s.vietnamese,
          english: s.english,
          category: s.category as Sentence['category'],
          difficulty: s.difficulty || 1,
        }));

        setSentences(mappedSentences);
        
        // Set initial random sentence
        if (mappedSentences.length > 0) {
          const randomIndex = Math.floor(Math.random() * mappedSentences.length);
          setCurrentSentence(mappedSentences[randomIndex]);
        }
      } catch (err) {
        console.error('Failed to fetch sentences:', err);
        setError('Failed to load sentences');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSentences();
  }, []);

  const getNextSentence = useCallback(() => {
    if (sentences.length <= 1) return;
    
    const filtered = currentSentence 
      ? sentences.filter(s => s.id !== currentSentence.id)
      : sentences;
    
    const randomIndex = Math.floor(Math.random() * filtered.length);
    setCurrentSentence(filtered[randomIndex]);
  }, [sentences, currentSentence]);

  const getSentencesByCategory = useCallback((category: Sentence['category']) => {
    return sentences.filter(s => s.category === category);
  }, [sentences]);

  return {
    sentences,
    currentSentence,
    isLoading,
    error,
    getNextSentence,
    getSentencesByCategory,
  };
}
