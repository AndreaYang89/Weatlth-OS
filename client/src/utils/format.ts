// Format currency
export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return '¥0';
  
  const absValue = Math.abs(value);
  
  if (absValue >= 100000000) {
    return `${value >= 0 ? '' : '-'}¥${(absValue / 100000000).toFixed(2)}亿`;
  }
  
  if (absValue >= 10000) {
    return `${value >= 0 ? '' : '-'}¥${(absValue / 10000).toFixed(1)}万`;
  }
  
  return `${value >= 0 ? '' : '-'}¥${absValue.toFixed(0)}`;
}

// Format percentage
export function formatPercentage(value: number | undefined | null, decimals = 1): string {
  if (value === undefined || value === null || isNaN(value)) return '0%';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

// Format number
export function formatNumber(value: number | undefined | null, decimals = 0): string {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return value.toFixed(decimals);
}

// Format date
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// Format time
export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format datetime
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Get color based on value (positive/negative)
export function getValueColor(value: number): string {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-slate-400';
}

// Get background color based on value
export function getValueBgColor(value: number): string {
  if (value > 0) return 'bg-emerald-500/10';
  if (value < 0) return 'bg-red-500/10';
  return 'bg-slate-500/10';
}

// Get border color based on value
export function getValueBorderColor(value: number): string {
  if (value > 0) return 'border-emerald-500/20';
  if (value < 0) return 'border-red-500/20';
  return 'border-slate-500/20';
}

// Get category color
export function getCategoryColor(category: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    '消费': { bg: 'bg-blue-500/15', text: 'text-blue-400' },
    '新能源': { bg: 'bg-amber-500/15', text: 'text-amber-400' },
    '海外': { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
    '互联网': { bg: 'bg-purple-500/15', text: 'text-purple-400' },
    '科技': { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
    '金融': { bg: 'bg-slate-500/15', text: 'text-slate-400' },
    '医药': { bg: 'bg-pink-500/15', text: 'text-pink-400' },
    '其他': { bg: 'bg-slate-500/15', text: 'text-slate-400' },
  };
  return colors[category] || colors['其他'];
}

// Get rating color and text
export function getRatingInfo(rating: string): { color: string; text: string; className: string } {
  const ratings: Record<string, { color: string; text: string; className: string }> = {
    'strong-buy': { color: '#10b981', text: '强烈持有', className: 'strong-buy' },
    'buy': { color: '#34d399', text: '持有', className: 'buy' },
    'neutral': { color: '#fbbf24', text: '观望', className: 'neutral' },
    'reduce': { color: '#f97316', text: '减仓', className: 'reduce' },
    'sell': { color: '#ef4444', text: '需止损', className: 'sell' },
  };
  return ratings[rating] || ratings['neutral'];
}

// Get technical rating tag class
export function getTechnicalTagClass(rating: string): string {
  const classes: Record<string, string> = {
    'strong': 'tag-tech-strong',
    'good': 'tag-tech-good',
    'neutral': 'tag-tech-neutral',
    'bad': 'tag-tech-bad',
    'weak': 'tag-tech-weak',
  };
  return classes[rating] || 'tag-tech-neutral';
}

// Get market rating tag class
export function getMarketTagClass(rating: string): string {
  const classes: Record<string, string> = {
    'hot': 'tag-market-hot',
    'warm': 'tag-market-warm',
    'cool': 'tag-market-cool',
    'cold': 'tag-market-cold',
  };
  return classes[rating] || 'tag-market-warm';
}

// Generate star rating HTML
export function generateStars(rating: number): string {
  const fullStars = '★'.repeat(rating);
  const emptyStars = '☆'.repeat(5 - rating);
  return fullStars + emptyStars;
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
