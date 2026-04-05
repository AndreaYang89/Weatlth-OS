import apiClient from './client';
import type {
  ApiResponse,
  AuthResponse,
  LoginData,
  RegisterData,
  User,
  Holding,
  CreateHoldingData,
  ImportHoldingError,
  Portfolio,
  TopHolding,
  AIAnalysis,
  RebalanceData,
  Transaction,
  ReviewEntry,
  CreateReviewData,
  AnalyzedHolding,
  Stock,
  StockQuote,
  StockValuation,
  StockFinancial,
  StockTechnical,
  StockAIAnalysis,
  StockNews,
  StockHistoryPoint,
  StockKeyEvent,
  StockAnalystRating,
  WatchlistItem,
} from '@/types';

// Auth Services
export const authApi = {
  login: (data: LoginData) => 
    apiClient.post<ApiResponse<AuthResponse>>('/auth/login', data),
  
  register: (data: RegisterData) => 
    apiClient.post<ApiResponse<AuthResponse>>('/auth/register', data),
  
  getMe: () => 
    apiClient.get<ApiResponse<{ user: User }>>('/auth/me'),
  
  updateProfile: (data: Partial<User['profile']>) => 
    apiClient.put<ApiResponse<{ user: User }>>('/auth/profile', data),
  
  changePassword: (data: { currentPassword: string; newPassword: string }) => 
    apiClient.post<ApiResponse<void>>('/auth/change-password', data),
};

// Portfolio Services
export const portfolioApi = {
  getPortfolio: () => 
    apiClient.get<ApiResponse<{ portfolio: Portfolio; topHoldings: TopHolding[]; holdingCount: number }>>('/portfolio'),
  
  getAllocation: () => 
    apiClient.get<ApiResponse<{ totalAssets: number; categoryAllocation: Record<string, unknown>; allocationChart: unknown[] }>>('/portfolio/allocation'),
  
  getPerformance: () => 
    apiClient.get<ApiResponse<{ performance: unknown; riskMetrics: unknown }>>('/portfolio/performance'),
  
  refresh: () => 
    apiClient.post<ApiResponse<{ portfolio: Portfolio }>>('/portfolio/refresh'),
};

// Holdings Services
export const holdingsApi = {
  getHoldings: (params?: { category?: string; rating?: string }) => 
    apiClient.get<ApiResponse<{ holdings: Holding[]; count: number }>>('/holdings', { params }),
  
  getSummary: () => 
    apiClient.get<ApiResponse<{ summary: unknown }>>('/holdings/summary'),
  
  getHolding: (id: string) =>
    apiClient.get<ApiResponse<{ holding: Holding }>>(`/holdings/${id}`),

  createHolding: (data: CreateHoldingData) =>
    apiClient.post<ApiResponse<{ holding: Holding }>>('/holdings', data),

  updateHolding: (id: string, data: Partial<CreateHoldingData>) =>
    apiClient.put<ApiResponse<{ holding: Holding }>>(`/holdings/${id}`, data),

  deleteHolding: (id: string) =>
    apiClient.delete<ApiResponse<void>>(`/holdings/${id}`),

  addTransaction: (id: string, data: { type: 'buy' | 'sell'; shares: number; price: number; fees?: number; notes?: string }) =>
    apiClient.post<ApiResponse<{ transaction: Transaction; holding: Holding }>>(`/holdings/${id}/transaction`, data),

  refreshPrices: () =>
    apiClient.post<ApiResponse<{ updated: number; failed: number }>>('/holdings/refresh-prices'),

  importHoldings: (items: CreateHoldingData[]) =>
    apiClient.post<ApiResponse<{ created: number; updated: number; failed: number; errors?: ImportHoldingError[] }>>('/holdings/import', items),

  classifyHoldings: (items: { symbol: string; name: string }[]) =>
    apiClient.post<ApiResponse<{ symbol: string; category: string }[]>>('/holdings/classify', items),
};

// Analysis Services
export const analysisApi = {
  getAnalysis: () => 
    apiClient.get<ApiResponse<{ analysis: AIAnalysis }>>('/analysis'),
  
  getHoldingAnalysis: (id: string) => 
    apiClient.get<ApiResponse<{ holding: AnalyzedHolding }>>(`/analysis/holdings/${id}`),
  
  getRisks: () => 
    apiClient.get<ApiResponse<{ risks: unknown; riskMetrics: unknown; totalRisks: number; highPriorityRisks: number; recommendations: unknown[] }>>('/analysis/risks'),
  
  analyze: (data?: { riskProfile?: string }) => 
    apiClient.post<ApiResponse<{ analysis: AIAnalysis; recommendations: unknown[]; riskProfile: string; timestamp: string }>>('/analysis/analyze', data),
};

