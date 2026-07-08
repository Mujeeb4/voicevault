/**
 * Question Card Component
 * Displays question with domain badge and tips
 * Following .cursorrules and best UX practices
 */

'use client';

import { motion } from 'framer-motion';
import { Lightbulb, Clock } from 'lucide-react';
import type { Question } from '@/types';
import { Badge } from '@/components/ui/badge';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
}

const domainColors = {
  childhood: 'bg-secondary/12 text-secondary-foreground border-secondary/25',
  family: 'bg-accent/25 text-accent-foreground border-accent/35',
  career: 'bg-primary/12 text-primary border-primary/25',
  wisdom: 'bg-emerald-500/12 text-emerald-200 border-emerald-500/25',
  challenges: 'bg-rose-500/12 text-rose-200 border-rose-500/25',
  personality: 'bg-sky-500/12 text-sky-200 border-sky-500/25',
};

export function QuestionCard({ question, questionNumber, totalQuestions }: QuestionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="journey-card p-5 sm:p-7"
    >
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        {/* Question Number */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/12">
            <span className="text-xl font-bold text-primary">{questionNumber}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Question {questionNumber}</p>
            <p className="text-xs text-muted-foreground">of {totalQuestions}</p>
          </div>
        </div>

        {/* Domain Badge */}
        <Badge className={`${domainColors[question.domain]} border`}>
          {question.domain.charAt(0).toUpperCase() + question.domain.slice(1)}
        </Badge>
      </div>

      {/* Question Text */}
      <div className="mb-5">
        <h2 className="font-heading text-2xl font-semibold leading-relaxed text-foreground sm:text-3xl">
          {question.question_text}
        </h2>
      </div>

      {/* Tip Section */}
      {question.tip && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ delay: 0.2 }}
          className="mb-4 rounded-lg border border-primary/25 bg-primary/10 p-4"
        >
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
            <div>
              <p className="mb-1 text-sm font-semibold text-foreground">Tip</p>
              <p className="text-sm text-muted-foreground">{question.tip}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Suggested Duration */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>
          Suggested duration: <strong>{formatDuration(question.suggested_duration_seconds)}</strong>
        </span>
      </div>
    </motion.div>
  );
}

/**
 * Format seconds to human-readable duration
 */
function formatDuration(seconds: number): string {
  if (seconds <= 0) {
    return 'Open ended';
  }
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) {
    return `${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')} minutes`;
}
