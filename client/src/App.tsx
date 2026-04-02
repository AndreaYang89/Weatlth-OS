import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { SideNav } from '@/components/layout/SideNav';
import { ToastContainer } from '@/components/ui/Toast';
import { AddHoldingModal } from '@/components/AddHoldingModal';
import { OverviewPage } from '@/pages/OverviewPage';
import { HoldingsPage } from '@/pages/HoldingsPage';
import { AIAnalysisPage } from '@/pages/AIAnalysisPage';
import { RebalancePage } from '@/pages/RebalancePage';
import { ReviewPage } from '@/pages/ReviewPage';
import { ImportPage } from '@/pages/ImportPage';
import { SettingsPage } from '@/pages/SettingsPage';
import type { TabType } from '@/types';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const pageTitles: Record<TabType, string> = {
    overview: '资产配置', holdings: '持仓明细', ai: 'AI评估',
    rebalance: '调仓计算', review: '复盘日记', import: '导入资产', settings: '系统配置',
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'overview':  return <OverviewPage onAddHolding={() => setIsAddModalOpen(true)} onNavigateToAI={() => setActiveTab('ai')} />;
      case 'holdings':  return <HoldingsPage />;
      case 'ai':        return <AIAnalysisPage />;
      case 'rebalance': return <RebalancePage />;
      case 'review':    return <ReviewPage />;
      case 'import':    return <ImportPage onImportDone={() => setActiveTab('overview')} />;
      case 'settings':  return <SettingsPage />;
      default: return <OverviewPage onAddHolding={() => setIsAddModalOpen(true)} onNavigateToAI={() => setActiveTab('ai')} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <ToastContainer />

      <div className="hidden lg:block">
        <SideNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <div className="lg:ml-56">
        <div className="lg:hidden">
          <Header title="WealthOS" subtitle={pageTitles[activeTab]} />
        </div>

        <div className="hidden lg:block sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-stone-200">
          <div className="px-8 py-3">
            <h2 className="text-sm font-semibold text-stone-700">{pageTitles[activeTab]}</h2>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(217,119,87,0.4)] to-transparent" />
        </div>

        <main className="px-4 pt-20 pb-28 lg:pt-6 lg:pb-8 lg:px-8 max-w-2xl lg:max-w-none mx-auto">
          {renderPage()}
        </main>
      </div>

      <div className="lg:hidden">
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <AddHoldingModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
}

export default App;
