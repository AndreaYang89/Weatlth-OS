import React, { useState, useEffect, useCallback } from 'react';
import { transactionsApi } from '@/api/services';
import { Card, CardContent } from '@/components/ui/Card';
import { formatCurrency } from '@/utils/format';
import { ArrowDownCircle, ArrowUpCircle, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Transaction } from '@/types';

type FilterType = 'all' | 'buy' | 'sell';

const PAGE_SIZE = 15;

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

export const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await transactionsApi.getTransactions({
        page,
        limit: PAGE_SIZE,
        ...(filter !== 'all' ? { type: filter } : {}),
      });
      const data = res.data.data!;
      setTransactions(data.transactions);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1); }, [filter]);

  const buyTotal = transactions.filter(t => t.type === 'buy').reduce((s, t) => s + t.amount, 0);
  const sellTotal = transactions.filter(t => t.type === 'sell').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center">
          <Receipt className="w-4.5 h-4.5 text-[#D97757]" style={{ width: 18, height: 18 }} />
        </div>
        <div>
          <h2 className="text-base font-bold text-stone-900">交易流水</h2>
          <p className="text-xs text-stone-500">共 {total} 笔记录</p>
        </div>
      </div>

      {/* Summary strip */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
            <ArrowDownCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-wider">本页买入</p>
              <p className="text-sm font-bold text-emerald-600 font-mono-number">{formatCurrency(buyTotal)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
            <ArrowUpCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-wider">本页卖出</p>
              <p className="text-sm font-bold text-red-500 font-mono-number">{formatCurrency(sellTotal)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {([['all', '全部'], ['buy', '买入'], ['sell', '卖出']] as [FilterType, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === key
                ? key === 'sell'
                  ? 'bg-red-500 text-white shadow-sm'
                  : key === 'buy'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-[#D97757] text-white shadow-sm'
                : 'bg-stone-100 text-stone-500 border border-stone-200 hover:bg-stone-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Receipt className="w-12 h-12 text-stone-300 mb-3" />
          <p className="text-stone-400 text-sm">暂无交易记录</p>
          <p className="text-stone-400 text-xs mt-1">通过「记一笔」添加买入或卖出</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <TransactionRow key={tx._id} tx={tx} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-stone-500 font-mono">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

const TransactionRow: React.FC<{ tx: Transaction }> = ({ tx }) => {
  const isBuy = tx.type === 'buy';
  const holdingName = (tx as any).holding?.name;

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-stone-100 rounded-xl hover:border-stone-200 transition-colors">
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isBuy ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-400'
      }`}>
        {isBuy
          ? <ArrowDownCircle className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
          : <ArrowUpCircle className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            isBuy ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
          }`}>
            {isBuy ? '买入' : '卖出'}
          </span>
          <span className="text-sm font-semibold text-stone-900">{tx.symbol}</span>
          {holdingName && (
            <span className="text-xs text-stone-400 truncate">{holdingName}</span>
          )}
        </div>
        <p className="text-xs text-stone-400 font-mono-number">
          {tx.shares}股 @ ¥{tx.price.toFixed(2)}
          {tx.fees > 0 && <span className="text-stone-300"> · 费¥{tx.fees.toFixed(2)}</span>}
        </p>
      </div>

      {/* Amount + Date */}
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold font-mono-number ${isBuy ? 'text-emerald-600' : 'text-red-500'}`}>
          {isBuy ? '-' : '+'}{formatCurrency(tx.amount)}
        </p>
        <p className="text-[10px] text-stone-400 mt-0.5">{formatDate(tx.date)}</p>
      </div>
    </div>
  );
};
