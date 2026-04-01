import React, { useEffect } from 'react';
import { usePortfolioStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Sparkles, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  RefreshCw
} from 'lucide-react';

export const AIAnalysisPage: React.FC = () => {
  const { analysis, fetchAnalysis, runAnalysis, isLoadingAnalysis } = usePortfolioStore();

  useEffect(() => {
    fetchAnalysis();
  }, []);

  if (isLoadingAnalysis || !analysis) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { healthScore, ratingDistribution, risks, summary } = analysis;
  
  // Calculate distribution percentages
  const totalHoldings = summary.totalHoldings || 1;
  const distData = [
    { key: 'strong-buy', label: '强烈持有', color: '#10b981', count: ratingDistribution['strong-buy'] || 0 },
    { key: 'buy', label: '持有', color: '#3b82f6', count: ratingDistribution['buy'] || 0 },
    { key: 'neutral', label: '观望', color: '#f59e0b', count: ratingDistribution['neutral'] || 0 },
    { key: 'reduce', label: '减仓', color: '#f97316', count: ratingDistribution['reduce'] || 0 },
    { key: 'sell', label: '清仓', color: '#ef4444', count: ratingDistribution['sell'] || 0 },
  ];

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getHealthText = (score: number) => {
    if (score >= 80) return '优秀';
    if (score >= 60) return '良好';
    return '需优化';
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* AI Header */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border border-purple-500/20 rounded-xl">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/25">
          AI
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">智能评估报告</h2>
          <p className="text-sm text-slate-400">基于技术面+市场面双维度评估</p>
        </div>
      </div>

      {/* Health Score */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <CardContent className="pt-4">
            <p className={`text-3xl font-bold font-mono-number mb-1 ${getHealthColor(healthScore)}`}>
              {healthScore}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">组合健康度</p>
            <p className={`text-xs mt-1 ${getHealthColor(healthScore)}`}>
              {getHealthText(healthScore)}
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-4">
            <p className={`text-xl font-bold font-mono-number mb-1 ${
              summary.weakHoldings > 2 ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {summary.weakHoldings > 2 ? '偏高' : '正常'}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">集中度风险</p>
            <p className="text-xs text-slate-500 mt-1">
              弱势持仓: {summary.weakHoldings}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">持仓评级分布</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {distData.map((item) => {
              const percentage = (item.count / totalHoldings) * 100;
              return (
                <div key={item.key} className="flex items-center gap-3">
                  <div className="w-14 text-xs" style={{ color: item.color }}>
                    {item.label}
                  </div>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <div className="w-8 text-right text-xs text-slate-500">
                    {item.count}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Risk Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <CardTitle className="text-base">风险警报 ({risks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {risks.length === 0 ? (
            <p className="text-sm text-slate-500">暂无风险警报</p>
          ) : (
            <div className="space-y-4">
              {risks.map((risk, index) => (
                <div key={index} className="border-l-2 border-red-500/50 pl-3">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm text-slate-300">{risk.message}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      risk.severity === 'high' 
                        ? 'bg-red-500/20 text-red-400' 
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {risk.count || risk.percentage || '注意'}
                    </span>
                  </div>
                  {risk.holdings && (
                    <p className="text-xs text-slate-500">
                      {risk.holdings.join('、')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">分析摘要</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <p className="text-2xl font-bold text-white font-mono-number">{summary.totalHoldings}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">总持仓</p>
            </div>
            <div className="text-center p-3 bg-emerald-500/10 rounded-lg">
              <p className="text-2xl font-bold text-emerald-400 font-mono-number">{summary.strongHoldings}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider">强势持仓</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Refresh Button */}
      <Button 
        onClick={runAnalysis} 
        isLoading={isLoadingAnalysis}
        className="w-full"
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        重新分析
      </Button>
    </div>
  );
};
