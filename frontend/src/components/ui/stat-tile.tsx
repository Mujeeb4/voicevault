import * as React from 'react';
import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

/** Compact metric card: label, big number, small hint. */
export function StatTile({ label, value, hint, icon, className }: StatTileProps) {
  return (
    <div className={cn('surface p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">{icon}</span>}
      </div>
      <p className="num mt-3 text-3xl font-semibold text-foreground">{value}</p>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
