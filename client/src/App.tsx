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
import type { TabType } from '@/types';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const pageTitles: Record<TabType, string> = {
    overview:  '资产配置',
    holdings:  '持仓明细',
    ai:        'AI评估',
    rebalance: '调仓计算',
    review:    '复盘日记',
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewPage
            onAddHolding={() => setIsAddModalOpen(true)}
            onNavigateToAI={() => setActiveTab('ai')}
          />
        );
      case 'holdings':  return <HoldingsPage />;
      case 'ai':        return <AIAnalysisPage />;
      case 'rebalance': return <RebalancePage />;
      case 'review':    return <ReviewPage />;
      default:
        return <OverviewPage onAddHolding={() => setIsAddModalOpen(true)} onNavigateToAI={() => setActiveTab('ai')} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#020617]">
      <ToastContainer />

      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <SideNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Content area - offset by sidebar on desktop */}
      <div className="lg:ml-56">
        {/* Header - mobile only (desktop uses sidebar for branding) */}
        <div className="lg:hidden">
          <Header title="WealthOS" subtitle={pageTitles[activeTab]} />
        </div>

        {/* Desktop top bar */}
        <div className="hidden lg:block sticky top-0 z-40 bg-[rgba(2,6,23,0.85)] backdrop-blur-xl border-b border-white/[0.08]">
          <div className="px-8 py-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">{pageTitles[activeTab]}</h2>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
        </div>

        {/* Main content */}
        <main className="px-4 pt-20 pb-28 lg:pt-6 lg:pb-8 lg:px-8 max-w-2xl lg:max-w-none mx-auto">
          {renderPage()}
        </main>
      </div>

      {/* Bottom nav - mobile only */}
      <div className="lg:hidden">
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <AddHoldingModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}

export default App;
