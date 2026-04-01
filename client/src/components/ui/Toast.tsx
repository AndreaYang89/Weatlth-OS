import React from 'react';
import { useToastStore } from '@/store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

interface ToastProps {
  toast: { id: string; message: string; type: 'success' | 'error' | 'warning' | 'info' };
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  };

  const styles = {
    success: 'bg-emerald-500/90 text-white',
    error: 'bg-red-500/90 text-white',
    warning: 'bg-amber-500/90 text-white',
    info: 'bg-blue-500/90 text-white',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm',
        'animate-fade-in min-w-[280px] max-w-md',
        styles[toast.type]
      )}
    >
      {icons[toast.type]}
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
