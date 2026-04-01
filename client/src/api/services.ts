import apiClient from './client';
import type {
  ApiResponse,
  AuthResponse,
  LoginData,
  RegisterData,
  User,
  Holding,
  CreateHoldingData,
  Portfolio,
  TopHolding,
  AIAnalysis,
  RebalanceData,
  Transaction,
  ReviewEntry,
  CreateReviewData
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

// Health Check
export const healthApi = {
  check: () => 
    apiClient.get<ApiResponse<{ status: string; message: string; timestamp: string; version: string }>>('/health'),
};
