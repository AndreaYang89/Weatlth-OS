import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  Bookmark,
  Building2,
  Calendar,
  Newspaper,
  Plus,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import { stockApi } from '@/api/services';
import { useToastStore } from '@/store';
import type {
  HoldingDraft,
  StockAIAnalysis,
  StockAnalystRating,
  StockFinancial,
  StockHistoryPoint,
  StockKeyEvent,
  StockNews,
  StockQuote,
  StockTechnical,
  StockValuation,
  WatchlistItem,
} from '@/types';

interface StockDetailPageProps {
  symbol: string;
  onBack: () => void;
  onAddHolding?: (draft: HoldingDraft) => void;
}

type TabKey = 'overview' | 'fundamental' | 'technical' | 'events' | 'ai';
type HistoryPeriod = '1m' | '3m' | '6m' | '1y';

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

const ratingLabels: Record<StockAnalystRating['rating'], string> = {
  strong_buy: '强烈买入',
  buy: '买入',
  hold: '持有',
  reduce: '减持',
  sell: '卖出',
};

const eventTypeLabels: Record<StockKeyEvent['eventType'], string> = {
  earnings: '业绩',
  dividend: '分红',
  meeting: '会议',
  other: '事件',
};

function mapIndustryToCategory(industry?: string) {
  return categoryMap[industry || ''] || '其他';
}

function formatPercent(value?: number) {
  if (value === undefined) return '--';
  return `${(value * 100).toFixed(1)}%`;
}

function formatAmount(value?: number) {
  if (value === undefined) return '--';
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
  if (value >= 1e4) return `${(value / 1e4).toFixed(2)}万`;
  return value.toFixed(2);
}

