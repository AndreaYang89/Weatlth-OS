import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
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

  // Page titles
  const pageTitles: Record<TabType, string> = {
    overview:  '资产配置',
    holdings:  '持仓明细',
    ai:        'AI评估',
    rebalance: '调仓计算',
    review:    '复盘日记',
  };

  // Render current page
  const renderPage = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewPage 
            onAddHolding={() => setIsAddModalOpen(true)}
            onNavigateToAI={() => setActiveTab('ai')}
          />
        );
      case 'holdings':
        return <HoldingsPage />;
      case 'ai':
        return <AIAnalysisPage />;
      case 'rebalance':
        return <RebalancePage />;
      case 'review':
        return <ReviewPage />;
      default:
        return <OverviewPage onAddHolding={() => setIsAddModalOpen(true)} onNavigateToAI={() => setActiveTab('ai')} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] pb-24">
      <ToastContainer />
      
      {/* Header */}
      <Header title="WealthOS" subtitle={pageTitles[activeTab]} />
      
      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 pt-20">
        {renderPage()}
      </main>
      
      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Add Holding Modal */}
      <AddHoldingModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
}

export default App;
