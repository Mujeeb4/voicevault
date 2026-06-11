import type { Question } from '@/types';

export const OPTIONAL_REFLECTION_ID = 'optional-final-reflection';

export function createOptionalReflectionQuestion(order: number): Question {
  return {
    id: OPTIONAL_REFLECTION_ID,
    question_text: 'Is there anything else you would like your family to hear or remember?',
    domain: 'personality',
    order,
    tip: 'This is optional. Share any story, message, advice, apology, blessing, or memory that did not fit the guided questions.',
    suggested_duration_seconds: 0,
    is_active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

export function isOptionalReflectionQuestion(questionId?: string): boolean {
  return questionId === OPTIONAL_REFLECTION_ID;
}
