import React from 'react';
import { usePortfolioStore } from '@/store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  PieChart,
  List,
  Sparkles,
  Calculator,
  BookOpen,
  TrendingUp
} from 'lucide-react';
import type { TabType } from '@/types';
import { formatCurrency } from '@/utils/format';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SideNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const navItems: { id: TabType; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'overview',  label: '资产配置', icon: PieChart,    desc: '总览与图表'  },
  { id: 'holdings',  label: '持仓明细', icon: List,        desc: '持仓列表'    },
  { id: 'ai',        label: 'AI 评估',  icon: Sparkles,    desc: '智能分析'    },
  { id: 'rebalance', label: '调仓计算', icon: Calculator,  desc: '再平衡建议'  },
  { id: 'review',    label: '复盘日记', icon: BookOpen,    desc: '历史记录'    },
];

export const SideNav: React.FC<SideNavProps> = ({ activeTab, onTabChange }) => {
  const { portfolio, analysis } = usePortfolioStore();
  const hasRiskAlerts = analysis?.risks && analysis.risks.length > 0;

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-[rgba(2,6,23,0.98)] border-r border-white/[0.08] flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">WealthOS</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">个人资产管理</p>
          </div>
        </div>

        {/* Portfolio summary */}
        {portfolio && (
          <div className="mt-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">总资产</p>
            <p className="text-base font-bold text-white font-mono-number">
              {formatCurrency(portfolio.totalAssets)}
            </p>
            <p className={`text-xs mt-0.5 font-medium ${
              portfolio.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {portfolio.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(portfolio.unrealizedPnL)}
              {' '}({portfolio.unrealizedPnLPercent >= 0 ? '+' : ''}{portfolio.unrealizedPnLPercent.toFixed(2)}%)
            </p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left group relative',
                isActive
                  ? 'bg-indigo-500/15 border border-indigo-500/25 text-indigo-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
              )}
            >
              <div className="relative">
                <Icon className="w-4.5 h-4.5" strokeWidth={isActive ? 2.5 : 2} style={{ width: 18, height: 18 }} />
                {item.id === 'ai' && hasRiskAlerts && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                )}
              </div>
              <div>
                <p className={cn(
                  'text-sm font-medium leading-none',
                  isActive ? 'text-indigo-300' : ''
                )}>
                  {item.label}
                </p>
                <p className="text-[10px] text-slate-600 mt-0.5">{item.desc}</p>
              </div>

              {isActive && (
                <div className="absolute right-2 w-1 h-4 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom gradient line */}
      <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent" />
    </aside>
  );
};
