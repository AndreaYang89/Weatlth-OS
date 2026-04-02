import React from 'react';
import { usePortfolioStore } from '@/store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PieChart, List, Sparkles, Calculator, BookOpen, Receipt } from 'lucide-react';
import type { TabType } from '@/types';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface BottomNavProps { activeTab: TabType; onTabChange: (tab: TabType) => void; }

const navItems: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'overview',      label: '配置', icon: PieChart   },
  { id: 'holdings',      label: '持仓', icon: List       },
  { id: 'transactions',  label: '流水', icon: Receipt    },
  { id: 'ai',            label: 'AI',   icon: Sparkles   },
  { id: 'rebalance',     label: '计算', icon: Calculator },
  { id: 'review',        label: '复盘', icon: BookOpen   },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const { analysis } = usePortfolioStore();
  const hasRiskAlerts = analysis?.risks && analysis.risks.length > 0;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/97 backdrop-blur-xl border-t border-stone-200 pb-safe shadow-[0_-1px_12px_rgba(0,0,0,0.06)]">
      <div className="max-w-lg mx-auto flex justify-around">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 px-3 relative transition-all duration-200',
                isActive ? 'text-[#D97757]' : 'text-stone-400 hover:text-stone-600'
              )}
            >
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                {item.id === 'ai' && hasRiskAlerts && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </div>
              <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
              {isActive && (
                <span className="absolute top-0 w-6 h-0.5 bg-[#D97757] rounded-b-full shadow-[0_2px_8px_rgba(217,119,87,0.6)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
