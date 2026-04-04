import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Star, Trash2, RefreshCw, TrendingUp } from 'lucide-react';

import { stockApi } from '@/api/services';
import { useToastStore } from '@/store';
import type { HoldingDraft, Stock, WatchlistItemWithData } from '@/types';

interface WatchlistPageProps {
  onSelectStock: (symbol: string) => void;
  onAddHolding?: (draft: HoldingDraft) => void;
}

type FilterType = 'all' | 'holding' | 'watching' | 'custom';

const recommendationLabels: Record<string, string> = {
  buy: '买入',
  hold: '观望',
  sell: '减持',
};

const categoryMap: Record<string, string> = {
  白酒: '消费',
  消费: '消费',
  家电: '消费',
  互联网: '互联网',
  科技: '科技',
  半导体: '科技',
  新能源: '新能源',
  光伏: '新能源',
  汽车: '新能源',
  银行: '金融',
  券商: '金融',
  医药: '医药',
  ETF: '其他',
};

function mapIndustryToCategory(industry?: string) {
  return categoryMap[industry || ''] || '其他';
}

function AddWatchlistModal({
  isOpen,
  existingSymbols,
  onClose,
  onAdded,
}: {
  isOpen: boolean;
  existingSymbols: string[];
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<'watching' | 'custom'>('watching');
  const [results, setResults] = useState<Stock[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const { addToast } = useToastStore();

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setGroup('watching');
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await stockApi.searchStocks(trimmed);
        setResults(response.data.data ?? []);
      } catch (error: any) {
        addToast(error.response?.data?.message || '搜索股票失败', 'error');
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [addToast, isOpen, query]);

  const handleAdd = async (stock: Stock) => {
    setIsAdding(stock.symbol);
    try {
      await stockApi.addToWatchlist({
        symbol: stock.symbol,
        name: stock.name,
        group,
      });
      addToast(`${stock.name} 已加入关注列表`, 'success');
      await onAdded();
      onClose();
    } catch (error: any) {
      addToast(error.response?.data?.message || '添加关注失败', 'error');
    } finally {
      setIsAdding(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-3xl border border-stone-200 bg-white shadow-2xl overflow-hidden animate-fade-in">
        <div className="border-b border-stone-100 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-stone-900">添加关注</h2>
              <p className="mt-1 text-xs text-stone-500">搜索股票或 ETF，并直接加入主项目的关注列表</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-700"
            >
              关闭
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="输入股票代码或名称，例如 600519 / 腾讯"
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-4 text-sm text-stone-700 outline-none transition focus:border-[#D97757]/50 focus:bg-white"
              />
            </div>
            <div className="flex items-center gap-1 rounded-2xl border border-stone-200 bg-stone-50 p-1">
              {[
                { key: 'watching', label: '观察中' },
                { key: 'custom', label: '自选股' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setGroup(option.key as typeof group)}
                  className={`rounded-xl px-3 py-2 text-sm transition ${
                    group === option.key ? 'bg-[#D97757] text-white' : 'text-stone-500 hover:bg-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {query.trim().length < 2 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-8 text-center text-sm text-stone-400">
              输入至少 2 个字符开始搜索
            </div>
          ) : isSearching ? (
            <div className="p-8 text-center text-sm text-stone-500">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#D97757] border-t-transparent" />
              正在搜索可添加的标的...
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-8 text-center text-sm text-stone-400">
              没找到匹配标的，试试股票代码或更短的关键字
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((stock) => {
                const alreadyAdded = existingSymbols.includes(stock.symbol);
                return (
                  <div
                    key={stock.symbol}
                    className="flex items-center gap-3 rounded-2xl border border-stone-200 px-4 py-3 transition hover:border-[#D97757]/30 hover:bg-stone-50"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-sm font-semibold text-stone-700">
                      {stock.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-stone-900">{stock.name}</p>
                        <span className="rounded-lg bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500">{stock.symbol}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-stone-500">
                        {stock.industry || '股票'} · {stock.market}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={alreadyAdded || isAdding === stock.symbol}
                      onClick={() => handleAdd(stock)}
                      className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                        alreadyAdded
                          ? 'cursor-not-allowed bg-stone-100 text-stone-400'
                          : 'bg-[#D97757] text-white hover:bg-[#c26a4d]'
                      }`}
                    >
                      {alreadyAdded ? '已关注' : isAdding === stock.symbol ? '添加中...' : '加入'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const WatchlistPage: React.FC<WatchlistPageProps> = ({ onSelectStock, onAddHolding }) => {
  const [watchlist, setWatchlist] = useState<WatchlistItemWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { addToast } = useToastStore();

  const loadWatchlist = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);

    try {
      const response = await stockApi.getWatchlist();
      const items = response.data.data ?? [];

      const itemsWithData = await Promise.all(
        items.map(async (item) => {
          const [quoteRes, valuationRes, aiRes] = await Promise.allSettled([
            stockApi.getQuote(item.symbol),
            stockApi.getValuation(item.symbol),
            stockApi.getAIAnalysis(item.symbol),
          ]);

          return {
            ...item,
            quote: quoteRes.status === 'fulfilled' ? quoteRes.value.data?.data : undefined,
            valuation: valuationRes.status === 'fulfilled' ? valuationRes.value.data?.data : undefined,
            aiAnalysis: aiRes.status === 'fulfilled' ? aiRes.value.data?.data : undefined,
          };
        })
      );

      setWatchlist(itemsWithData);
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || '数据加载失败，请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadWatchlist();

    const timer = window.setInterval(() => {
      void loadWatchlist(true);
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const filteredWatchlist = useMemo(() => {
    let result = watchlist;
    if (activeFilter !== 'all') {
      result = result.filter((item) => item.group === activeFilter);
    }
    if (searchQuery.trim()) {
      const keyword = searchQuery.toLowerCase();
      result = result.filter(
        (item) => item.name.toLowerCase().includes(keyword) || item.symbol.toLowerCase().includes(keyword)
      );
    }
    return result;
  }, [watchlist, activeFilter, searchQuery]);

  const stats = useMemo(() => ({
    total: watchlist.length,
    holding: watchlist.filter((item) => item.group === 'holding').length,
    watching: watchlist.filter((item) => item.group === 'watching').length,
    undervalued: watchlist.filter((item) => item.valuation && item.valuation.pePercentile < 30).length,
  }), [watchlist]);

  const renderStars = (score: number) => {
    const rating = Math.round((score / 100) * 5);
    return (
      <div className="flex items-center justify-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3.5 w-3.5 ${star <= rating ? 'star-filled fill-[#D97757]' : 'star-empty'}`}
          />
        ))}
      </div>
    );
  };

  const renderPercentileBar = (percentile: number) => {
    const colorClass =
      percentile < 30 ? 'percentile-low' : percentile > 70 ? 'percentile-high' : 'percentile-mid';

    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-200">
          <div className={`${colorClass} h-full rounded-full`} style={{ width: `${percentile}%` }} />
        </div>
        <span className="text-xs text-stone-500">{percentile}%</span>
      </div>
    );
  };

  const groupBadgeClass = (group: string) => (
    group === 'holding' ? 'tag-holding' : group === 'watching' ? 'tag-watching' : 'tag-custom'
  );

  const groupLabel = (group: string) => (
    group === 'holding' ? '持仓中' : group === 'watching' ? '观察中' : '自选股'
  );

  const handleRemove = async (id: string) => {
    // 乐观更新：先从本地 state 移除，失败时还原
    const snapshot = watchlist;
    setWatchlist(prev => prev.filter(item => item.id !== id));
    try {
      await stockApi.removeFromWatchlist(id);
      addToast('已从关注列表移除', 'success');
    } catch (removeError: any) {
      setWatchlist(snapshot); // 还原
      addToast(removeError.response?.data?.message || '移除失败', 'error');
    }
  };

  const openHoldingModal = (item: WatchlistItemWithData) => {
    if (item.source === 'holding') return;

    onAddHolding?.({
      symbol: item.symbol,
      name: item.name,
      currentPrice: item.quote?.price,
      category: mapIndustryToCategory(item.quote?.industry),
    });
  };

  return (
    <div className="min-h-screen pb-8 animate-fade-in">
      <AddWatchlistModal
        isOpen={isAddOpen}
        existingSymbols={watchlist.map((item) => item.symbol)}
        onClose={() => setIsAddOpen(false)}
        onAdded={() => loadWatchlist(true)}
      />

      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#1C1917]">我的关注</h1>
          <p className="mt-0.5 text-sm text-stone-500">已纳入主项目数据模型，可与持仓联动管理</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadWatchlist(true)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 transition hover:border-stone-300 hover:text-stone-800"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="btn-solid flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            添加关注
          </button>
        </div>
      </div>

      <div className="glass relative mb-6 overflow-hidden rounded-2xl p-4">
        <div className="card-top-line" />
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="搜索股票代码、名称..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-white/60 py-2 pl-9 pr-4 text-sm focus:border-[#D97757]/50 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white/50 p-1">
            {(['all', 'holding', 'watching', 'custom'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeFilter === key ? 'bg-[#D97757]/10 text-[#D97757]' : 'text-stone-500 hover:bg-stone-100'
                }`}
              >
                {key === 'all' ? '全部' : groupLabel(key)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="glass relative overflow-hidden rounded-2xl">
        <div className="card-top-line" />
        {loading ? (
          <div className="p-12 text-center text-stone-500">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#D97757] border-t-transparent" />
            加载中...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">{error}</div>
        ) : filteredWatchlist.length === 0 ? (
          <div className="p-12 text-center text-stone-500">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <p>暂无关注标的</p>
            <p className="mt-1 text-xs text-stone-400">可以先添加关注，或从持仓中自动同步已有标的</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-stone-200/50">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-stone-500">股票</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">现价</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">涨跌</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-stone-500">估值分位</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-stone-500">AI评分</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-stone-500">分组</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredWatchlist.map((item) => (
                  <tr
                    key={item.id}
                    className="group cursor-pointer transition-colors hover:bg-white/50"
                    onClick={() => onSelectStock(item.symbol)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-stone-100 to-stone-50 text-sm font-semibold text-stone-600">
                          {item.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-[#1C1917]">{item.name}</div>
                          <div className="flex items-center gap-2 text-xs text-stone-500">
                            <span>{item.symbol}</span>
                            {item.source === 'holding' && (
                              <span className="rounded bg-[#D97757]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#D97757]">
                                持仓同步
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[#1C1917]">
                      {item.quote ? `¥${item.quote.price.toFixed(2)}` : '--'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.quote ? (
                        <>
                          <div className={`text-sm font-medium ${item.quote.changePercent >= 0 ? 'price-up' : 'price-down'}`}>
                            {item.quote.changePercent >= 0 ? '+' : ''}{item.quote.changePercent.toFixed(2)}%
                          </div>
                          <div className="text-xs text-stone-400">
                            {item.quote.change >= 0 ? '+' : ''}{item.quote.change.toFixed(2)}
                          </div>
                        </>
                      ) : (
                        <span className="text-stone-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.valuation ? (
                        <>
                          {renderPercentileBar(item.valuation.pePercentile)}
                          <div className="mt-0.5 text-xs text-stone-400">PE: {item.valuation.peTtm.toFixed(1)}</div>
                        </>
                      ) : (
                        <span className="text-stone-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.aiAnalysis ? (
                        <>
                          {renderStars(item.aiAnalysis.overallScore)}
                          <div className="mt-0.5 text-xs text-stone-400">
                            {recommendationLabels[item.aiAnalysis.recommendation] || item.aiAnalysis.recommendation}
                          </div>
                        </>
                      ) : (
                        <span className="text-stone-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`${groupBadgeClass(item.group)} rounded-full px-2 py-0.5 text-xs font-medium`}>
                        {groupLabel(item.group)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openHoldingModal(item);
                          }}
                          disabled={item.source === 'holding'}
                          className={`rounded-lg px-2 py-1 text-sm font-medium transition ${
                            item.source === 'holding'
                              ? 'cursor-not-allowed text-stone-300'
                              : 'text-[#D97757] hover:bg-[#D97757]/10'
                          }`}
                        >
                          {item.source === 'holding' ? '持仓中' : '买入'}
                        </button>
                        {item.source !== 'holding' && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleRemove(item.id);
                            }}
                            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-red-500"
                            aria-label={`移除 ${item.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: '关注总数', value: stats.total, sub: '股票 · ETF', color: 'text-[#1C1917]' },
          { label: '持仓同步', value: stats.holding, sub: '由主项目持仓生成', color: 'text-[#D97757]' },
          { label: '观察中', value: stats.watching, sub: '等待买入时机', color: 'text-stone-600' },
          { label: '低估标的', value: stats.undervalued, sub: 'PE分位 < 30%', color: 'text-green-600' },
        ].map((stat) => (
          <div key={stat.label} className="glass relative overflow-hidden rounded-2xl p-4">
            <div className="card-top-line" />
            <div className="mb-1 text-xs text-stone-500">{stat.label}</div>
            <div className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</div>
            <div className="mt-1 text-xs text-stone-400">{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
