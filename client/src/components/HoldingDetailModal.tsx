import React, { useState, useEffect } from 'react';
import { usePortfolioStore, useToastStore } from '@/store';
import { transactionsApi } from '@/api/services';
import { formatCurrency } from '@/utils/format';
import {
  X, TrendingUp, Bell, BellOff, Trash2,
  ArrowDownCircle, ArrowUpCircle, ShieldAlert, Target
} from 'lucide-react';
import type { Holding, Transaction } from '@/types';

interface HoldingDetailModalProps {
  holding: Holding | null;
  onClose: () => void;
}

const inputClass =
  'w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none focus:border-[#D97757]/60 focus:ring-2 focus:ring-[#D97757]/10 transition-all font-mono-number';
const labelClass = 'block text-xs font-medium text-stone-500 mb-1.5';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

export const HoldingDetailModal: React.FC<HoldingDetailModalProps> = ({ holding, onClose }) => {
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [savingAlert, setSavingAlert] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  const { updateHolding, deleteHolding } = usePortfolioStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    if (!holding) return;
    setStopLoss(holding.stopLoss ? String(holding.stopLoss) : '');
    setTakeProfit(holding.takeProfit ? String(holding.takeProfit) : '');
    setTransactions([]);
    setLoadingTx(true);
    transactionsApi
      .getTransactions({ symbol: holding.symbol, limit: 10 })
      .then(res => setTransactions(res.data.data!.transactions))
      .catch(() => setTransactions([]))
      .finally(() => setLoadingTx(false));
  }, [holding?._id]);

  if (!holding) return null;

  const pnl = holding.unrealizedPnL ?? 0;
  const pnlPct = holding.unrealizedPnLPercent ?? 0;
  const isUp = pnl >= 0;
  const alertStatus = holding.alertTriggered;
  const hasAlert = alertStatus && alertStatus !== 'none';

  const handleSaveAlert = async () => {
    setSavingAlert(true);
    try {
      await updateHolding(holding._id, {
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
      } as any);
      addToast('止盈止损已保存', 'success');
    } catch {
      addToast('保存失败', 'error');
    } finally {
      setSavingAlert(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`确认删除 ${holding.name}（${holding.symbol}）的持仓记录？`)) return;
    setDeleting(true);
    try {
      await deleteHolding(holding._id);
      addToast('持仓已删除', 'success');
      onClose();
    } catch {
      addToast('删除失败', 'error');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl animate-fade-in overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-stone-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: `${isUp ? '#34d399' : '#ef4444'}20`, color: isUp ? '#34d399' : '#ef4444' }}
              >
                {holding.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-900">{holding.name}</h3>
                  <span className="text-xs text-stone-400 font-mono">{holding.symbol}</span>
                </div>
                <p className="text-xs text-stone-500">{holding.category} · {holding.shares} 股</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 transition-colors mt-0.5">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Alert badge */}
          {hasAlert && (
            <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
              alertStatus === 'takeProfit'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}>
              {alertStatus === 'takeProfit'
                ? <><Target className="w-3.5 h-3.5" /> 已触及止盈价 ¥{holding.takeProfit} — 建议考虑卖出</>
                : <><ShieldAlert className="w-3.5 h-3.5" /> 已触及止损价 ¥{holding.stopLoss} — 建议及时止损</>
              }
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* P&L Summary */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 text-center">
              <p className="text-[10px] text-stone-400 mb-1">成本价</p>
              <p className="text-sm font-bold text-stone-700 font-mono-number">¥{holding.avgCost.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 text-center">
              <p className="text-[10px] text-stone-400 mb-1">现价</p>
              <p className="text-sm font-bold text-stone-700 font-mono-number">¥{holding.currentPrice.toFixed(2)}</p>
            </div>
            <div
              className="p-3 rounded-xl border text-center"
              style={{ backgroundColor: `${isUp ? '#34d399' : '#ef4444'}0d`, borderColor: `${isUp ? '#34d399' : '#ef4444'}30` }}
            >
              <p className="text-[10px] text-stone-400 mb-1">浮盈</p>
              <p className="text-sm font-bold font-mono-number" style={{ color: isUp ? '#34d399' : '#ef4444' }}>
                {isUp ? '+' : ''}{pnlPct.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-stone-400">持仓市值</span>
            <span className="text-sm font-bold text-stone-800 font-mono-number">{formatCurrency(holding.marketValue)}</span>
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-stone-400">浮盈金额</span>
            <span className="text-sm font-bold font-mono-number" style={{ color: isUp ? '#34d399' : '#ef4444' }}>
              {isUp ? '+' : ''}{formatCurrency(pnl)}
            </span>
          </div>

          <div className="border-t border-stone-100" />

          {/* Stop Loss / Take Profit */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-[#D97757]" />
              <span className="text-sm font-semibold text-stone-800">价格提醒</span>
              <span className="text-xs text-stone-400">（价格刷新时自动检测）</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  <span className="text-emerald-500">▲</span> 止盈价
                </label>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="不设置"
                  value={takeProfit}
                  onChange={e => setTakeProfit(e.target.value)}
                />
                {holding.currentPrice > 0 && takeProfit && (
                  <p className="text-[10px] text-emerald-600 mt-1">
                    距止盈 {((parseFloat(takeProfit) - holding.currentPrice) / holding.currentPrice * 100).toFixed(1)}%
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>
                  <span className="text-red-400">▼</span> 止损价
                </label>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="不设置"
                  value={stopLoss}
                  onChange={e => setStopLoss(e.target.value)}
                />
                {holding.currentPrice > 0 && stopLoss && (
                  <p className="text-[10px] text-red-500 mt-1">
                    距止损 {((holding.currentPrice - parseFloat(stopLoss)) / holding.currentPrice * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={handleSaveAlert}
                disabled={savingAlert}
                className="flex-1 py-2 bg-[#D97757] text-white text-xs font-semibold rounded-xl hover:bg-[#c96947] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {savingAlert
                  ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Bell className="w-3.5 h-3.5" />
                }
                保存提醒
              </button>
              {(stopLoss || takeProfit) && (
                <button
                  onClick={() => { setStopLoss(''); setTakeProfit(''); }}
                  className="px-3 py-2 bg-stone-100 text-stone-500 text-xs rounded-xl hover:bg-stone-200 transition-colors flex items-center gap-1"
                >
                  <BellOff className="w-3.5 h-3.5" />
                  清除
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-stone-100" />

          {/* Recent Transactions */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#D97757]" />
              <span className="text-sm font-semibold text-stone-800">近期交易</span>
            </div>
            {loadingTx ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-stone-100 rounded-lg animate-pulse" />)}
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-xs text-stone-400 py-3 text-center">暂无交易记录</p>
            ) : (
              <div className="space-y-1.5">
                {transactions.map(tx => {
                  const isBuy = tx.type === 'buy';
                  return (
                    <div key={tx._id} className="flex items-center gap-2.5 py-2 border-b border-stone-50 last:border-0">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isBuy ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-400'
                      }`}>
                        {isBuy
                          ? <ArrowDownCircle style={{ width: 13, height: 13 }} />
                          : <ArrowUpCircle style={{ width: 13, height: 13 }} />
                        }
                      </div>
                      <div className="flex-1 flex items-center justify-between">
                        <span className={`text-[10px] font-medium ${isBuy ? 'text-emerald-600' : 'text-red-500'}`}>
                          {isBuy ? '买入' : '卖出'} {tx.shares}股
                        </span>
                        <span className="text-xs text-stone-500 font-mono-number">¥{tx.price.toFixed(2)}</span>
                      </div>
                      <span className="text-[10px] text-stone-400 w-10 text-right">{formatDate(tx.date)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer: delete */}
        <div className="px-5 pb-5 pt-3 border-t border-stone-100">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full py-2.5 bg-red-50 text-red-500 border border-red-100 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting
              ? <span className="w-4 h-4 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
              : <Trash2 className="w-4 h-4" />
            }
            删除该持仓
          </button>
        </div>
      </div>
    </div>
  );
};
