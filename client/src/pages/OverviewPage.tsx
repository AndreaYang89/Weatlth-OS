import React, { useEffect } from 'react';
import { usePortfolioStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  formatCurrency, 
  formatPercentage, 
  getValueColor,
  getCategoryColor 
} from '@/utils/format';
import { 
  TrendingUp, 
  Plus, 
  Sparkles, 
  AlertTriangle,
  Activity,
  BarChart3,
  Target,
  Percent
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface OverviewPageProps {
  onAddHolding: () => void;
  onNavigateToAI: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onAddHolding, onNavigateToAI }) => {
  const { portfolio, topHoldings, fetchPortfolio, isLoadingPortfolio, portfolioError } = usePortfolioStore();

  useEffect(() => {
    fetchPortfolio();
  }, []);

  if (isLoadingPortfolio) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (portfolioError || !portfolio) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-slate-400 text-sm">{portfolioError || '暂无数据'}</p>
        <button
          onClick={fetchPortfolio}
          className="px-4 py-2 text-sm bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  const pnl = portfolio.unrealizedPnL;
  const pnlPercent = portfolio.unrealizedPnLPercent;
  const isPositive = pnl >= 0;

  // Prepare chart data
  const chartData = portfolio.allocation.map(item => ({
    name: item.category,
    value: item.percentage,
    color: item.color,
  }));

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Total Assets Card */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-slate-400 mb-1">总资产估值</p>
          <p className="text-3xl font-bold text-white font-mono-number tracking-tight">
            {formatCurrency(portfolio.totalAssets)}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
              isPositive 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              <TrendingUp className="w-3 h-3" />
              {formatCurrency(pnl)} ({formatPercentage(pnlPercent)})
            </span>
            <span className="text-xs text-slate-500">
              更新于 {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Allocation Chart */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-5">
            {/* Donut Chart */}
            <div className="relative w-[120px] h-[120px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">配置</span>
                <span className="text-xl font-bold text-white font-mono-number">
                  {portfolio.allocation.length}类
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-2">
              {portfolio.allocation.slice(0, 3).map((item) => (
                <div key={item.category} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-slate-300">{item.category}</span>
                  </div>
                  <span className="text-sm font-medium text-white font-mono-number">
                    {item.percentage.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Alert */}
      {portfolio.riskMetrics.concentrationRisk === 'high' && (
        <div 
          onClick={onNavigateToAI}
          className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl cursor-pointer hover:bg-amber-500/10 transition-colors"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400 mb-1">AI评估发现风险</p>
            <p className="text-xs text-slate-400">
              单一板块占比过高，建议分散投资。点击查看调仓方案 →
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onAddHolding}
          className="flex flex-col items-center gap-2 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/25 transition-colors">
            <Plus className="w-5 h-5" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">记一笔</p>
            <p className="text-xs text-slate-500">买入/卖出</p>
          </div>
        </button>

        <button
          onClick={onNavigateToAI}
          className="flex flex-col items-center gap-2 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:bg-purple-500/10 hover:border-purple-500/30 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/25 transition-colors">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">AI诊断</p>
            <p className="text-xs text-slate-500">智能评估</p>
          </div>
        </button>
      </div>

      {/* Risk Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-white font-mono-number mb-1">
              {portfolio.riskMetrics.beta.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Beta系数</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-4">
            <p className={`text-2xl font-bold font-mono-number mb-1 ${
              portfolio.riskMetrics.sharpeRatio >= 1 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {portfolio.riskMetrics.sharpeRatio.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">夏普比率</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-amber-400 font-mono-number mb-1">
              {portfolio.riskMetrics.maxDrawdown.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">最大回撤</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-blue-400 font-mono-number mb-1">
              {portfolio.riskMetrics.winRate.toFixed(0)}%
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">胜率</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
