import React, { useState } from 'react';
import { usePortfolioStore, useToastStore } from '@/store';
import { holdingsApi } from '@/api/services';
import { X, TrendingUp, TrendingDown } from 'lucide-react';

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const categories = [
  { value: '消费', label: '消费' },
  { value: '新能源', label: '新能源' },
  { value: '海外', label: '海外' },
  { value: '互联网', label: '互联网' },
  { value: '科技', label: '科技' },
  { value: '金融', label: '金融' },
  { value: '医药', label: '医药' },
  { value: '其他', label: '其他' },
];

const inputClass =
  'w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none focus:border-[#D97757]/60 focus:ring-2 focus:ring-[#D97757]/10 transition-all';
const labelClass = 'block text-xs font-medium text-stone-500 mb-1.5';

export const AddHoldingModal: React.FC<AddHoldingModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');

  // Buy form state
  const [buyForm, setBuyForm] = useState({
    symbol: '',
    name: '',
    category: '消费',
    shares: '',
    avgCost: '',
    currentPrice: '',
  });

  // Sell form state
  const [sellForm, setSellForm] = useState({
    holdingId: '',
    shares: '',
    price: '',
    fees: '',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createHolding, holdings, fetchHoldings } = usePortfolioStore();
  const { addToast } = useToastStore();

  if (!isOpen) return null;

  const activeHoldings = holdings.filter(h => h.isActive);
  const selectedHolding = activeHoldings.find(h => h._id === sellForm.holdingId);

  const handleBuySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createHolding({
        symbol: buyForm.symbol.toUpperCase(),
        name: buyForm.name,
        category: buyForm.category,
        shares: parseFloat(buyForm.shares),
        avgCost: parseFloat(buyForm.avgCost),
        currentPrice: buyForm.currentPrice ? parseFloat(buyForm.currentPrice) : parseFloat(buyForm.avgCost),
      });
      addToast('买入记录已添加', 'success');
      onClose();
      setBuyForm({ symbol: '', name: '', category: '消费', shares: '', avgCost: '', currentPrice: '' });
    } catch (error: any) {
      addToast(error.response?.data?.message || '添加失败', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellForm.holdingId) {
      addToast('请选择要卖出的持仓', 'error');
      return;
    }
    const sharesToSell = parseFloat(sellForm.shares);
    if (selectedHolding && sharesToSell > selectedHolding.shares) {
      addToast(`卖出数量不能超过持仓数量 (${selectedHolding.shares} 股)`, 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await holdingsApi.addTransaction(sellForm.holdingId, {
        type: 'sell',
        shares: sharesToSell,
        price: parseFloat(sellForm.price),
        fees: sellForm.fees ? parseFloat(sellForm.fees) : 0,
        notes: sellForm.notes || undefined,
      });
      await fetchHoldings();
      addToast('卖出记录已添加', 'success');
      onClose();
      setSellForm({ holdingId: '', shares: '', price: '', fees: '', notes: '' });
    } catch (error: any) {
      addToast(error.response?.data?.message || '卖出失败', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white border border-stone-200 rounded-2xl shadow-2xl animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-stone-900">记一笔</h2>
            <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab toggle */}
          <div className="flex gap-1 p-1 bg-stone-100 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => setTab('buy')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'buy'
                  ? 'bg-[#D97757] text-white shadow-sm shadow-[#D97757]/30'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              买入
            </button>
            <button
              type="button"
              onClick={() => setTab('sell')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'sell'
                  ? 'bg-red-500 text-white shadow-sm shadow-red-500/30'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              卖出
            </button>
          </div>
        </div>

        {/* Buy Form */}
        {tab === 'buy' && (
          <form onSubmit={handleBuySubmit} className="px-6 pb-6 space-y-3">
            <div>
              <label className={labelClass}>股票代码</label>
              <input className={inputClass} type="text" placeholder="如: 600519"
                value={buyForm.symbol} onChange={e => setBuyForm({ ...buyForm, symbol: e.target.value })} required />
            </div>
            <div>
              <label className={labelClass}>股票名称</label>
              <input className={inputClass} type="text" placeholder="如: 贵州茅台"
                value={buyForm.name} onChange={e => setBuyForm({ ...buyForm, name: e.target.value })} required />
            </div>
            <div>
              <label className={labelClass}>板块分类</label>
              <select className={inputClass} value={buyForm.category}
                onChange={e => setBuyForm({ ...buyForm, category: e.target.value })}>
                {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>持仓数量</label>
                <input className={inputClass} type="number" placeholder="如: 100" min="1" step="1"
                  value={buyForm.shares} onChange={e => setBuyForm({ ...buyForm, shares: e.target.value })} required />
              </div>
              <div>
                <label className={labelClass}>买入价格</label>
                <input className={inputClass} type="number" placeholder="如: 1500" min="0.01" step="0.01"
                  value={buyForm.avgCost} onChange={e => setBuyForm({ ...buyForm, avgCost: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className={labelClass}>当前价 <span className="text-stone-400 font-normal">(可选，默认与买入价相同)</span></label>
              <input className={inputClass} type="number" placeholder="默认与买入价相同" min="0.01" step="0.01"
                value={buyForm.currentPrice} onChange={e => setBuyForm({ ...buyForm, currentPrice: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-stone-100 text-stone-600 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors">
                取消
              </button>
              <button type="submit" disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 bg-[#D97757] text-white rounded-xl text-sm font-semibold hover:bg-[#c96947] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                确认买入
              </button>
            </div>
          </form>
        )}

        {/* Sell Form */}
        {tab === 'sell' && (
          <form onSubmit={handleSellSubmit} className="px-6 pb-6 space-y-3">
            <div>
              <label className={labelClass}>选择持仓</label>
              <select className={inputClass} value={sellForm.holdingId}
                onChange={e => setSellForm({ ...sellForm, holdingId: e.target.value })} required>
                <option value="">-- 请选择要卖出的股票 --</option>
                {activeHoldings.map(h => (
                  <option key={h._id} value={h._id}>
                    {h.name}（{h.symbol}）· 持有 {h.shares} 股 · 成本 ¥{h.avgCost.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {selectedHolding && (
              <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                <div className="flex-1 text-xs text-stone-500 space-y-0.5">
                  <p>持仓成本：<span className="text-stone-700 font-medium">¥{selectedHolding.avgCost.toFixed(2)}</span></p>
                  <p>当前价格：<span className="text-stone-700 font-medium">¥{selectedHolding.currentPrice.toFixed(2)}</span></p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-stone-400">可卖数量</p>
                  <p className="text-stone-900 font-bold">{selectedHolding.shares} 股</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>卖出数量</label>
                <input className={inputClass} type="number" placeholder="股数"
                  min="1" step="1"
                  max={selectedHolding?.shares}
                  value={sellForm.shares}
                  onChange={e => setSellForm({ ...sellForm, shares: e.target.value })} required />
              </div>
              <div>
                <label className={labelClass}>卖出价格</label>
                <input className={inputClass} type="number" placeholder="成交价格" min="0.01" step="0.01"
                  value={sellForm.price} onChange={e => setSellForm({ ...sellForm, price: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className={labelClass}>手续费 <span className="text-stone-400 font-normal">(可选)</span></label>
              <input className={inputClass} type="number" placeholder="交易手续费" min="0" step="0.01"
                value={sellForm.fees} onChange={e => setSellForm({ ...sellForm, fees: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>备注 <span className="text-stone-400 font-normal">(可选)</span></label>
              <input className={inputClass} type="text" placeholder="卖出原因或备注"
                value={sellForm.notes} onChange={e => setSellForm({ ...sellForm, notes: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-stone-100 text-stone-600 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors">
                取消
              </button>
              <button type="submit" disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <TrendingDown className="w-4 h-4" />}
                确认卖出
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
