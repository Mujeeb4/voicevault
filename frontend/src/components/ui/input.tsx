/**
 * Input Component (shadcn/ui pattern)
 * Following .cursorrules component patterns
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    const errorId = error && props.id ? `${props.id}-error` : undefined;
    const describedBy = [props['aria-describedby'], errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-lg border border-input bg-background/65 px-3 py-2 text-sm text-foreground ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:border-primary/55 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-error-500 focus-visible:ring-error-500',
            className
          )}
          ref={ref}
          {...props}
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={describedBy}
        />
        {error && (
          <p id={errorId} className="mt-1 text-sm text-error-500" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
