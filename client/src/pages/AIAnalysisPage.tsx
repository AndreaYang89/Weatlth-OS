import React, { useEffect, useState } from 'react';
import { usePortfolioStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Sparkles,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  BarChart3,
  Bot,
} from 'lucide-react';
import type { AnalyzedHolding, Recommendation } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

const OVERALL_META: Record<string, { label: string; color: string; bg: string }> = {
  'strong-buy': { label: '强烈买入', color: '#10b981', bg: 'bg-emerald-500/10' },
  'buy':        { label: '买入',     color: '#3b82f6', bg: 'bg-blue-500/10' },
  'neutral':    { label: '观望',     color: '#f59e0b', bg: 'bg-amber-500/10' },
  'reduce':     { label: '减仓',     color: '#f97316', bg: 'bg-orange-500/10' },
  'sell':       { label: '清仓',     color: '#ef4444', bg: 'bg-red-500/10' },
};

const TECHNICAL_COLOR: Record<string, string> = {
  strong: '#10b981', good: '#3b82f6', neutral: '#f59e0b', bad: '#f97316', weak: '#ef4444',
};
const TECHNICAL_LABEL: Record<string, string> = {
  strong: '强势', good: '良好', neutral: '中性', bad: '偏弱', weak: '弱势',
};
const MARKET_COLOR: Record<string, string> = {
  hot: '#ef4444', warm: '#f97316', cool: '#3b82f6', cold: '#6b7280',
};
const MARKET_LABEL: Record<string, string> = {
  hot: '热门', warm: '偏热', cool: '偏冷', cold: '冷门',
};
const ACTION_META: Record<string, { label: string; color: string }> = {
  sell:   { label: '清仓', color: '#ef4444' },
  reduce: { label: '减仓', color: '#f97316' },
  hold:   { label: '持有', color: '#3b82f6' },
  buy:    { label: '买入', color: '#10b981' },
};

function Stars({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className="w-3 h-3"
          fill={i <= count ? '#f59e0b' : 'none'}
          stroke={i <= count ? '#f59e0b' : '#d1d5db'}
        />
      ))}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <span className="text-xs font-bold font-mono-number px-1.5 py-0.5 rounded" style={{ color, background: color + '18' }}>
      {score}
    </span>
  );
}

// ── Per-Holding Row ────────────────────────────────────────────────────────────