// Rebalance Services
export const rebalanceApi = {
  getRecommendations: () => 
    apiClient.get<ApiResponse<RebalanceData>>('/rebalance'),
  
  calculate: (data: { targetAllocation: Record<string, number>; cashToInvest?: number }) => 
    apiClient.post<ApiResponse<{ targets: unknown; adjustments: unknown[]; summary: unknown }>>('/rebalance/calculate', data),
  
  execute: (data: { adjustments: unknown[] }) => 
    apiClient.post<ApiResponse<{ executionPlan: unknown[]; summary: unknown }>>('/rebalance/execute', data),
  
  getHistory: () => 
    apiClient.get<ApiResponse<{ history: unknown[] }>>('/rebalance/history'),
};

// Review Services
export const reviewApi = {
  getReviews: (params?: { page?: number; limit?: number }) =>
    apiClient.get<ApiResponse<{ entries: ReviewEntry[]; total: number; page: number; limit: number; hasMore: boolean }>>('/reviews', { params }),

  getReview: (id: string) =>
    apiClient.get<ApiResponse<{ entry: ReviewEntry }>>(`/reviews/${id}`),

  createReview: (data: CreateReviewData) =>
    apiClient.post<ApiResponse<{ entry: ReviewEntry }>>('/reviews', data),

  updateReview: (id: string, data: Partial<CreateReviewData>) =>
    apiClient.put<ApiResponse<{ entry: ReviewEntry }>>(`/reviews/${id}`, data),

  deleteReview: (id: string) =>
    apiClient.delete<ApiResponse<void>>(`/reviews/${id}`),
};

// Transaction Services
export const transactionsApi = {
  getTransactions: (params?: { page?: number; limit?: number; symbol?: string; type?: 'buy' | 'sell' }) =>
    apiClient.get<ApiResponse<{ transactions: Transaction[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>>('/transactions', { params }),

  getTransaction: (id: string) =>
    apiClient.get<ApiResponse<{ transaction: Transaction }>>(`/transactions/${id}`),
};

// Health Check
export const healthApi = {
  check: () =>
    apiClient.get<ApiResponse<{ status: string; message: string; timestamp: string; version: string }>>('/health'),
};

export const stockApi = {
  searchStocks: (keyword: string) =>
    apiClient.get<ApiResponse<Stock[]>>('/stocks/search', { params: { keyword } }),

  getQuote: (symbol: string) =>
    apiClient.get<ApiResponse<StockQuote>>(`/stocks/${symbol}/quote`),

  getValuation: (symbol: string) =>
    apiClient.get<ApiResponse<StockValuation>>(`/stocks/${symbol}/valuation`),

  getFinancial: (symbol: string) =>
    apiClient.get<ApiResponse<StockFinancial>>(`/stocks/${symbol}/financial`),

  getTechnical: (symbol: string) =>
    apiClient.get<ApiResponse<StockTechnical>>(`/stocks/${symbol}/technical`),

  getAIAnalysis: (symbol: string) =>
    apiClient.get<ApiResponse<StockAIAnalysis>>(`/stocks/${symbol}/analysis`),

  getNews: (symbol: string) =>
    apiClient.get<ApiResponse<StockNews[]>>(`/stocks/${symbol}/news`),

  getHistory: (symbol: string, period: string = '1y') =>
    apiClient.get<ApiResponse<StockHistoryPoint[]>>(`/stocks/${symbol}/history`, { params: { period } }),

  getKeyEvents: (symbol: string) =>
    apiClient.get<ApiResponse<StockKeyEvent[]>>(`/stocks/${symbol}/events`),

  getAnalystRatings: (symbol: string) =>
    apiClient.get<ApiResponse<StockAnalystRating[]>>(`/stocks/${symbol}/ratings`),

  batchQuote: (symbols: string[]) =>
    apiClient.post<ApiResponse<Record<string, StockQuote>>>('/stocks/batch/quote', { symbols }),

  // Watchlist CRUD (persisted per user)
  getWatchlist: () =>
    apiClient.get<ApiResponse<WatchlistItem[]>>('/stocks/watchlist'),

  addToWatchlist: (data: { symbol: string; name: string; group?: WatchlistItem['group'] }) =>
    apiClient.post<ApiResponse<WatchlistItem>>('/stocks/watchlist', data),

  removeFromWatchlist: (id: string) =>
    apiClient.delete<ApiResponse<void>>(`/stocks/watchlist/${id}`),

  /** 轻量查询单支股票是否在关注列表中，供 StockDetailPage 用，避免加载全量列表 */
  checkWatchlist: (symbol: string) =>
    apiClient.get<ApiResponse<{ inWatchlist: boolean; id?: string; group?: WatchlistItem['group']; source?: WatchlistItem['source'] }>>('/stocks/watchlist/check', { params: { symbol } }),
};