function ratingTone(rating: StockAnalystRating['rating']) {
  if (rating === 'strong_buy') return 'bg-green-100 text-green-700';
  if (rating === 'buy') return 'bg-blue-100 text-blue-700';
  if (rating === 'hold') return 'bg-amber-100 text-amber-700';
  if (rating === 'reduce') return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

function eventTone(type: StockKeyEvent['eventType']) {
  if (type === 'earnings') return 'bg-[#D97757]';
  if (type === 'dividend') return 'bg-blue-500';
  if (type === 'meeting') return 'bg-violet-500';
  return 'bg-stone-400';
}

export const StockDetailPage: React.FC<StockDetailPageProps> = ({ symbol, onBack, onAddHolding }) => {
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [togglingWatchlist, setTogglingWatchlist] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<StockQuote | undefined>();
  const [valuation, setValuation] = useState<StockValuation | undefined>();
  const [financial, setFinancial] = useState<StockFinancial | undefined>();
  const [technical, setTechnical] = useState<StockTechnical | undefined>();
  const [aiAnalysis, setAiAnalysis] = useState<StockAIAnalysis | undefined>();
  const [news, setNews] = useState<StockNews[]>([]);
  const [keyEvents, setKeyEvents] = useState<StockKeyEvent[]>([]);
  const [ratings, setRatings] = useState<StockAnalystRating[]>([]);
  const [history, setHistory] = useState<StockHistoryPoint[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('3m');
  const [watchlistItem, setWatchlistItem] = useState<WatchlistItem | null>(null);
  const { addToast } = useToastStore();

  useEffect(() => {
    setActiveTab('overview');
    setHistoryPeriod('3m');
  }, [symbol]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      const [
        quoteRes,
        valRes,
        finRes,
        techRes,
        aiRes,
        newsRes,
        eventsRes,
        ratingsRes,
        checkRes,
      ] = await Promise.allSettled([
        stockApi.getQuote(symbol),
        stockApi.getValuation(symbol),
        stockApi.getFinancial(symbol),
        stockApi.getTechnical(symbol),
        stockApi.getAIAnalysis(symbol),
        stockApi.getNews(symbol),
        stockApi.getKeyEvents(symbol),
        stockApi.getAnalystRatings(symbol),
        stockApi.checkWatchlist(symbol),
      ]);

      if (cancelled) return;

      const hasQuote = quoteRes.status === 'fulfilled' && quoteRes.value.data?.data;
      if (!hasQuote) {
        setError('数据加载失败，请稍后重试');
        setLoading(false);
        return;
      }

      setQuote(quoteRes.status === 'fulfilled' ? quoteRes.value.data?.data : undefined);
      setValuation(valRes.status === 'fulfilled' ? valRes.value.data?.data : undefined);
      setFinancial(finRes.status === 'fulfilled' ? finRes.value.data?.data : undefined);
      setTechnical(techRes.status === 'fulfilled' ? techRes.value.data?.data : undefined);
      setAiAnalysis(aiRes.status === 'fulfilled' ? aiRes.value.data?.data : undefined);
      setNews(newsRes.status === 'fulfilled' ? newsRes.value.data?.data ?? [] : []);
      setKeyEvents(eventsRes.status === 'fulfilled' ? eventsRes.value.data?.data ?? [] : []);
      setRatings(ratingsRes.status === 'fulfilled' ? ratingsRes.value.data?.data ?? [] : []);

      if (checkRes.status === 'fulfilled') {
        const check = checkRes.value.data?.data;
        setWatchlistItem(
          check?.inWatchlist && check.id
            ? {
                id: check.id,
                symbol,
                name: '',
                group: check.group ?? 'watching',
                source: check.source,
                createdAt: '',
                updatedAt: '',
              }
            : null
        );
      } else {
        setWatchlistItem(null);
      }

      setLoading(false);
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const response = await stockApi.getHistory(symbol, historyPeriod);
        if (!cancelled) {
          setHistory(response.data?.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setHistory([]);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    };

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [historyPeriod, symbol]);

  const tabs = useMemo<{ key: TabKey; label: string }[]>(
    () => [
      { key: 'overview', label: '概览' },
      { key: 'fundamental', label: '基本面' },
      { key: 'technical', label: '技术面' },
      { key: 'events', label: '事件' },
      { key: 'ai', label: 'AI 分析' },
    ],
    []
  );

  const chartData = useMemo(
    () =>
      history.map((point) => ({
        date: point.date.slice(5),
        price: point.close,
        volume: point.volume,
      })),
    [history]
  );

  const renderStars = (score: number, size: 'sm' | 'md' = 'md') => {
    const rating = Math.round((score / 100) * 5);
    const sizeClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';

    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${star <= rating ? 'star-filled fill-[#D97757]' : 'star-empty'}`}
          />
        ))}
      </div>
    );
  };

  const renderPercentileBar = (percentile: number) => {
    const color =
      percentile < 30 ? 'percentile-low' : percentile > 70 ? 'percentile-high' : 'percentile-mid';

    return (
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
          <div className={`${color} h-full rounded-full`} style={{ width: `${percentile}%` }} />
        </div>
        <span className="w-8 text-xs text-stone-500">{percentile}%</span>
      </div>
    );
  };

  const handleToggleWatchlist = async () => {
    if (!quote) return;
    if (watchlistItem?.source === 'holding') {
      addToast('该标的已由持仓自动同步，请在持仓中管理', 'info');
      return;
    }

    setTogglingWatchlist(true);
    try {
      if (watchlistItem) {
        await stockApi.removeFromWatchlist(watchlistItem.id);
        setWatchlistItem(null);
        addToast('已从关注列表移除', 'success');
      } else {
        const response = await stockApi.addToWatchlist({
          symbol,
          name: quote.name,
          group: 'watching',
        });
        setWatchlistItem(response.data.data ?? null);
        addToast('已加入关注列表', 'success');
      }
    } catch (toggleError: any) {
      addToast(toggleError.response?.data?.message || '关注操作失败', 'error');
    } finally {
      setTogglingWatchlist(false);
    }
  };

  const handleAddHolding = () => {
    if (!quote) return;
    if (watchlistItem?.source === 'holding') {
      addToast('该标的已在持仓中', 'info');
      return;
    }

    onAddHolding?.({
      symbol,
      name: quote.name,
      currentPrice: quote.price,
      category: mapIndustryToCategory(quote.industry),
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#D97757] border-t-transparent" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-stone-500">
        <div className="text-center">
          <p className="mb-4 text-lg">{error || '未找到股票数据'}</p>
          <button onClick={onBack} className="text-sm text-[#D97757] hover:underline">
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const isUp = quote.changePercent >= 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-500 transition-colors hover:text-stone-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">返回关注列表</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleToggleWatchlist()}
            disabled={togglingWatchlist || watchlistItem?.source === 'holding'}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              watchlistItem?.source === 'holding'
                ? 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400'
                : watchlistItem
                  ? 'border-[#D97757]/30 bg-[#D97757]/10 text-[#D97757]'
                  : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Bookmark className="h-4 w-4" />
              {watchlistItem?.source === 'holding' ? '持仓同步' : togglingWatchlist ? '处理中...' : watchlistItem ? '已关注' : '加入关注'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleAddHolding}
            disabled={watchlistItem?.source === 'holding'}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium ${
              watchlistItem?.source === 'holding' ? 'cursor-not-allowed bg-stone-200 text-stone-500' : 'btn-solid'
            }`}
          >
            <Plus className="h-4 w-4" />
            {watchlistItem?.source === 'holding' ? '已在持仓' : '加入持仓'}
          </button>
        </div>
      </div>

      <div className="glass relative overflow-hidden rounded-2xl p-5">
        <div className="card-top-line" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <h1 className="text-xl font-bold text-[#1C1917]">{quote.name}</h1>
              <span className="rounded-lg bg-stone-100 px-2 py-0.5 text-sm text-stone-500">{symbol}</span>
              {watchlistItem && (
                <span className="tag-watching rounded-full px-2 py-0.5 text-xs font-medium">
                  已在关注列表
                </span>
              )}
            </div>
            {quote.industry && <p className="text-sm text-stone-500">{quote.industry}</p>}
          </div>
          <div className="text-right">
            <div className="font-mono-number text-3xl font-bold text-[#1C1917]">¥{quote.price.toFixed(2)}</div>
            <div className={`mt-1 flex items-center justify-end gap-1 text-sm font-medium ${isUp ? 'price-up' : 'price-down'}`}>
              {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{isUp ? '+' : ''}{quote.changePercent.toFixed(2)}%</span>
              <span>({isUp ? '+' : ''}{quote.change.toFixed(2)})</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-stone-100 pt-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: '开盘', value: quote.open !== undefined ? `¥${quote.open.toFixed(2)}` : '--' },
            { label: '最高', value: quote.high !== undefined ? `¥${quote.high.toFixed(2)}` : '--' },
            { label: '最低', value: quote.low !== undefined ? `¥${quote.low.toFixed(2)}` : '--' },
            { label: '成交量', value: formatAmount(quote.volume) },
            { label: '成交额', value: formatAmount(quote.amount) },
            { label: '总市值', value: formatAmount(quote.marketCap) },
          ].map((item) => (
            <div key={item.label}>
              <div className="text-xs text-stone-400">{item.label}</div>
              <div className="font-mono-number text-sm font-medium text-stone-700">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {aiAnalysis && (
        <div className="glass relative overflow-hidden rounded-2xl p-5">
          <div className="card-top-line" />
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-700">AI 综合评估</h2>
            <div className="flex items-center gap-2">
              {renderStars(aiAnalysis.overallScore)}
              <span className="text-xs text-stone-400">{aiAnalysis.overallScore}分</span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-stone-600">{aiAnalysis.summary}</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: '基本面', score: aiAnalysis.fundamentalScore },
              { label: '估值', score: aiAnalysis.valuationScore },
              { label: '技术面', score: aiAnalysis.technicalScore },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-stone-50 p-3 text-center">
                <div className="mb-1 text-xs text-stone-500">{item.label}</div>
                <div className="text-lg font-bold text-[#D97757]">{item.score}</div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-stone-200">
                  <div className="h-full rounded-full bg-[#D97757]" style={{ width: `${item.score}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-stone-400">
            建议：{recommendationLabels[aiAnalysis.recommendation] || aiAnalysis.recommendation}
          </div>
        </div>
      )}

      <div className="flex gap-0 border-b border-stone-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`-mb-px border-b-2 px-5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-[#D97757] text-[#D97757]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="glass relative overflow-hidden rounded-2xl p-5">
            <div className="card-top-line" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-stone-700">价格走势</h3>
              <div className="flex items-center gap-2">
                {(['1m', '3m', '6m', '1y'] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setHistoryPeriod(period)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                      historyPeriod === period
                        ? 'border-[#D97757]/30 bg-[#D97757]/10 text-[#D97757]'
                        : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700'
                    }`}
                  >
                    {period.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-72 rounded-xl bg-stone-50/60">
              {historyLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D97757] border-t-transparent" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-stone-400">
                  暂无历史行情
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D97757" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#D97757" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(231,229,228,0.8)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#78716c' }}
                      tickLine={false}
                      axisLine={false}
                      domain={[
                        (dataMin: number) => Math.floor(dataMin - 2),
                        (dataMax: number) => Math.ceil(dataMax + 2),
                      ]}
                      tickFormatter={(value) => `¥${Number(value).toFixed(0)}`}
                      width={54}
                    />
                    <Tooltip
                      formatter={(value) => [`¥${Number(value).toFixed(2)}`, '收盘价']}
                      labelFormatter={(label) => `日期 ${String(label)}`}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid rgba(231,229,228,1)',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#D97757"
                      strokeWidth={2.25}
                      fill="url(#priceFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {technical && (
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 sm:grid-cols-4">
                <div className="rounded-xl bg-green-50 p-3">
                  <div className="mb-1 text-xs text-stone-400">支撑位</div>
                  <div className="text-sm font-semibold text-green-700">
                    {technical.support1 !== undefined ? `¥${technical.support1.toFixed(2)}` : '--'}
                  </div>
                </div>
                <div className="rounded-xl bg-green-50/70 p-3">
                  <div className="mb-1 text-xs text-stone-400">次级支撑</div>
                  <div className="text-sm font-semibold text-green-600">
                    {technical.support2 !== undefined ? `¥${technical.support2.toFixed(2)}` : '--'}
                  </div>
                </div>
                <div className="rounded-xl bg-red-50/70 p-3">
                  <div className="mb-1 text-xs text-stone-400">压力位</div>
                  <div className="text-sm font-semibold text-red-600">
                    {technical.resistance1 !== undefined ? `¥${technical.resistance1.toFixed(2)}` : '--'}
                  </div>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <div className="mb-1 text-xs text-stone-400">强压力</div>
                  <div className="text-sm font-semibold text-red-700">
                    {technical.resistance2 !== undefined ? `¥${technical.resistance2.toFixed(2)}` : '--'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {valuation && (
              <div className="glass relative overflow-hidden rounded-2xl p-5">
                <div className="card-top-line" />
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-stone-700">
                  <Building2 className="h-4 w-4 text-[#D97757]" />
                  估值概览
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="mb-1 text-xs text-stone-400">PE (TTM)</div>
                    <div className="font-semibold text-stone-800">{valuation.peTtm.toFixed(1)}x</div>
                    <div className="mt-2">{renderPercentileBar(valuation.pePercentile)}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-stone-400">PB</div>
                    <div className="font-semibold text-stone-800">{valuation.pb.toFixed(2)}x</div>
                    <div className="mt-2">{renderPercentileBar(valuation.pbPercentile)}</div>
                  </div>
                </div>
              </div>
            )}

            {financial && (
              <div className="glass relative overflow-hidden rounded-2xl p-5">
                <div className="card-top-line" />
                <h3 className="mb-4 text-sm font-semibold text-stone-700">财务健康度</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'ROE', value: formatPercent(financial.roe) },
                    { label: '毛利率', value: formatPercent(financial.grossMargin) },
                    {
                      label: '营收增速',
                      value: financial.revenueGrowth !== undefined ? `${financial.revenueGrowth.toFixed(1)}%` : '--',
                    },
                    { label: '负债率', value: formatPercent(financial.debtRatio) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-stone-50 p-3">
                      <div className="mb-1 text-xs text-stone-400">{item.label}</div>
                      <div className="text-base font-semibold text-stone-800">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'fundamental' && (
        <div className="space-y-4">
          {valuation && (
            <div className="glass relative overflow-hidden rounded-2xl p-5">
              <div className="card-top-line" />
              <h3 className="mb-4 text-sm font-semibold text-stone-700">详细估值</h3>
              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-stone-500">PE(TTM)</span>
                      <span className="font-medium text-stone-800">{valuation.peTtm.toFixed(2)}</span>
                    </div>
                    {renderPercentileBar(valuation.pePercentile)}
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-stone-500">PB</span>
                      <span className="font-medium text-stone-800">{valuation.pb.toFixed(2)}</span>
                    </div>
                    {renderPercentileBar(valuation.pbPercentile)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 lg:grid-cols-4">
                  <div className="rounded-xl bg-stone-50 p-3 text-center">
                    <div className="mb-1 text-xs text-stone-400">行业平均PE</div>
                    <div className="font-semibold text-stone-800">
                      {valuation.peIndustryAvg !== undefined ? valuation.peIndustryAvg.toFixed(1) : '--'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-3 text-center">
                    <div className="mb-1 text-xs text-stone-400">行业平均PB</div>
                    <div className="font-semibold text-stone-800">
                      {valuation.pbIndustryAvg !== undefined ? valuation.pbIndustryAvg.toFixed(2) : '--'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-3 text-center">
                    <div className="mb-1 text-xs text-stone-400">PS</div>
                    <div className="font-semibold text-stone-800">
                      {valuation.ps !== undefined ? valuation.ps.toFixed(2) : '--'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-3 text-center">
                    <div className="mb-1 text-xs text-stone-400">PEG</div>
                    <div className="font-semibold text-stone-800">
                      {valuation.peg !== undefined ? valuation.peg.toFixed(2) : '--'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {financial && (
            <div className="glass relative space-y-4 overflow-hidden rounded-2xl p-5">
              <div className="card-top-line" />
              <h3 className="text-sm font-semibold text-stone-700">财务指标</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'ROE', value: formatPercent(financial.roe) },
                  { label: '毛利率', value: formatPercent(financial.grossMargin) },
                  { label: '净利率', value: formatPercent(financial.netMargin) },
                  { label: '资产负债率', value: formatPercent(financial.debtRatio) },
                  {
                    label: '营收增速',
                    value: financial.revenueGrowth !== undefined ? `${financial.revenueGrowth.toFixed(1)}%` : '--',
                  },
                  {
                    label: '利润增速',
                    value: financial.profitGrowth !== undefined ? `${financial.profitGrowth.toFixed(1)}%` : '--',
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-stone-50 p-3">
                    <div className="mb-1 text-xs text-stone-400">{item.label}</div>
                    <div className="text-base font-semibold text-stone-800">{item.value}</div>
                  </div>
                ))}
              </div>
              {aiAnalysis?.fundamentalAnalysis && (
                <p className="border-t border-stone-100 pt-4 text-sm leading-relaxed text-stone-600">
                  {aiAnalysis.fundamentalAnalysis}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'technical' && technical && (
        <div className="glass relative space-y-4 overflow-hidden rounded-2xl p-5">
          <div className="card-top-line" />
          <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-700">
            <TrendingUp className="h-4 w-4 text-[#D97757]" />
            技术指标
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-stone-50 p-3 text-center">
              <div className="mb-1 text-xs text-stone-400">趋势</div>
              <div
                className={`text-sm font-semibold ${
                  technical.trend === 'up' ? 'price-up' : technical.trend === 'down' ? 'price-down' : 'text-stone-600'
                }`}
              >
                {technical.trend === 'up' ? '上升' : technical.trend === 'down' ? '下降' : '震荡'}
              </div>
            </div>
            <div className="rounded-xl bg-stone-50 p-3 text-center">
              <div className="mb-1 text-xs text-stone-400">RSI(14)</div>
              <div
                className={`text-sm font-semibold ${
                  technical.rsi > 70 ? 'price-down' : technical.rsi < 30 ? 'price-up' : 'text-stone-700'
                }`}
              >
                {technical.rsi.toFixed(1)}
              </div>
            </div>
            <div className="rounded-xl bg-stone-50 p-3 text-center">
              <div className="mb-1 text-xs text-stone-400">信号</div>
              <div
                className={`text-sm font-semibold ${
                  technical.signal === 'bullish'
                    ? 'price-up'
                    : technical.signal === 'bearish'
                      ? 'price-down'
                      : 'text-stone-600'
                }`}
              >
                {technical.signal === 'bullish' ? '多头' : technical.signal === 'bearish' ? '空头' : '中性'}
              </div>
            </div>
          </div>

          {(technical.ma5 !== undefined || technical.ma20 !== undefined || technical.macd !== undefined) && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'MA5', value: technical.ma5 },
                { label: 'MA20', value: technical.ma20 },
                { label: 'MACD', value: technical.macd },
                { label: 'MACD Signal', value: technical.macdSignal },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-stone-50 p-3">
                  <div className="mb-1 text-xs text-stone-400">{item.label}</div>
                  <div className="text-sm font-semibold text-stone-800">
                    {item.value !== undefined && item.value !== null ? item.value.toFixed(2) : '--'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {technical.signals && technical.signals.length > 0 && (
            <div className="space-y-2 border-t border-stone-100 pt-3">
              <div className="text-xs font-medium uppercase tracking-wider text-stone-500">技术信号</div>
              {technical.signals.map((signal, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <span className={signal.type === 'buy' ? 'price-up' : signal.type === 'sell' ? 'price-down' : 'text-stone-400'}>
                    {signal.type === 'buy' ? '▲' : signal.type === 'sell' ? '▼' : '●'}
                  </span>
                  <span className="text-stone-600">{signal.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="glass relative overflow-hidden rounded-2xl p-5">
              <div className="card-top-line" />
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-stone-700">
                <Calendar className="h-4 w-4 text-[#D97757]" />
                关键事件
              </h3>
              {keyEvents.length === 0 ? (
                <div className="py-8 text-center text-sm text-stone-400">暂无关键事件</div>
              ) : (
                <div className="space-y-3">
                  {keyEvents.map((event) => (
                    <div key={event.id} className="flex gap-3 rounded-xl bg-stone-50 p-3">
                      <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${eventTone(event.eventType)}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-stone-800">{event.title}</p>
                          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
                            {eventTypeLabels[event.eventType]}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-stone-400">{event.eventDate}</div>
                        {event.description && <p className="mt-1 text-xs text-stone-500">{event.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass relative overflow-hidden rounded-2xl p-5">
              <div className="card-top-line" />
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-stone-700">
                <Newspaper className="h-4 w-4 text-[#D97757]" />
                最新动态
              </h3>
              {news.length === 0 ? (
                <div className="py-8 text-center text-sm text-stone-400">暂无新闻</div>
              ) : (
                <div className="space-y-3">
                  {news.map((item, index) => (
                    <div key={item.id ?? `${item.title}-${index}`} className="rounded-xl bg-stone-50 p-3">
                      <p className="text-sm font-medium leading-snug text-stone-800">{item.title}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-stone-400">
                        <span>{item.source}</span>
                        <span>·</span>
                        <span>{item.publishTime ?? item.time}</span>
                        <span
                          className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            item.sentiment === 'positive'
                              ? 'bg-green-50 text-green-600'
                              : item.sentiment === 'negative'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {item.sentiment === 'positive' ? '利好' : item.sentiment === 'negative' ? '利空' : '中性'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="glass relative overflow-hidden rounded-2xl p-5">
            <div className="card-top-line" />
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-stone-700">
              <Building2 className="h-4 w-4 text-[#D97757]" />
              机构评级
            </h3>
            {ratings.length === 0 ? (
              <div className="py-8 text-center text-sm text-stone-400">暂无机构评级</div>
            ) : (
              <div className="space-y-3">
                {ratings.map((rating, index) => (
                  <div key={`${rating.analyst || 'rating'}-${index}`} className="flex items-center justify-between rounded-xl bg-stone-50 p-3">
                    <div>
                      <div className="text-sm font-medium text-stone-800">{rating.analyst || '机构评级'}</div>
                      <div className="mt-1 text-xs text-stone-400">{rating.date}</div>
                    </div>
                    <div className="text-right">
                      <span className={`rounded px-2 py-1 text-xs font-medium ${ratingTone(rating.rating)}`}>
                        {ratingLabels[rating.rating]}
                      </span>
                      {rating.targetPrice !== undefined && (
                        <div className="mt-1 text-xs text-stone-500">目标价 ¥{rating.targetPrice.toFixed(2)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="space-y-4">
          {aiAnalysis ? (
            <>
              <div className="glass relative overflow-hidden rounded-2xl p-5">
                <div className="card-top-line" />
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-700">AI 评分拆解</h3>
                    <p className="mt-1 text-xs text-stone-400">
                      综合建议：{recommendationLabels[aiAnalysis.recommendation] || aiAnalysis.recommendation}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-[#1C1917]">{aiAnalysis.overallScore}</div>
                    <div className="text-xs text-stone-400">综合分</div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: '基本面', score: aiAnalysis.fundamentalScore },
                    { label: '估值', score: aiAnalysis.valuationScore },
                    { label: '技术面', score: aiAnalysis.technicalScore },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-stone-50 p-4">
                      <div className="mb-1 text-xs text-stone-400">{item.label}</div>
                      <div className="text-xl font-semibold text-stone-800">{item.score}</div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
                        <div className="h-full rounded-full bg-[#D97757]" style={{ width: `${item.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="glass relative overflow-hidden rounded-2xl p-5">
                  <div className="card-top-line" />
                  <h3 className="mb-3 text-sm font-semibold text-stone-700">分析摘要</h3>
                  <p className="text-sm leading-relaxed text-stone-600">{aiAnalysis.summary}</p>
                </div>

                <div className="glass relative overflow-hidden rounded-2xl p-5">
                  <div className="card-top-line" />
                  <h3 className="mb-3 text-sm font-semibold text-stone-700">风险提示</h3>
                  {aiAnalysis.risks && aiAnalysis.risks.length > 0 ? (
                    <div className="space-y-2">
                      {aiAnalysis.risks.map((risk, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm text-stone-600">
                          <span className="mt-0.5 text-red-500">!</span>
                          <span>{risk}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-stone-400">暂无额外风险提示</div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {[
                  { title: '估值视角', content: aiAnalysis.valuationAnalysis },
                  { title: '技术视角', content: aiAnalysis.technicalAnalysis },
                  { title: '基本面视角', content: aiAnalysis.fundamentalAnalysis },
                ].map((item) => (
                  <div key={item.title} className="glass relative overflow-hidden rounded-2xl p-5">
                    <div className="card-top-line" />
                    <h3 className="mb-3 text-sm font-semibold text-stone-700">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-stone-600">{item.content || '暂无分析结论'}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="glass rounded-2xl p-12 text-center text-stone-400">暂无 AI 分析数据</div>
          )}
        </div>
      )}
    </div>
  );
};
