import React, { useState } from 'react';
import { usePortfolioStore, useToastStore } from '@/store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { X } from 'lucide-react';

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

export const AddHoldingModal: React.FC<AddHoldingModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    symbol: '',
    name: '',
    category: '消费',
    shares: '',
    avgCost: '',
    currentPrice: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { createHolding } = usePortfolioStore();
  const { addToast } = useToastStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createHolding({
        symbol: formData.symbol.toUpperCase(),
        name: formData.name,
        category: formData.category,
        shares: parseFloat(formData.shares),
        avgCost: parseFloat(formData.avgCost),
        currentPrice: formData.currentPrice ? parseFloat(formData.currentPrice) : parseFloat(formData.avgCost),
      });

      addToast('持仓添加成功', 'success');
      onClose();
      setFormData({
        symbol: '',
        name: '',
        category: '消费',
        shares: '',
        avgCost: '',
        currentPrice: '',
      });
    } catch (error: any) {
      addToast(error.response?.data?.message || '添加失败', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl animate-fade-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">添加新持仓</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="股票代码"
            type="text"
            placeholder="如: 600519"
            value={formData.symbol}
            onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
            required
          />

          <Input
            label="股票名称"
            type="text"
            placeholder="如: 贵州茅台"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              板块分类
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="持仓数量"
            type="number"
            placeholder="如: 100"
            min="1"
            step="1"
            value={formData.shares}
            onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
            required
          />

          <Input
            label="成本价"
            type="number"
            placeholder="如: 1500"
            min="0.01"
            step="0.01"
            value={formData.avgCost}
            onChange={(e) => setFormData({ ...formData, avgCost: e.target.value })}
            required
          />

          <Input
            label="当前价 (可选)"
            type="number"
            placeholder="默认与成本价相同"
            min="0.01"
            step="0.01"
            value={formData.currentPrice}
            onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
          />

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors"
            >
              取消
            </button>
            <Button
              type="submit"
              className="flex-1"
              isLoading={isSubmitting}
            >
              添加
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
