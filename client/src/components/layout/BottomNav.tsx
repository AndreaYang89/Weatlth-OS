import React from 'react';
import { usePortfolioStore } from '@/store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  PieChart,
  List,
  Sparkles,
  Calculator,
  BookOpen
} from 'lucide-react';
import type { TabType } from '@/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const { analysis } = usePortfolioStore();
  
  const hasRiskAlerts = analysis?.risks && analysis.risks.length > 0;

  const navItems: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'overview',  label: '配置', icon: PieChart   },
    { id: 'holdings',  label: '持仓', icon: List       },
    { id: 'ai',        label: 'AI',   icon: Sparkles   },
    { id: 'rebalance', label: '计算', icon: Calculator },
    { id: 'review',    label: '复盘', icon: BookOpen   },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[rgba(2,6,23,0.95)] backdrop-blur-xl border-t border-white/[0.08] pb-safe">
      <div className="max-w-lg mx-auto flex justify-around">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'flex flex-col items-center gap-1 py-2 px-4 relative transition-all duration-200',
                isActive ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-400'
              )}
            >
              <div className="relative">
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                
                {/* AI badge for risk alerts */}
                {item.id === 'ai' && hasRiskAlerts && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                )}
              </div>
              
              <span className={cn(
                'text-[11px] font-semibold tracking-wide',
                isActive && 'text-shadow-[0_0_20px_rgba(99,102,241,0.5)]'
              )}>
                {item.label}
              </span>
              
              {/* Active indicator */}
              {isActive && (
                <span className="absolute top-0 w-5 h-0.5 bg-indigo-500 rounded-b-full shadow-[0_0_10px_rgba(99,102,241,1)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
