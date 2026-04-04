// User Types
export interface User {
  id: string;
  username: string;
  email: string;
  profile: {
    name?: string;
    avatar?: string;
    riskProfile: 'conservative' | 'moderate' | 'aggressive';
  };
  settings: {
    currency: string;
    notifications: {
      email: boolean;
      push: boolean;
    };
  };
  createdAt: string;
}

// Holding Types
export interface Holding {
  _id: string;
  user: string;
  symbol: string;
  name: string;
  category: '消费' | '新能源' | '海外' | '互联网' | '科技' | '金融' | '医药' | '其他';
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  technicalRating: 'strong' | 'good' | 'neutral' | 'bad' | 'weak';
  technicalDetail: string;
  marketRating: 'hot' | 'warm' | 'cool' | 'cold';
  marketDetail: string;
  overallRating: 'strong-buy' | 'buy' | 'neutral' | 'reduce' | 'sell';
  starRating: number;
  strategy: '持有' | '定投' | '加仓' | '减仓' | '止损' | '观望';
  stopLoss?: number | null;
  takeProfit?: number | null;
  notes?: string;
  isActive: boolean;
  alertTriggered?: 'none' | 'takeProfit' | 'stopLoss';
  createdAt: string;
  updatedAt: string;
  // Computed fields
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
  pnlColor?: string;
}

export interface CreateHoldingData {
  symbol: string;
  name: string;
  category: string;
  shares: number;
  avgCost: number;
  currentPrice?: number;
  notes?: string;
}

// Portfolio Types
export interface Portfolio {
  totalAssets: number;
  totalCost: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  allocation: AllocationItem[];
  riskMetrics: RiskMetrics;
  healthScore: number;
  lastUpdated: string;
}

export interface AllocationItem {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface RiskMetrics {
  beta: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  concentrationRisk: 'low' | 'medium' | 'high';
}

export interface TopHolding {
  symbol: string;
  name: string;
  marketValue: number;
  percentage: number;
  pnl: number;
  pnlPercent: number;
}

export interface Recommendation {
  symbol: string;
  name: string;
  action: 'buy' | 'sell' | 'reduce' | 'hold';
  reason: string;
  marketReason?: string;
  suggestedAmount?: number;
  priority: 'high' | 'medium' | 'low';
  isNew?: boolean;
}

// AI Analysis Types
export interface AIAnalysis {
  healthScore: number;
  ratingDistribution: RatingDistribution;
  risks: Risk[];
  holdings: AnalyzedHolding[];
  summary: AnalysisSummary;
  provider?: string;
  recommendations?: Recommendation[];
}

export interface RatingDistribution {
  'strong-buy': number;
  'buy': number;
  'neutral': number;
  'reduce': number;
  'sell': number;
}

export interface Risk {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  count?: number;
  percentage?: number;
  holdings?: string[];
}

export interface AnalyzedHolding extends Holding {
  aiScore: number;
}

export interface AnalysisSummary {
  totalHoldings: number;
  strongHoldings: number;
  weakHoldings: number;
  averageScore: number;
}

// Rebalance Types
export interface RebalanceRecommendation {
  symbol: string;
  name: string;
  action: 'sell' | 'reduce' | 'buy';
  actionText: string;
  reason: string;
  marketReason: string;
  suggestedAmount: number;
  priority: 'high' | 'medium' | 'low';
  isNew?: boolean;
}

export interface RebalanceData {
  recommendations: RebalanceRecommendation[];
  summary: {
    totalSell: number;
    totalBuy: number;
    netAdjustment: number;
  };
  portfolioHealth: number;
  riskLevel: 'low' | 'medium' | 'high';
}

// Transaction Types
export interface Transaction {
  _id: string;
  user: string;
  holding: string;
  symbol: string;
  type: 'buy' | 'sell';
  shares: number;
  price: number;
  amount: number;
  fees: number;
  date: string;
  notes?: string;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
}

// Auth Types
export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Review Types
export interface ReviewSnapshot {
  totalAssets: number;
  totalCost: number;
  unrealizedPnL: number;
  pnlPercent: number;
  holdingsCount: number;
  topHoldings: {
    symbol: string;
    name: string;
    marketValue: number;
    pnlPercent: number;
  }[];
}

export interface ReviewEntry {
  _id: string;
  user: string;
  date: string;
  title: string;
  content: string;
  mood: 'bullish' | 'neutral' | 'bearish';
  tags: string[];
  portfolioSnapshot: ReviewSnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewData {
  title: string;
  content?: string;
  mood?: 'bullish' | 'neutral' | 'bearish';
  tags?: string[];
  date?: string;
}

// UI Types
export type TabType = 'overview' | 'holdings' | 'transactions' | 'ai' | 'rebalance' | 'review' | 'import' | 'settings' | 'watchlist';

// ── Stock Research Types ─────────────────────────────────────────────────────

export interface Stock {
  symbol: string;
  name: string;
  fullname?: string;
  industry?: string;
  market: 'SH' | 'SZ' | 'BJ' | 'HK' | 'US';
  listDate?: string;
  type?: string;
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  preClose?: number;
  volume?: number;
  amount?: number;
  turnover?: number;
  marketCap?: number;
  pe?: number;
  pb?: number;
  high52w?: number;
  low52w?: number;
  industry?: string;
  updateTime?: string;
}

export interface StockValuation {
  symbol: string;
  date?: string;
  peTtm: number;
  pb: number;
  ps?: number;
  peg?: number;
  pePercentile: number;
  pbPercentile: number;
  peIndustryAvg?: number;
  pbIndustryAvg?: number;
}

export interface StockFinancial {
  symbol: string;
  reportDate?: string;
  roe?: number;
  roa?: number;
  grossMargin?: number;
  netMargin?: number;
  revenueGrowth?: number;
  profitGrowth?: number;
  debtRatio?: number;
  currentRatio?: number;
  dataAvailable?: boolean;
  updateTime?: string;
}

export interface StockTechnical {
  symbol: string;
  date?: string;
  trend: 'up' | 'down' | 'sideways';
  signal?: 'bullish' | 'bearish' | 'neutral';
  ma5?: number;
  ma20?: number;
  rsi: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  bollUpper?: number;
  bollMiddle?: number;
  bollLower?: number;
  support1?: number;
  support2?: number;
  resistance1?: number;
  resistance2?: number;
  signals?: { type: string; description: string; indicator?: string }[];
}

export interface StockAIAnalysis {
  symbol: string;
  updateTime?: string;
  overallScore: number;       // 0–100
  valuationScore: number;
  technicalScore: number;
  fundamentalScore: number;
  recommendation: 'buy' | 'hold' | 'sell';
  confidence?: number;
  summary: string;
  valuationAnalysis?: string;
  technicalAnalysis?: string;
  fundamentalAnalysis?: string;
  risks?: string[];
}

export interface StockNews {
  id?: string;
  title: string;
  source: string;
  url?: string;
  time?: string;
  publishTime?: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  group: 'holding' | 'watching' | 'custom';
  source?: 'manual' | 'holding';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistItemWithData extends WatchlistItem {
  quote?: StockQuote;
  valuation?: StockValuation;
  aiAnalysis?: StockAIAnalysis;
}

export interface HoldingDraft {
  symbol: string;
  name: string;
  category?: string;
  currentPrice?: number;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}
