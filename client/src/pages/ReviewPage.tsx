import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3,
  X,
  Check
} from 'lucide-react';
import { usePortfolioStore } from '@/store';
import { useToastStore } from '@/store/toastStore';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ReviewEntry, CreateReviewData } from '@/types';

// ─── 格式化工具 ────────────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(n);
}

function formatPct(n: number) {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

// ─── 情绪配置 ─────────────────────────────────────────────────────────────────
const MOOD_CONFIG = {
  bullish:  { label: '看涨', icon: TrendingUp,   color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30' },
  neutral:  { label: '中性', icon: Minus,         color: 'text-stone-500',   bg: 'bg-slate-400/10 border-slate-400/30'   },
  bearish:  { label: '看跌', icon: TrendingDown,  color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/30'       },
} as const;

type Mood = keyof typeof MOOD_CONFIG;

// ─── 新建/编辑 Modal ──────────────────────────────────────────────────────────
interface ReviewModalProps {
  onClose: () => void;
  initialData?: ReviewEntry;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ onClose, initialData }) => {
  const { createReview, updateReview, portfolio } = usePortfolioStore();
  const { addToast } = useToastStore();
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [mood, setMood] = useState<Mood>(initialData?.mood ?? 'neutral');
  const [loading, setLoading] = useState(false);

  const isEdit = !!initialData;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const data: CreateReviewData = { title: title.trim(), content, mood };
      if (isEdit) {
        await updateReview(initialData._id, data);
        addToast('复盘已更新', 'success');
      } else {
        await createReview(data);
        addToast('复盘已保存', 'success');
      }
      onClose();
    } catch {
      addToast('保存失败，请重试', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white border border-stone-200 rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-stone-900">
            {isEdit ? '编辑复盘' : '新建复盘'}
          </h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 当前快照预览（仅新建时显示） */}
        {!isEdit && portfolio && (
          <div className="mb-4 p-3 rounded-xl bg-[rgba(217,119,87,0.08)] border border-[#D97757]/20">
            <p className="text-xs text-indigo-300 mb-1.5">将自动记录当前持仓快照</p>
            <div className="flex gap-4">
              <div>
                <p className="text-[10px] text-stone-500">总资产</p>
                <p className="text-sm font-semibold text-stone-900">{formatMoney(portfolio.totalAssets)}</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-500">持仓盈亏</p>
                <p className={`text-sm font-semibold ${portfolio.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPct(portfolio.unrealizedPnLPercent)}
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 标题 */}
          <div>
            <label className="text-xs text-stone-500 mb-1.5 block">标题 *</label>
            <input
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#D97757]/50"
              placeholder="本次复盘的主题..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
              required
              autoFocus
            />
          </div>

          {/* 情绪 */}
          <div>
            <label className="text-xs text-stone-500 mb-1.5 block">市场情绪</label>
            <div className="flex gap-2">
              {(Object.keys(MOOD_CONFIG) as Mood[]).map(m => {
                const cfg = MOOD_CONFIG[m];
                const Icon = cfg.icon;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all ${
                      mood === m ? cfg.bg + ' ' + cfg.color : 'border-stone-200 text-stone-400 hover:border-stone-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 正文 */}
          <div>
            <label className="text-xs text-stone-500 mb-1.5 block">复盘内容</label>
            <textarea
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#D97757]/50 resize-none"
              placeholder="记录你的思考、决策依据、市场判断..."
              rows={6}
              value={content}
              onChange={e => setContent(e.target.value)}
              maxLength={10000}
            />
            <p className="text-right text-xs text-stone-400 mt-1">{content.length}/10000</p>
          </div>

          <Button type="submit" className="w-full" isLoading={loading}>
            <Check className="w-4 h-4 mr-1.5" />
            {isEdit ? '保存修改' : '保存复盘'}
          </Button>
        </form>
      </div>
    </div>
  );
};

// ─── 单条复盘卡片 ─────────────────────────────────────────────────────────────
interface EntryCardProps {
  entry: ReviewEntry;
  onEdit: (entry: ReviewEntry) => void;
  onDelete: (id: string) => void;
}

const EntryCard: React.FC<EntryCardProps> = ({ entry, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const snap = entry.portfolioSnapshot;
  const moodCfg = MOOD_CONFIG[entry.mood];
  const MoodIcon = moodCfg.icon;

  return (
    <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden shadow-sm">
      {/* 卡片头部 */}
      <button
        className="w-full text-left px-4 pt-4 pb-3"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* 日期 + 情绪 */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] text-stone-400">{formatDate(entry.date)}</span>
              <span className={`flex items-center gap-0.5 text-[11px] font-medium ${moodCfg.color}`}>
                <MoodIcon className="w-3 h-3" />
                {moodCfg.label}
              </span>
            </div>
            {/* 标题 */}
            <p className="text-sm font-semibold text-stone-900 truncate">{entry.title}</p>
          </div>
          {/* 快照摘要 */}
          <div className="text-right shrink-0">
            <p className="text-xs text-stone-500">{formatMoney(snap.totalAssets)}</p>
            <p className={`text-xs font-semibold ${snap.pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatPct(snap.pnlPercent)}
            </p>
          </div>
        </div>
        {/* 展开/收起图标 */}
        <div className="flex justify-center mt-2">
          {expanded
            ? <ChevronUp className="w-4 h-4 text-stone-400" />
            : <ChevronDown className="w-4 h-4 text-stone-400" />
          }
        </div>
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-stone-100 pt-3 space-y-4">
          {/* 持仓快照 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-stone-50 p-2.5 text-center">
              <p className="text-[10px] text-stone-400 mb-0.5">总资产</p>
              <p className="text-xs font-semibold text-stone-900">{formatMoney(snap.totalAssets)}</p>
            </div>
            <div className="rounded-xl bg-stone-50 p-2.5 text-center">
              <p className="text-[10px] text-stone-400 mb-0.5">浮动盈亏</p>
              <p className={`text-xs font-semibold ${snap.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatMoney(snap.unrealizedPnL)}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 p-2.5 text-center">
              <p className="text-[10px] text-stone-400 mb-0.5">持仓数</p>
              <p className="text-xs font-semibold text-stone-900">{snap.holdingsCount}</p>
            </div>
          </div>

          {/* Top 持仓 */}
          {snap.topHoldings.length > 0 && (
            <div>
              <p className="text-[11px] text-stone-400 mb-2">当时前5大持仓</p>
              <div className="space-y-1.5">
                {snap.topHoldings.map(h => (
                  <div key={h.symbol} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-stone-400 w-16">{h.symbol}</span>
                      <span className="text-xs text-stone-600">{h.name}</span>
                    </div>
                    <span className={`text-xs font-medium ${h.pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatPct(h.pnlPercent)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 复盘正文 */}
          {entry.content && (
            <div>
              <p className="text-[11px] text-stone-400 mb-2">复盘内容</p>
              <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onEdit(entry)}
              className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-[#D97757] transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              编辑
            </button>
            <button
              onClick={() => onDelete(entry._id)}
              className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-red-400 transition-colors ml-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 主页面 ───────────────────────────────────────────────────────────────────
export const ReviewPage: React.FC = () => {
  const {
    reviews, reviewTotal, isLoadingReviews, reviewsError,
    fetchReviews, deleteReview
  } = usePortfolioStore();
  const { addToast } = useToastStore();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ReviewEntry | null>(null);

  useEffect(() => {
    fetchReviews();
  }, []);

  function handleEdit(entry: ReviewEntry) {
    setEditTarget(entry);
    setShowModal(true);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('确认删除这条复盘记录？')) return;
    try {
      await deleteReview(id);
      addToast('已删除', 'success');
    } catch {
      addToast('删除失败', 'error');
    }
  }

  function handleModalClose() {
    setShowModal(false);
    setEditTarget(null);
  }

  return (
    <div className="space-y-4 py-2">
      {/* 顶部标题行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#D97757]" />
          <h1 className="text-base font-semibold text-stone-900">复盘日记</h1>
          {reviewTotal > 0 && (
            <span className="text-xs text-stone-400">{reviewTotal} 条</span>
          )}
        </div>
        <Button
          onClick={() => { setEditTarget(null); setShowModal(true); }}
          className="h-8 px-3 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          新建复盘
        </Button>
      </div>

      {/* 内容区 */}
      {isLoadingReviews ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#D97757] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reviewsError ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-red-400">{reviewsError}</CardContent>
        </Card>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-stone-500 mb-1">还没有复盘记录</p>
            <p className="text-xs text-stone-400">点击「新建复盘」开始记录你的投资思考</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map(entry => (
            <EntryCard
              key={entry._id}
              entry={entry}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* 新建/编辑 Modal */}
      {showModal && (
        <ReviewModal
          onClose={handleModalClose}
          initialData={editTarget ?? undefined}
        />
      )}
    </div>
  );
};
