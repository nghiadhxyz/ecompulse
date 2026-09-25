import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { DualTrackSelector, AnalysisTrack } from './components/DualTrackSelector';
import { InternalFinanceModule } from './components/internal-finance/InternalFinanceModule';
import { KpiOverviewTab } from './components/KpiOverviewTab';
import { DeepAnalyticsTab } from './components/DeepAnalyticsTab';
import { AiActionCenterTab } from './components/AiActionCenterTab';
import { RawDataTab } from './components/RawDataTab';
import { UploadModal } from './components/UploadModal';
import { EmptyStateUpload } from './components/EmptyStateUpload';
import { EcommercePlatformSelector, EcommercePlatform } from './components/EcommercePlatformSelector';
import { ParsedStoreData, GoogleUserProfile } from './types';
import { getSavedGoogleUser, clearGoogleSession } from './utils/googleSheetsService';
import { ArrowLeft } from 'lucide-react';
import { WorkspaceModeSelector } from './components/onboarding/WorkspaceModeSelector';
import { getSavedWorkspaceMode, saveWorkspaceMode, WorkspaceMode } from './utils/workspacePreferences';
import { canonicalFromParsedStoreData } from './analytics';
// Seller Mode (engines + demo generator) loads on demand to keep the initial bundle small.
const SellerWorkspace = lazy(() => import('./components/seller/SellerWorkspace').then((m) => ({ default: m.SellerWorkspace })));

