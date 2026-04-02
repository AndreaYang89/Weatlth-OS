import React from 'react';
import { usePortfolioStore } from '@/store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PieChart, List, Sparkles, Calculator, BookOpen, TrendingUp, Upload, Settings, Receipt } from 'lucide-react';
import type { TabType } from '@/types';
import { formatCurrency } from '@/utils/format';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface SideNavProps { activeTab: TabType; onTabChange: (tab: TabType) => void; }

const mainNav: { id: TabType; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'overview',      label: '资产配置', icon: PieChart,   desc: '总览与图表'  },
  { id: 'holdings',      label: '持仓明细', icon: List,       desc: '持仓列表'    },
  { id: 'transactions',  label: '交易流水', icon: Receipt,    desc: '买卖记录'    },
  { id: 'ai',            label: 'AI 评估',  icon: Sparkles,   desc: '智能分析'    },
  { id: 'rebalance',     label: '调仓计算', icon: Calculator, desc: '再平衡建议'  },
  { id: 'review',        label: '复盘日记', icon: BookOpen,   desc: '历史记录'    },
  { id: 'import',        label: '导入资产', icon: Upload,     desc: 'CSV / Excel' },
];

export const SideNav: React.FC<SideNavProps> = ({ activeTab, onTabChange }) => {
  const { portfolio, analysis } = usePortfolioStore();
  const hasRiskAlerts = analysis?.risks && analysis.risks.length > 0;

  const NavItem = ({ item }: { item: typeof mainNav[0] }) => {
    const isActive = activeTab === item.id;
    const Icon = item.icon;
    return (
      <button
        onClick={() => onTabChange(item.id)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left relative',
          isActive
            ? 'bg-[rgba(217,119,87,0.1)] border border-[rgba(217,119,87,0.22)] text-[#C96B47]'
            : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
        )}
      >
        <div className="relative flex-shrink-0">
          <Icon style={{ width: 17, height: 17 }} strokeWidth={isActive ? 2.5 : 2} />
          {item.id === 'ai' && hasRiskAlerts && (
            <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>
        <div className="min-w-0">
          <p className={cn('text-sm font-medium leading-none', isActive ? 'text-[#D97757]' : '')}>{item.label}</p>
          <p className="text-[10px] text-stone-400 mt-0.5 truncate">{item.desc}</p>
        </div>
        {isActive && (
          <div className="absolute right-2 w-1 h-4 bg-[#D97757] rounded-full shadow-[0_0_8px_rgba(217,119,87,0.5)]" />
        )}
      </button>
    );
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-white border-r border-stone-200 flex flex-col z-50 shadow-sm">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D97757] to-[#B85E3C] flex items-center justify-center shadow-md shadow-[#D97757]/20">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-stone-800 tracking-tight">WealthOS</h1>
            <p className="text-[10px] text-stone-400 uppercase tracking-wider">个人资产管理</p>
          </div>
        </div>

        {portfolio && (
          <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-200">
            <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">总资产</p>
            <p className="text-base font-bold text-stone-800 font-mono-number">{formatCurrency(portfolio.totalAssets)}</p>
            <p className={`text-xs mt-0.5 font-medium ${portfolio.unrealizedPnL >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {portfolio.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(portfolio.unrealizedPnL)}
              {' '}({portfolio.unrealizedPnLPercent >= 0 ? '+' : ''}{portfolio.unrealizedPnLPercent.toFixed(2)}%)
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {mainNav.map(item => <NavItem key={item.id} item={item} />)}
      </nav>

      {/* Settings at bottom */}
      <div className="px-3 pb-4 border-t border-stone-100 pt-3">
        <button
          onClick={() => onTabChange('settings')}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left',
            activeTab === 'settings'
              ? 'bg-[rgba(217,119,87,0.1)] text-[#D97757]'
              : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
          )}
        >
          <Settings style={{ width: 15, height: 15 }} />
          <span className="text-xs">系统配置</span>
        </button>
      </div>

      <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-[rgba(217,119,87,0.2)] to-transparent" />
    </aside>
  );
};
