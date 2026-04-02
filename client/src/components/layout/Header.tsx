import React from 'react';
import { usePortfolioStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { TrendingUp } from 'lucide-react';

interface HeaderProps { title: string; subtitle?: string; }

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { portfolio } = usePortfolioStore();
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-stone-200">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#D97757] to-[#B85E3C] flex items-center justify-center shadow-sm">
            <TrendingUp className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-stone-800 tracking-tight">{title}</h1>
            {subtitle && <p className="text-[10px] text-stone-400 uppercase tracking-wider">{subtitle}</p>}
          </div>
        </div>
        {portfolio && (
          <div className="text-right">
            <p className="text-[10px] text-stone-400 uppercase tracking-wider">总资产</p>
            <p className="text-sm font-bold text-stone-800 font-mono-number">{formatCurrency(portfolio.totalAssets)}</p>
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(217,119,87,0.4)] to-transparent" />
    </header>
  );
};
