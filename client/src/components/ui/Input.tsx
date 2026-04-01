import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-4 py-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500',
            'focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20',
            'transition-all duration-200',
            error && 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
