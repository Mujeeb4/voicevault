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
  childhood: 'bg-purple-100 text-purple-700 border-purple-200',
  family: 'bg-pink-100 text-pink-700 border-pink-200',
  career: 'bg-primary-100 text-primary-700 border-primary-200',
  wisdom: 'bg-green-100 text-green-700 border-green-200',
  challenges: 'bg-orange-100 text-orange-700 border-orange-200',
  personality: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

export function QuestionCard({ question, questionNumber, totalQuestions }: QuestionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        {/* Question Number */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
            <span className="text-xl font-bold text-primary-600">{questionNumber}</span>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Question {questionNumber}</p>
            <p className="text-xs text-gray-400">of {totalQuestions}</p>
          </div>
        </div>

        {/* Domain Badge */}
        <Badge className={`${domainColors[question.domain]} border`}>
          {question.domain.charAt(0).toUpperCase() + question.domain.slice(1)}
        </Badge>
      </div>

      {/* Question Text */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 leading-relaxed">
          {question.question_text}
        </h2>
      </div>

      {/* Tip Section */}
      {question.tip && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ delay: 0.2 }}
          className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4"
        >
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-primary-900 mb-1">Tip</p>
              <p className="text-sm text-primary-700">{question.tip}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Suggested Duration */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
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
