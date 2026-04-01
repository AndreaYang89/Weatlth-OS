import React, { useEffect } from 'react';
import { usePortfolioStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/utils/format';
import { Calculator, TrendingDown, TrendingUp, AlertCircle, FileText } from 'lucide-react';

export const RebalancePage: React.FC = () => {
  const { rebalance, fetchRebalance, isLoadingRebalance } = usePortfolioStore();

  useEffect(() => {
    fetchRebalance();
  }, []);

  if (isLoadingRebalance) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!rebalance || rebalance.recommendations.length === 0) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">再平衡计算器</h2>
        </div>

        <Card>
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
              <Calculator className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-400 mb-2">暂无调仓建议</p>
            <p className="text-sm text-slate-500">您的投资组合状态良好</p>
          </CardContent>
        </Card>

        <Button onClick={fetchRebalance} className="w-full">
          重新计算
        </Button>
      </div>
    );
  }

  const { recommendations, summary, portfolioHealth, riskLevel } = rebalance;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-emerald-400';
      case 'medium': return 'text-amber-400';
      case 'high': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getRiskText = (level: string) => {
    switch (level) {
      case 'low': return '低风险';
      case 'medium': return '中等风险';
      case 'high': return '高风险';
      default: return '未知';
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-5 h-5 text-blue-400" />
        <h2 className="text-lg font-bold text-white">再平衡计算器</h2>
      </div>

      <p className="text-sm text-slate-400">
        基于技术面评级与市场情况的调仓建议
      </p>

      {/* Recommendations */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          {recommendations.map((rec, index) => (
            <div 
              key={index}
              className={`flex items-center justify-between p-3 rounded-xl border-l-2 ${
                rec.action === 'buy' 
                  ? 'bg-emerald-500/5 border-emerald-500' 
                  : rec.action === 'sell'
                  ? 'bg-red-500/5 border-red-500'
                  : 'bg-amber-500/5 border-amber-500'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white">{rec.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    rec.action === 'buy'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : rec.action === 'sell'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {rec.reason}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  评级: {rec.actionText} | 市场: {rec.marketReason}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-bold font-mono-number ${
                  rec.action === 'buy' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {rec.action === 'buy' ? '+' : '-'}{formatCurrency(rec.suggestedAmount)}
                </p>
                <p className="text-[10px] text-slate-500">
                  {rec.isNew ? '新建仓' : rec.action === 'reduce' ? '减仓50%' : rec.action === 'sell' ? '清仓' : '买入'}
                </p>
              </div>
            </div>
          ))}

          {/* Summary */}
          <div className="border-t border-slate-700/50 pt-3 mt-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">预计卖出</span>
              <span className="text-red-400 font-mono-number">{formatCurrency(summary.totalSell)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-400">预计买入</span>
              <span className="text-emerald-400 font-mono-number">{formatCurrency(summary.totalBuy)}</span>
            </div>
            <div className="flex justify-between text-sm mt-2 pt-2 border-t border-slate-700/30">
              <span className="text-slate-400">净调整</span>
              <span className={`font-mono-number font-bold ${
                summary.netAdjustment >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {summary.netAdjustment >= 0 ? '+' : ''}{formatCurrency(summary.netAdjustment)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">组合状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <p className={`text-2xl font-bold font-mono-number ${
                portfolioHealth >= 80 ? 'text-emerald-400' : portfolioHealth >= 60 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {portfolioHealth}
              </p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">健康度</p>
            </div>
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <p className={`text-xl font-bold ${getRiskColor(riskLevel)}`}>
                {getRiskText(riskLevel)}
              </p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">风险等级</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Button */}
      <Button className="w-full">
        <FileText className="w-4 h-4 mr-2" />
        生成交易清单
      </Button>
    </div>
  );
};
