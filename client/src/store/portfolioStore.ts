import { create } from 'zustand';
import type { Portfolio, TopHolding, Holding, AIAnalysis, RebalanceData, ReviewEntry } from '@/types';
import { portfolioApi, holdingsApi, analysisApi, rebalanceApi, reviewApi } from '@/api/services';

interface PortfolioState {
  // Data
  portfolio: Portfolio | null;
  topHoldings: TopHolding[];
  holdings: Holding[];
  analysis: AIAnalysis | null;
  rebalance: RebalanceData | null;

  // Review data
  reviews: ReviewEntry[];
  reviewTotal: number;
  isLoadingReviews: boolean;
  reviewsError: string | null;

  // Loading states
  isLoadingPortfolio: boolean;
  isLoadingHoldings: boolean;
  isLoadingAnalysis: boolean;
  isLoadingRebalance: boolean;
  isRefreshingPrices: boolean;

  // Error states
  portfolioError: string | null;
  holdingsError: string | null;
  analysisError: string | null;
  rebalanceError: string | null;

  // Actions
  fetchPortfolio: () => Promise<void>;
  fetchHoldings: (params?: { category?: string; rating?: string }) => Promise<void>;
  fetchAnalysis: () => Promise<void>;
  fetchRebalance: () => Promise<void>;
  createHolding: (data: unknown) => Promise<void>;
  updateHolding: (id: string, data: unknown) => Promise<void>;
  deleteHolding: (id: string) => Promise<void>;
  refreshPortfolio: () => Promise<void>;
  refreshPrices: () => Promise<{ updated: number; failed: number }>;
  runAnalysis: () => Promise<void>;
  // Review actions
  fetchReviews: (params?: { page?: number; limit?: number }) => Promise<void>;
  createReview: (data: unknown) => Promise<void>;
  updateReview: (id: string, data: unknown) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;
  clearErrors: () => void;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  portfolio: null,
  topHoldings: [],
  holdings: [],
  analysis: null,
  rebalance: null,

  reviews: [],
  reviewTotal: 0,
  isLoadingReviews: false,
  reviewsError: null,

  isLoadingPortfolio: false,
  isLoadingHoldings: false,
  isLoadingAnalysis: false,
  isLoadingRebalance: false,
  isRefreshingPrices: false,

  portfolioError: null,
  holdingsError: null,
  analysisError: null,
  rebalanceError: null,

  fetchPortfolio: async () => {
    set({ isLoadingPortfolio: true, portfolioError: null });
    try {
      const response = await portfolioApi.getPortfolio();
      set({ 
        portfolio: response.data.data!.portfolio,
        topHoldings: response.data.data!.topHoldings,
        isLoadingPortfolio: false 
      });
    } catch (error: any) {
      set({ 
        portfolioError: error.response?.data?.message || '获取投资组合失败',
        isLoadingPortfolio: false 
      });
    }
  },

  fetchHoldings: async (params) => {
    set({ isLoadingHoldings: true, holdingsError: null });
    try {
      const response = await holdingsApi.getHoldings(params);
      set({ 
        holdings: response.data.data!.holdings,
        isLoadingHoldings: false 
      });
    } catch (error: any) {
      set({ 
        holdingsError: error.response?.data?.message || '获取持仓失败',
        isLoadingHoldings: false 
      });
    }
  },

  fetchAnalysis: async () => {
    set({ isLoadingAnalysis: true, analysisError: null });
    try {
      const response = await analysisApi.getAnalysis();
      set({ 
        analysis: response.data.data!.analysis,
        isLoadingAnalysis: false 
      });
    } catch (error: any) {
      set({ 
        analysisError: error.response?.data?.message || '获取AI分析失败',
        isLoadingAnalysis: false 
      });
    }
  },

  fetchRebalance: async () => {
    set({ isLoadingRebalance: true, rebalanceError: null });
    try {
      const response = await rebalanceApi.getRecommendations();
      set({ 
        rebalance: response.data.data!,
        isLoadingRebalance: false 
      });
    } catch (error: any) {
      set({ 
        rebalanceError: error.response?.data?.message || '获取调仓建议失败',
        isLoadingRebalance: false 
      });
    }
  },

  createHolding: async (data) => {
    try {
      await holdingsApi.createHolding(data as any);
      await get().fetchHoldings();
      await get().fetchPortfolio();
    } catch (error) {
      throw error;
    }
  },

  updateHolding: async (id, data) => {
    try {
      await holdingsApi.updateHolding(id, data as any);
      await get().fetchHoldings();
      await get().fetchPortfolio();
    } catch (error) {
      throw error;
    }
  },

  deleteHolding: async (id) => {
    try {
      await holdingsApi.deleteHolding(id);
      await get().fetchHoldings();
      await get().fetchPortfolio();
    } catch (error) {
      throw error;
    }
  },

  refreshPortfolio: async () => {
    set({ isLoadingPortfolio: true });
    try {
      await portfolioApi.refresh();
      await get().fetchPortfolio();
      await get().fetchHoldings();
    } catch (error: any) {
      set({
        portfolioError: error.response?.data?.message || '刷新失败',
        isLoadingPortfolio: false
      });
    }
  },

  refreshPrices: async () => {
    set({ isRefreshingPrices: true });
    try {
      const response = await holdingsApi.refreshPrices();
      const result = response.data.data ?? { updated: 0, failed: 0 };
      // 刷新后重新拉取持仓和组合数据
      await get().fetchHoldings();
      await get().fetchPortfolio();
      set({ isRefreshingPrices: false });
      return result;
    } catch (error: any) {
      set({ isRefreshingPrices: false });
      throw error;
    }
  },

  runAnalysis: async () => {
    set({ isLoadingAnalysis: true });
    try {
      await analysisApi.analyze();
      await get().fetchAnalysis();
    } catch (error: any) {
      set({ 
        analysisError: error.response?.data?.message || '分析失败',
        isLoadingAnalysis: false 
      });
    }
  },

  fetchReviews: async (params) => {
    set({ isLoadingReviews: true, reviewsError: null });
    try {
      const response = await reviewApi.getReviews(params);
      const data = response.data.data!;
      set({
        reviews: data.entries,
        reviewTotal: data.total,
        isLoadingReviews: false
      });
    } catch (error: any) {
      set({
        reviewsError: error.response?.data?.message || '获取复盘记录失败',
        isLoadingReviews: false
      });
    }
  },

  createReview: async (data) => {
    const response = await reviewApi.createReview(data as any);
    const newEntry = response.data.data!.entry;
    set(state => ({
      reviews: [newEntry, ...state.reviews],
      reviewTotal: state.reviewTotal + 1
    }));
  },

  updateReview: async (id, data) => {
    const response = await reviewApi.updateReview(id, data as any);
    const updated = response.data.data!.entry;
    set(state => ({
      reviews: state.reviews.map(r => r._id === id ? updated : r)
    }));
  },

  deleteReview: async (id) => {
    await reviewApi.deleteReview(id);
    set(state => ({
      reviews: state.reviews.filter(r => r._id !== id),
      reviewTotal: state.reviewTotal - 1
    }));
  },

  clearErrors: () => set({
    portfolioError: null,
    holdingsError: null,
    analysisError: null,
    rebalanceError: null,
    reviewsError: null,
  }),
}));
