import React, { useState, useEffect } from 'react';
import { usePortfolioStore } from '@/store';
import { Card, CardContent } from '@/components/ui/Card';
import { 
  formatCurrency, 
  formatPercentage, 
  getValueColor,
  getCategoryColor,
  getRatingInfo,
  getTechnicalTagClass,
  getMarketTagClass,
  generateStars
} from '@/utils/format';
import { Info, Filter } from 'lucide-react';
import type { Holding } from '@/types';

const filters = [
  { key: 'all', label: '全部' },
  { key: 'strong-buy', label: '强烈持有' },
  { key: 'buy', label: '持有' },
  { key: 'neutral', label: '观望' },
  { key: 'reduce', label: '减仓' },
  { key: 'sell', label: '需止损' },
];

export const HoldingsPage: React.FC = () => {
  const { holdings, fetchHoldings, isLoadingHoldings } = usePortfolioStore();
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    fetchHoldings(activeFilter === 'all' ? undefined : { rating: activeFilter });
  }, [activeFilter]);

  const filteredHoldings = activeFilter === 'all' 
    ? holdings 
    : holdings.filter(h => h.overallRating === activeFilter);

  if (isLoadingHoldings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#D97757] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Rating Legend */}
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-[#D97757]" />
          <span className="text-sm font-medium text-stone-900">评级说明</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-stone-100 rounded-lg">
            <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">技术面评级</p>
            <p className="text-xs text-stone-500">
              <span className="text-emerald-400">多头排列</span> / 
              <span className="text-amber-400">震荡</span> / 
              <span className="text-red-400">破位</span>
            </p>
          </div>
          <div className="p-2 bg-stone-100 rounded-lg">
            <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">市场热度</p>
            <p className="text-xs text-stone-500">
              <span className="text-amber-400">热门</span> / 
              <span className="text-stone-500">中性</span> / 
              <span className="text-stone-400">冷门</span>
            </p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeFilter === filter.key
                ? 'bg-indigo-500 text-stone-900 shadow-lg shadow-indigo-500/30'
                : 'bg-stone-100 text-stone-500 border border-stone-200 hover:bg-stone-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Holdings List */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-[#D97757]" />
          <h2 className="text-lg font-bold text-stone-900">持仓评级一览</h2>
          <span className="text-sm text-stone-400">({filteredHoldings.length})</span>
        </div>

        {filteredHoldings.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-stone-100 flex items-center justify-center">
              <Filter className="w-8 h-8 text-stone-400" />
            </div>
            <p className="text-stone-400">暂无持仓数据</p>
            <p className="text-xs text-stone-400 mt-1">点击"记一笔"添加您的第一笔持仓</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHoldings.map((holding) => (
              <HoldingItem key={holding._id} holding={holding} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const HoldingItem: React.FC<{ holding: Holding }> = ({ holding }) => {
  const pnl = holding.unrealizedPnL || 0;
  const pnlPercent = holding.unrealizedPnLPercent || 0;
  const pnlColor = pnl >= 0 ? '#34d399' : '#ef4444';
  const categoryColors = getCategoryColor(holding.category);
  const ratingInfo = getRatingInfo(holding.overallRating);

  return (
    <div 
      className={`flex items-center p-3.5 bg-stone-100/40 rounded-xl border border-white/5 cursor-pointer transition-all hover:bg-stone-100/60 hover:border-[#D97757]/30 hover:translate-x-0.5 relative overflow-hidden group`}
    >
      {/* Left border indicator */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1 transition-all"
        style={{ 
          backgroundColor: ratingInfo.color,
          boxShadow: `0 0 10px ${ratingInfo.color}`
        }}
      />

      {/* Icon */}
      <div 
        className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold mr-3 border border-white/10 relative overflow-hidden flex-shrink-0`}
        style={{ backgroundColor: `${pnlColor}20`, color: pnlColor }}
      >
        <span className="relative z-10">{holding.name.charAt(0)}</span>
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-semibold text-stone-900 text-sm">{holding.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${categoryColors.bg} ${categoryColors.text} border-white/10`}>
            {holding.category}
          </span>
          <span className="ml-auto flex items-center text-[11px] font-semibold" style={{ color: pnlColor }}>
            {ratingInfo.text}
            <span className="ml-1 text-amber-400 text-[10px]">
              {'★'.repeat(holding.starRating)}
              <span className="text-slate-700">{'★'.repeat(5 - holding.starRating)}</span>
            </span>
          </span>
        </div>

        {/* Rating tags */}
        <div className="flex gap-1.5 mb-1.5 flex-wrap">
          <span className={`text-[9px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${getTechnicalTagClass(holding.technicalRating)}`}>
            技术:{holding.technicalDetail || '震荡'}
          </span>
          <span className={`text-[9px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${getMarketTagClass(holding.marketRating)}`}>
            市场:{holding.marketDetail || '中性'}
          </span>
        </div>

        {/* Details */}
        <p className="text-xs text-stone-400 font-mono-number">
          {holding.shares}股 · 成本¥{holding.avgCost.toFixed(2)}
        </p>

        {/* Progress bar */}
        <div className="h-0.5 bg-stone-200 rounded-full mt-1.5 overflow-hidden">
          <div 
            className="h-full rounded-full relative overflow-hidden"
            style={{ 
              width: `${Math.min(Math.abs(pnlPercent) * 2, 100)}%`,
              backgroundColor: pnlColor
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="text-right ml-3 flex-shrink-0">
        <p className="font-bold text-sm font-mono-number" style={{ color: pnlColor }}>
          {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
        </p>
        <p className="text-xs text-stone-400 font-mono-number">
          {formatCurrency(holding.marketValue)}
        </p>
        <p className="text-[10px] mt-1" style={{ color: pnlColor }}>
          策略:{holding.strategy || '持有'}
        </p>
      </div>
    </div>
  );
};