function HoldingRow({ h }: { h: AnalyzedHolding }) {
  const [expanded, setExpanded] = useState(false);
  const om = OVERALL_META[h.overallRating] || OVERALL_META['neutral'];
  const tc = TECHNICAL_COLOR[h.technicalRating] || '#f59e0b';
  const tl = TECHNICAL_LABEL[h.technicalRating] || h.technicalRating;
  const mc = MARKET_COLOR[h.marketRating] || '#6b7280';
  const ml = MARKET_LABEL[h.marketRating] || h.marketRating;
  const pnlPositive = (h.unrealizedPnLPercent ?? 0) >= 0;

  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-stone-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Rating badge */}
        <span
          className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${om.bg}`}
          style={{ color: om.color }}
        >
          {om.label}
        </span>

        {/* Name */}
        <span className="flex-1 min-w-0">
          <span className="text-sm font-medium text-stone-800 truncate block">{h.name}</span>
          <span className="text-xs text-stone-400">{h.symbol}</span>
        </span>

        {/* Stars + score */}
        <span className="flex items-center gap-1.5 shrink-0">
          <Stars count={h.starRating || 3} />
          <ScoreBadge score={h.aiScore || 50} />
        </span>

        {expanded ? <ChevronUp className="w-4 h-4 text-stone-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-stone-50 space-y-2.5 border-t border-stone-100">
          {/* Key metrics grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-white rounded-lg border border-stone-100">
              <p className="text-xs text-stone-400 mb-0.5">技术面</p>
              <p className="text-sm font-semibold" style={{ color: tc }}>{tl}</p>
              {h.technicalDetail && <p className="text-xs text-stone-400 mt-0.5 leading-tight">{h.technicalDetail}</p>}
            </div>
            <div className="text-center p-2 bg-white rounded-lg border border-stone-100">
              <p className="text-xs text-stone-400 mb-0.5">市场热度</p>
              <p className="text-sm font-semibold" style={{ color: mc }}>{ml}</p>
              {h.marketDetail && <p className="text-xs text-stone-400 mt-0.5 leading-tight">{h.marketDetail}</p>}
            </div>
            <div className="text-center p-2 bg-white rounded-lg border border-stone-100">
              <p className="text-xs text-stone-400 mb-0.5">建议策略</p>
              <p className="text-sm font-semibold text-stone-700">{h.strategy}</p>
            </div>
          </div>

          {/* PnL + market value */}
          <div className="flex gap-2 text-xs text-stone-500">
            <span>市值 <span className="font-mono-number text-stone-700">¥{(h.marketValue || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</span></span>
            <span className="text-stone-300">|</span>
            <span>
              浮盈亏{' '}
              <span className={`font-mono-number font-semibold ${pnlPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                {pnlPositive ? '+' : ''}{(h.unrealizedPnLPercent ?? 0).toFixed(2)}%
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Recommendation Row ─────────────────────────────────────────────────────────

function RecommendationRow({ rec }: { rec: Recommendation }) {
  const meta = ACTION_META[rec.action] || ACTION_META['hold'];
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-stone-100 last:border-0">
      <span
        className="shrink-0 mt-0.5 text-xs font-bold px-1.5 py-0.5 rounded"
        style={{ color: meta.color, background: meta.color + '18' }}
      >
        {meta.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800">
          {rec.name}
          {rec.isNew && <span className="ml-1.5 text-xs text-purple-500 bg-purple-50 px-1 py-0.5 rounded">新增</span>}
        </p>
        <p className="text-xs text-stone-400 mt-0.5">{rec.reason}{rec.marketReason ? ` · ${rec.marketReason}` : ''}</p>
      </div>
      {rec.suggestedAmount != null && (
        <span className="shrink-0 text-xs text-stone-400 font-mono-number">
          ¥{rec.suggestedAmount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
        </span>
      )}
      <span className={`shrink-0 text-xs px-1 py-0.5 rounded ${rec.priority === 'high' ? 'bg-red-50 text-red-400' : rec.priority === 'medium' ? 'bg-amber-50 text-amber-500' : 'bg-stone-100 text-stone-400'}`}>
        {rec.priority === 'high' ? '高优' : rec.priority === 'medium' ? '中优' : '低优'}
      </span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export const AIAnalysisPage: React.FC = () => {
  const { analysis, fetchAnalysis, runAnalysis, isLoadingAnalysis, analysisError } = usePortfolioStore();
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    await runAnalysis();
    setIsRunning(false);
  };

  if (isLoadingAnalysis && !analysis) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#D97757] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (analysisError || !analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-stone-500 text-sm">{analysisError || '暂无分析数据'}</p>
        <button
          onClick={fetchAnalysis}
          className="px-4 py-2 text-sm bg-[rgba(217,119,87,0.08)] border border-[#D97757]/30 text-[#D97757] rounded-lg hover:bg-[rgba(217,119,87,0.12)] transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  const { healthScore, ratingDistribution, risks, summary, holdings = [], provider, recommendations = [] } = analysis;
  const totalHoldings = summary.totalHoldings || 1;

  const distData = [
    { key: 'strong-buy', label: '强烈买入', color: '#10b981', count: ratingDistribution['strong-buy'] || 0 },
    { key: 'buy',        label: '买入',     color: '#3b82f6', count: ratingDistribution['buy'] || 0 },
    { key: 'neutral',    label: '观望',     color: '#f59e0b', count: ratingDistribution['neutral'] || 0 },
    { key: 'reduce',     label: '减仓',     color: '#f97316', count: ratingDistribution['reduce'] || 0 },
    { key: 'sell',       label: '清仓',     color: '#ef4444', count: ratingDistribution['sell'] || 0 },
  ];

  const healthColor = healthScore >= 80 ? 'text-emerald-500' : healthScore >= 60 ? 'text-amber-500' : 'text-red-500';
  const healthLabel = healthScore >= 80 ? '优秀' : healthScore >= 60 ? '良好' : '需优化';

  // Compute sector exposure from holdings
  const sectorMap: Record<string, { value: number; count: number }> = {};
  let totalValue = 0;
  holdings.forEach(h => {
    const cat = h.category || '其他';
    if (!sectorMap[cat]) sectorMap[cat] = { value: 0, count: 0 };
    sectorMap[cat].value += h.marketValue || 0;
    sectorMap[cat].count += 1;
    totalValue += h.marketValue || 0;
  });
  const sectors = Object.entries(sectorMap)
    .map(([name, d]) => ({ name, ...d, pct: totalValue > 0 ? (d.value / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  const SECTOR_COLORS = ['#D97757', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  return (
    <div className="space-y-4 animate-fade-in pb-6">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border border-purple-500/20 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900">AI 智能评估报告</h2>
            <p className="text-xs text-stone-500">技术面 + 市场面双维度分析</p>
          </div>
        </div>
        {provider && (
          <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-600 font-medium">
            {provider}
          </span>
        )}
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <CardContent className="pt-3 pb-3">
            <p className={`text-2xl font-bold font-mono-number ${healthColor}`}>{healthScore}</p>
            <p className="text-xs text-stone-400 mt-0.5">健康度</p>
            <p className={`text-xs font-medium mt-0.5 ${healthColor}`}>{healthLabel}</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-3 pb-3">
            <p className="text-2xl font-bold font-mono-number text-emerald-500">{summary.strongHoldings}</p>
            <p className="text-xs text-stone-400 mt-0.5">强势持仓</p>
            <p className="text-xs text-stone-400 mt-0.5">{totalHoldings} 只共</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-3 pb-3">
            <p className={`text-2xl font-bold font-mono-number ${summary.weakHoldings > 1 ? 'text-red-500' : 'text-stone-400'}`}>
              {summary.weakHoldings}
            </p>
            <p className="text-xs text-stone-400 mt-0.5">弱势持仓</p>
            <p className="text-xs text-stone-400 mt-0.5">均分 {summary.averageScore}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-stone-400" />
            评级分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {distData.map(item => (
              <div key={item.key} className="flex items-center gap-2">
                <div className="w-12 text-xs" style={{ color: item.color }}>{item.label}</div>
                <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(item.count / totalHoldings) * 100}%`, backgroundColor: item.color }}
                  />
                </div>
                <div className="w-6 text-right text-xs text-stone-400">{item.count}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sector Exposure */}
      {sectors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">板块分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sectors.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-14 text-xs text-stone-600 truncate">{s.name}</div>
                  <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${s.pct}%`, backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
                    />
                  </div>
                  <div className="w-10 text-right text-xs text-stone-400">{s.pct.toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Holding Breakdown */}
      {holdings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              逐仓 AI 评估
              <span className="ml-auto text-xs text-stone-400 font-normal">点击展开详情</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {holdings
                .slice()
                .sort((a, b) => (b.aiScore || 50) - (a.aiScore || 50))
                .map(h => (
                  <HoldingRow key={h._id || h.symbol} h={h} />
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Alerts */}
      {risks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              风险预警
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-normal ${risks.filter(r => r.severity === 'high').length > 0 ? 'bg-red-100 text-red-500' : 'bg-amber-100 text-amber-500'}`}>
                {risks.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {risks.map((risk, idx) => (
                <div key={idx} className={`border-l-2 pl-3 ${risk.severity === 'high' ? 'border-red-400' : 'border-amber-400'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm text-stone-700">{risk.message}</span>
                    <span className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
                      risk.severity === 'high' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'
                    }`}>
                      {risk.severity === 'high' ? '高风险' : '中风险'}
                    </span>
                  </div>
                  {risk.holdings && risk.holdings.length > 0 && (
                    <p className="text-xs text-stone-400 mt-1">{risk.holdings.join('、')}</p>
                  )}
                  {risk.percentage != null && (
                    <p className="text-xs text-stone-400 mt-1">占比 {risk.percentage}%</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rebalance Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              行动建议
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              {recommendations.map((rec, idx) => (
                <RecommendationRow key={idx} rec={rec} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reanalyze button */}
      <Button
        onClick={handleRunAnalysis}
        isLoading={isRunning || isLoadingAnalysis}
        className="w-full"
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        重新分析（调用 AI）
      </Button>

      <p className="text-center text-xs text-stone-400">
        点击「重新分析」将调用当前配置的 AI 对所有持仓进行评估
      </p>
    </div>
  );
};
