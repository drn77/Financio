'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Props } from './model';

export function TextInput({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  disabled = false,
  required = false,
  autoComplete,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      <Label>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>

      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={!!error}
      />

      {error && (
        <span className="text-sm text-destructive">{error}</span>
      )}
    </div>
  );
}
