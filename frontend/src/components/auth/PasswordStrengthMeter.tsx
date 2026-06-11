/**
 * Password Strength Meter Component
 * Following .cursorrules component patterns
 */

'use client';

import { getPasswordStrength } from '@/lib/validations/auth';

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const { score, label, color } = getPasswordStrength(password);
  const percentage = (score / 6) * 100;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">Password strength</span>
        <span className={`text-xs font-medium ${color.replace('bg-', 'text-')}`}>{label}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

