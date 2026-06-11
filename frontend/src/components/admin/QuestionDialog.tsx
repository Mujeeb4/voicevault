'use client';

/**
 * Question Dialog Component
 * Create/Edit questions with validation
 * Following .cursorrules patterns
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useAdminStore } from '@/store/admin';
import type { Question, QuestionDomain, QuestionFormData } from '@/types';

const questionSchema = z.object({
  question_text: z.string().min(10, 'Question must be at least 10 characters').max(500, 'Question too long'),
  domain: z.enum(['childhood', 'family', 'career', 'wisdom', 'challenges', 'personality']),
  order: z.number().int().positive('Order must be a positive number'),
  tip: z.string().max(200, 'Tip too long').optional(),
  suggested_duration_seconds: z.number().int().positive('Duration must be positive').default(60),
  is_active: z.boolean().default(true),
});

interface QuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question?: Question | null;
}

export const QuestionDialog: React.FC<QuestionDialogProps> = ({ open, onOpenChange, question }) => {
  const { createQuestion, updateQuestion, questions, isLoading, error } = useAdminStore();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      question_text: '',
      domain: 'childhood',
      order: questions.length + 1,
      tip: '',
      suggested_duration_seconds: 60,
      is_active: true,
    },
  });

  const domain = watch('domain');
  const questionText = watch('question_text');
  const tip = watch('tip');

  // Populate form when editing
  useEffect(() => {
    if (question) {
      setValue('question_text', question.question_text);
      setValue('domain', question.domain);
      setValue('order', question.order);
      setValue('tip', question.tip || '');
      setValue('suggested_duration_seconds', question.suggested_duration_seconds);
      setValue('is_active', question.is_active);
    } else {
      reset({
        question_text: '',
        domain: 'childhood',
        order: questions.length + 1,
        tip: '',
        suggested_duration_seconds: 60,
        is_active: true,
      });
    }
  }, [question, setValue, reset, questions.length]);

  const onSubmit = async (data: QuestionFormData) => {
    try {
      if (question) {
        // Update existing question
        await updateQuestion(question.id, data);
      } else {
        // Create new question
        await createQuestion(data);
      }
      onOpenChange(false);
      reset();
    } catch {
      // Error handled in store
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{question ? 'Edit Question' : 'Create New Question'}</DialogTitle>
          <DialogDescription>
            {question
              ? 'Update the question details below.'
              : 'Add a new question to the recording session.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Question Text */}
          <div className="space-y-2">
            <Label htmlFor="question_text">
              Question Text * <span className="text-xs text-muted-foreground">({questionText?.length || 0}/500)</span>
            </Label>
            <Textarea
              id="question_text"
              {...register('question_text')}
              placeholder="What was your childhood like?"
              rows={3}
              maxLength={500}
              disabled={isLoading}
            />
            {errors.question_text && (
              <p className="text-sm text-destructive">{errors.question_text.message}</p>
            )}
          </div>

          {/* Domain and Order */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain *</Label>
              <Select
                value={domain}
                onValueChange={(val) => setValue('domain', val as QuestionDomain)}
                disabled={isLoading}
              >
                <SelectTrigger id="domain">
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="childhood">Childhood</SelectItem>
                  <SelectItem value="family">Family</SelectItem>
                  <SelectItem value="career">Career</SelectItem>
                  <SelectItem value="wisdom">Wisdom</SelectItem>
                  <SelectItem value="challenges">Challenges</SelectItem>
                  <SelectItem value="personality">Personality</SelectItem>
                </SelectContent>
              </Select>
              {errors.domain && <p className="text-sm text-destructive">{errors.domain.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="order">Order *</Label>
              <Input
                id="order"
                type="number"
                {...register('order', { valueAsNumber: true })}
                min={1}
                disabled={isLoading}
              />
              {errors.order && <p className="text-sm text-destructive">{errors.order.message}</p>}
            </div>
          </div>

          {/* Duration and Active */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="suggested_duration_seconds">Suggested Duration (seconds) *</Label>
              <Input
                id="suggested_duration_seconds"
                type="number"
                {...register('suggested_duration_seconds', { valueAsNumber: true })}
                min={30}
                max={300}
                disabled={isLoading}
              />
              {errors.suggested_duration_seconds && (
                <p className="text-sm text-destructive">{errors.suggested_duration_seconds.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_active">Status</Label>
              <Select
                value={watch('is_active') ? 'active' : 'inactive'}
                onValueChange={(val) => setValue('is_active', val === 'active')}
                disabled={isLoading}
              >
                <SelectTrigger id="is_active">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tip (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="tip">
              Tip (Optional) <span className="text-xs text-muted-foreground">({tip?.length || 0}/200)</span>
            </Label>
            <Textarea
              id="tip"
              {...register('tip')}
              placeholder="Optional tip to help users answer this question..."
              rows={2}
              maxLength={200}
              disabled={isLoading}
            />
            {errors.tip && <p className="text-sm text-destructive">{errors.tip.message}</p>}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : question ? 'Update Question' : 'Create Question'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

