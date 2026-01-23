import { motion } from 'framer-motion';
import { RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Sentence } from '@/lib/sentenceBank';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface PracticeSentenceProps {
  sentence: Sentence;
  onRefresh: () => void;
  isRecording: boolean;
}

export function PracticeSentence({
  sentence,
  onRefresh,
  isRecording,
}: PracticeSentenceProps) {
  const [showEnglish, setShowEnglish] = useState(false);

  return (
    <motion.div
      className="w-full max-w-xl mx-auto px-4"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Vietnamese Sentence - Always visible */}
      <div className="text-center mb-4">
        <motion.p
          className="text-2xl md:text-3xl font-semibold text-foreground mb-2 leading-relaxed"
          key={sentence.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {sentence.vietnamese}
        </motion.p>

        {/* Subtitle */}
        <p className="text-sm text-muted-foreground">
          Nói lại bằng Tiếng Anh
        </p>
      </div>

      {/* Controls */}
      {!isRecording && (
        <motion.div
          className="flex items-center justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {/* Show/Hide English Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEnglish(!showEnglish)}
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            {showEnglish ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Hide answer
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                Show answer
              </>
            )}
          </Button>

          {/* Refresh Sentence */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            New sentence
          </Button>
        </motion.div>
      )}

      {/* English Answer */}
      {showEnglish && !isRecording && (
        <motion.div
          className="mt-4 text-center"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="glass-card inline-block px-4 py-2">
            <p className="text-lg text-primary font-medium">
              {sentence.english}
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