export default function App() {
  const [currentUser, setCurrentUser] = useState<GoogleUserProfile>(() => getSavedGoogleUser());
  const [analysisTrack, setAnalysisTrack] = useState<AnalysisTrack>('portal');
  const [currentData, setCurrentData] = useState<ParsedStoreData | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<EcommercePlatform | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'deep' | 'ai' | 'raw'>('overview');
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode | null>(() => getSavedWorkspaceMode());
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState<boolean>(false);
  // "Xem demo" in Seller Mode opens the order-level 3-month demo instead of the classic one.
  const [sellerDemoRequested, setSellerDemoRequested] = useState<boolean>(false);
  const sellerMode = analysisTrack === 'marketplace' && workspaceMode === 'seller';

  // One canonical dataset per loaded file; every analytics view reads from it.
  const canonicalData = useMemo(
    () => (currentData ? canonicalFromParsedStoreData(currentData, selectedPlatform) : null),
    [currentData, selectedPlatform],
  );

  const handleSelectWorkspaceMode = (mode: WorkspaceMode) => {
    saveWorkspaceMode(mode);
    setWorkspaceMode(mode);
    setIsModeSelectorOpen(false);
  };

  // First-run onboarding step: ask once, when the user first enters the workspace.
  const mustChooseMode = analysisTrack !== 'portal' && workspaceMode === null;

  const handleLogout = () => {
    clearGoogleSession();
    setCurrentData(null);
    setSelectedPlatform(null);
    setAnalysisTrack('portal');
    setActiveTab('overview');
    setCurrentUser(getSavedGoogleUser());
  };

  const handleDataLoaded = (customData: ParsedStoreData) => {
    setAnalysisTrack('marketplace');
    setCurrentData(customData);
    setActiveTab('overview');
  };

  const handleSelectPlatform = (platform: EcommercePlatform) => {
    setSelectedPlatform(platform);
  };

  const handleLoadSampleData = (platform: EcommercePlatform, data: ParsedStoreData) => {
    setAnalysisTrack('marketplace');
    setSellerDemoRequested(true);
    setSelectedPlatform(platform);
    setCurrentData(data);
    setActiveTab('overview');
  };

  const handleResetData = () => {
    setCurrentData(null);
    setSelectedPlatform(null);
    setActiveTab('overview');
  };

  const handleChangePlatform = () => {
    setCurrentData(null);
    setSelectedPlatform(null);
  };

  return (
    <div className="min-h-screen bg-[#070a18] text-slate-100 antialiased flex flex-col selection:bg-purple-500 selection:text-white">
      {/* Navigation Header only shown when not on top landing portal */}
      {analysisTrack !== 'portal' && (
        <Header
          currentData={currentData}
          selectedPlatform={selectedPlatform}
          currentUser={currentUser}
          currentTrack={analysisTrack}
          onChangeTrack={(track) => setAnalysisTrack(track)}
          onLogout={handleLogout}
          onOpenLogin={() => {}}
          onResetData={handleResetData}
          onChangePlatform={handleChangePlatform}
          onOpenUpload={() => setIsUploadOpen(true)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          language={language}
          setLanguage={setLanguage}
          workspaceMode={workspaceMode}
          onOpenWorkspaceMode={() => setIsModeSelectorOpen(true)}
          hideDataControls={sellerMode}
        />
      )}

      {/* Main Content View Container */}
      <main className={`flex-1 w-full mx-auto ${analysisTrack === 'portal' ? 'px-0 pt-0 pb-0' : 'max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-12'}`}>
        {/* =========================================================================
            TRACK 0: TOP-LEVEL LANDING PAGE & TRACK SELECTION PORTAL
        ========================================================================= */}
        {analysisTrack === 'portal' && (
          <DualTrackSelector
            onSelectTrack={(track) => setAnalysisTrack(track)}
            onLoadDemoSample={(demoData) => handleLoadSampleData('shopee', demoData)}
            onOpenUpload={() => setIsUploadOpen(true)}
            data={currentData}
            currentUser={currentUser}
            language={language}
          />
        )}

        {/* =========================================================================
            TRACK 1: PHÂN TÍCH SÀN THƯƠNG MẠI ĐIỆN TỬ (3 SÀN TMĐT: SHOPEE, TIKTOK, LAZADA)
        ========================================================================= */}
        {sellerMode && (
          <Suspense fallback={<div className="text-sm text-slate-400 p-8 text-center">{language === 'vi' ? 'Đang tải…' : 'Loading…'}</div>}>
          <SellerWorkspace
            language={language}
            setLanguage={setLanguage}
            workspaceMode="seller"
            onChangeMode={handleSelectWorkspaceMode}
            legacyData={currentData}
            legacyPlatform={selectedPlatform}
            startWithDemo={sellerDemoRequested}
            onDemoStarted={() => setSellerDemoRequested(false)}
          />
          </Suspense>
        )}

        {analysisTrack === 'marketplace' && !sellerMode && (
          <>
            {!currentData ? (
              !selectedPlatform ? (
                /* Step 1: E-commerce Platform Selection Portal */
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2">
                    <button
                      onClick={() => setAnalysisTrack('portal')}
                      className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 mr-1.5 transition-transform group-hover:-translate-x-1" />
                      <span>{language === 'vi' ? 'Quay về Trang chủ' : 'Back to Home'}</span>
                    </button>
                    <span className="text-xs font-bold text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-400/20">
                      🚀 Luồng 1 • Phân hệ Sàn TMĐT
                    </span>
                  </div>

                  <EcommercePlatformSelector
                    onSelectPlatform={handleSelectPlatform}
                    onLoadSampleData={handleLoadSampleData}
                    currentUser={currentUser}
                    language={language}
                  />
                </div>
              ) : (
                /* Step 2: Drag & Drop / Upload Excel with Platform Context */
                <EmptyStateUpload
                  selectedPlatform={selectedPlatform}
                  onBackToPlatformSelector={() => setSelectedPlatform(null)}
                  onDataLoaded={handleDataLoaded}
                  language={language}
                />
              )
            ) : (
              /* Step 3: Multi-Tab Analytics Dashboard */
              <>
                {activeTab === 'overview' && (
                  <KpiOverviewTab
                    data={currentData}
                    onNavigateToTab={setActiveTab}
                    language={language}
                  />
                )}

                {activeTab === 'deep' && (
                  <DeepAnalyticsTab
                    data={currentData}
                    language={language}
                  />
                )}

                {activeTab === 'ai' && (
                  <AiActionCenterTab
                    data={currentData}
                    language={language}
                  />
                )}

                {activeTab === 'raw' && (
                  <RawDataTab
                    data={currentData}
                    canonical={canonicalData}
                    language={language}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* =========================================================================
            TRACK 2: PHÂN TÍCH TÀI CHÍNH & VẬN HÀNH NỘI BỘ (P&L, COGS, PARETO SKU, TỪ ĐIỂN TMĐT)
        ========================================================================= */}
        {analysisTrack === 'internal_finance' && (
          <InternalFinanceModule
            onBackToPortal={() => setAnalysisTrack('portal')}
            language={language}
          />
        )}
      </main>

      <WorkspaceModeSelector
        isOpen={mustChooseMode || isModeSelectorOpen}
        currentMode={workspaceMode}
        onSelect={handleSelectWorkspaceMode}
        onClose={mustChooseMode ? undefined : () => setIsModeSelectorOpen(false)}
        language={language}
      />

      {/* Direct Excel Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDataLoaded={handleDataLoaded}
        onSelectSample={() => {}}
      />
    </div>
  );
}
