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
  notes?: string;
  isActive: boolean;
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

// AI Analysis Types
export interface AIAnalysis {
  healthScore: number;
  ratingDistribution: RatingDistribution;
  risks: Risk[];
  holdings: AnalyzedHolding[];
  summary: AnalysisSummary;
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
export type TabType = 'overview' | 'holdings' | 'ai' | 'rebalance' | 'review' | 'import' | 'settings';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}
