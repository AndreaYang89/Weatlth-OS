import React from 'react';
import { useAuthStore, usePortfolioStore } from '@/store';
import { formatCurrency } from '@/utils/format';
import { TrendingUp, User, LogOut } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { user, logout } = useAuthStore();
  const { portfolio } = usePortfolioStore();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[rgba(2,6,23,0.85)] backdrop-blur-xl border-b border-white/[0.08]">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">WealthOS</h1>
          {subtitle && (
            <p className="text-[11px] text-slate-500 uppercase tracking-wider">{subtitle}</p>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {portfolio && (
            <div className="text-right">
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">总资产</p>
              <p className="text-sm font-bold text-white font-mono-number">
                {formatCurrency(portfolio.totalAssets)}
              </p>
            </div>
          )}
          
          {user && (
            <div className="relative group">
              <button className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 hover:bg-indigo-500/30 transition-colors">
                <User className="w-4 h-4" />
              </button>
              
              <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="px-4 py-2 border-b border-slate-800">
                  <p className="text-sm font-medium text-white">{user.username}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="w-full px-4 py-2 flex items-center gap-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
    </header>
  );
};
