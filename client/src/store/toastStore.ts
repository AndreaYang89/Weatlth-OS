import { create } from 'zustand';
import type { Toast } from '@/types';

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  
  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ 
      toasts: [...state.toasts, { id, message, type }] 
    }));
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      set((state) => ({ 
        toasts: state.toasts.filter((t) => t.id !== id) 
      }));
    }, 3000);
  },
  
  removeToast: (id) => {
    set((state) => ({ 
      toasts: state.toasts.filter((t) => t.id !== id) 
    }));
  },
  
  clearToasts: () => set({ toasts: [] }),
}));
