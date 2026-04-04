import React, { useEffect, useMemo } from 'react';
import { usePortfolioStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/utils/format';
import {
  ClipboardList,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  CircleDot,
} from 'lucide-react';

const actionMeta: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  buy: { label: '可考虑加仓', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', icon: TrendingUp },
  reduce: { label: '考虑减仓', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', icon: TrendingDown },
  sell: { label: '考虑退出', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: TrendingDown },
  hold: { label: '继续观察', color: 'text-stone-600', bg: 'bg-stone-50 border-stone-200', icon: Minus },
};

export const RebalancePage: React.FC = () => {
  const {
    analysis,
    holdings,
    fetchAnalysis,
    fetchHoldings,
    runAnalysis,
    isLoadingAnalysis,
  } = usePortfolioStore();

  useEffect(() => {
    if (!analysis) {
      fetchAnalysis();
    }
    if (holdings.length === 0) {
      fetchHoldings();
    }
  }, []);

  const recommendations = analysis?.recommendations ?? [];

  const planSummary = useMemo(() => {
    const buy = recommendations.filter(rec => rec.action === 'buy').length;
    const reduce = recommendations.filter(rec => rec.action === 'reduce').length;
    const sell = recommendations.filter(rec => rec.action === 'sell').length;
    const hold = recommendations.filter(rec => rec.action === 'hold').length;
    const totalValue = holdings.reduce((sum, holding) => sum + (holding.marketValue || 0), 0);

    return { buy, reduce, sell, hold, totalValue };
  }, [holdings, recommendations]);

  if (isLoadingAnalysis && !analysis) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D97757] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#D97757]/10 text-[#D97757]">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-stone-900">行动计划</h2>
          <p className="text-sm text-stone-500">把复杂调仓建议改成更适合个人投资者的下一步动作</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '可加仓', value: planSummary.buy, color: 'text-emerald-600' },
          { label: '可减仓', value: planSummary.reduce, color: 'text-orange-600' },
          { label: '可退出', value: planSummary.sell, color: 'text-red-600' },
          { label: '继续观察', value: planSummary.hold, color: 'text-stone-600' },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4 text-center">
              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
              <div className="mt-1 text-xs text-stone-400">{item.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">当前组合基线</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-3">
          <div className="rounded-xl bg-stone-50 p-3">
            <div className="text-xs text-stone-400">持仓数量</div>
            <div className="mt-1 text-lg font-semibold text-stone-800">{holdings.length}</div>
          </div>
          <div className="rounded-xl bg-stone-50 p-3">
            <div className="text-xs text-stone-400">持仓总市值</div>
            <div className="mt-1 text-lg font-semibold text-stone-800">{formatCurrency(planSummary.totalValue)}</div>
          </div>
          <div className="rounded-xl bg-stone-50 p-3">
            <div className="text-xs text-stone-400">AI 健康度</div>
            <div className="mt-1 text-lg font-semibold text-stone-800">{analysis?.healthScore ?? '--'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">本期建议动作</CardTitle>
          <Button onClick={runAnalysis} variant="secondary" className="h-8 px-3 text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            重新生成
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {recommendations.length === 0 ? (
            <div className="py-10 text-center text-sm text-stone-400">
              暂时没有新的动作建议，当前组合可以先继续观察。
            </div>
          ) : (
            recommendations.map((rec, index) => {
              const meta = actionMeta[rec.action] || actionMeta.hold;
              const Icon = meta.icon;

              return (
                <div key={`${rec.symbol}-${index}`} className={`rounded-2xl border p-4 ${meta.bg}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                        <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
                        <span className="text-sm font-medium text-stone-800">{rec.name}</span>
                        <span className="text-xs text-stone-400">{rec.symbol}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-stone-600">{rec.reason}</p>
                      {rec.marketReason && (
                        <p className="mt-1 text-xs text-stone-500">市场背景：{rec.marketReason}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="rounded-full bg-white/80 px-2 py-1 text-xs text-stone-500">
                        {rec.priority === 'high' ? '高优先级' : rec.priority === 'medium' ? '中优先级' : '低优先级'}
                      </div>
                      {rec.suggestedAmount !== undefined && (
                        <div className="mt-2 text-sm font-semibold text-stone-800">
                          {formatCurrency(rec.suggestedAmount)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">使用建议</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-stone-600">
          <div className="flex items-start gap-2">
            <CircleDot className="mt-0.5 h-4 w-4 text-[#D97757]" />
            不建议把这里当成自动交易指令，更适合做每周一次的持仓检查清单。
          </div>
          <div className="flex items-start gap-2">
            <CircleDot className="mt-0.5 h-4 w-4 text-[#D97757]" />
            如果你平时更偏手动交易，可以只关注“高优先级”和“考虑退出”两类提示。
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
