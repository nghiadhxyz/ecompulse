import React, { Suspense, lazy, useState } from 'react';
import { flushSync } from 'react-dom';
import { Header } from './components/Header';
import { DualTrackSelector, AnalysisTrack } from './components/DualTrackSelector';
import { UploadModal } from './components/UploadModal';
import type { EcommercePlatform } from './components/EcommercePlatformSelector';
import { ParsedStoreData, GoogleUserProfile } from './types';
import { getSavedGoogleUser, clearGoogleSession } from './utils/googleSheetsService';
import { WorkspaceModeSelector } from './components/onboarding/WorkspaceModeSelector';
import { getSavedWorkspaceMode, saveWorkspaceMode, WorkspaceMode } from './utils/workspacePreferences';
import { useTheme } from './theme/useTheme';
import { wipeAllLocalData } from './utils/localDatabaseService';
// Workspaces load on demand to keep the initial bundle small.
const SellerWorkspace = lazy(() => import('./components/seller/SellerWorkspace').then((m) => ({ default: m.SellerWorkspace })));
const InternalFinanceModule = lazy(() => import('./components/internal-finance/InternalFinanceModule').then((m) => ({ default: m.InternalFinanceModule })));
const AnalystWorkspace = lazy(() => import('./components/analyst/AnalystWorkspace').then((m) => ({ default: m.AnalystWorkspace })));

export default function App() {
  const [currentUser, setCurrentUser] = useState<GoogleUserProfile>(() => getSavedGoogleUser());
  const [analysisTrack, setAnalysisTrack] = useState<AnalysisTrack>('portal');
  const [currentData, setCurrentData] = useState<ParsedStoreData | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<EcommercePlatform | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode | null>(() => getSavedWorkspaceMode());
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState<boolean>(false);
  const [wiping, setWiping] = useState(false);
  const [openUploadOnMount, setOpenUploadOnMount] = useState(false);
  // The demo opens the order-level 3-month dataset.
  const [sellerDemoRequested, setSellerDemoRequested] = useState<boolean>(false);
  const sellerMode = analysisTrack === 'marketplace' && workspaceMode === 'seller';
  const analystMode = analysisTrack === 'marketplace' && workspaceMode === 'analyst';
  const workspaceShell = sellerMode || analystMode;
  const [theme, setTheme] = useTheme();

  const handleChangeTrack = (track: AnalysisTrack) => {
    if (track !== 'marketplace') setOpenUploadOnMount(false);
    setAnalysisTrack(track);
  };

  const handleSelectWorkspaceMode = (mode: WorkspaceMode) => {
    setOpenUploadOnMount(false);
    saveWorkspaceMode(mode);
    setWorkspaceMode(mode);
    setIsModeSelectorOpen(false);
  };

  // First-run onboarding step: ask once, when the user first enters the workspace.
  const mustChooseMode = analysisTrack !== 'portal' && workspaceMode === null;

  const handleLogout = () => {
    setOpenUploadOnMount(false);
    clearGoogleSession();
    setCurrentData(null);
    setSelectedPlatform(null);
    setAnalysisTrack('portal');
    setCurrentUser(getSavedGoogleUser());
  };

  const handleDataLoaded = (customData: ParsedStoreData) => {
    setAnalysisTrack('marketplace');
    setCurrentData(customData);
  };

  const handleLoadSampleData = (platform: EcommercePlatform, data: ParsedStoreData) => {
    setOpenUploadOnMount(false);
    setAnalysisTrack('marketplace');
    setSellerDemoRequested(true);
    setSelectedPlatform(platform);
    setCurrentData(data);
  };

  const handleResetData = () => {
    setCurrentData(null);
    setSelectedPlatform(null);
  };

  const handleWipeLocalData = async () => {
    // Stop the active workspace and close its import UI before clearing persisted data.
    flushSync(() => setWiping(true));
    try {
      if (!await wipeAllLocalData()) return false;
      handleResetData();
      setSellerDemoRequested(false);
      setIsUploadOpen(false);
      setIsModeSelectorOpen(false);
      setCurrentUser(getSavedGoogleUser());
      const mode = workspaceMode ?? 'seller';
      saveWorkspaceMode(mode);
      setWorkspaceMode(mode);
      setOpenUploadOnMount(true);
      setAnalysisTrack('marketplace');
      window.scrollTo(0, 0);
      return true;
    } finally {
      setWiping(false);
    }
  };

  const handleChangePlatform = () => {
    setCurrentData(null);
    setSelectedPlatform(null);
  };

  return (
    <div
      data-theme={workspaceShell ? theme : undefined}
      className={workspaceShell ? 'ep-app min-h-screen antialiased flex flex-col' : 'min-h-screen bg-[#070a18] text-slate-100 antialiased flex flex-col selection:bg-purple-500 selection:text-white'}
    >
      {/* Navigation Header only shown when not on top landing portal */}
      {analysisTrack !== 'portal' && (
        <Header
          currentData={currentData}
          selectedPlatform={selectedPlatform}
          currentUser={currentUser}
          currentTrack={analysisTrack}
          onChangeTrack={handleChangeTrack}
          onLogout={handleLogout}
          onOpenLogin={() => {}}
          onResetData={handleResetData}
          onWipeLocalData={handleWipeLocalData}
          onChangePlatform={handleChangePlatform}
          onOpenUpload={() => setIsUploadOpen(true)}
          language={language}
          setLanguage={setLanguage}
          workspaceMode={workspaceMode}
          onOpenWorkspaceMode={() => setIsModeSelectorOpen(true)}
          hideDataControls={sellerMode || analystMode}
          theme={workspaceShell ? theme : undefined}
          onToggleTheme={workspaceShell ? () => setTheme(theme === 'light' ? 'dark' : 'light') : undefined}
        />
      )}

      {/* Main Content View Container */}
      <main className={`flex-1 w-full mx-auto ${analysisTrack === 'portal' ? 'px-0 pt-0 pb-0' : workspaceShell ? 'px-4 lg:px-6 pt-4 pb-12' : 'max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-12'}`}>
        {/* =========================================================================
            TRACK 0: TOP-LEVEL LANDING PAGE & TRACK SELECTION PORTAL
        ========================================================================= */}
        {analysisTrack === 'portal' && (
          <DualTrackSelector
            onSelectTrack={handleChangeTrack}
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
        {sellerMode && !wiping && (
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
            openUploadOnMount={openUploadOnMount}
          />
          </Suspense>
        )}

        {analystMode && !wiping && (
          <Suspense fallback={<div className="text-sm text-slate-400 p-8 text-center">{language === 'vi' ? 'Đang tải…' : 'Loading…'}</div>}>
            <AnalystWorkspace
              theme={theme}
              language={language}
              setLanguage={setLanguage}
              onChangeMode={handleSelectWorkspaceMode}
              legacyData={currentData}
              legacyPlatform={selectedPlatform}
              startWithDemo={sellerDemoRequested}
              onDemoStarted={() => setSellerDemoRequested(false)}
              openUploadOnMount={openUploadOnMount}
            />
          </Suspense>
        )}

        {/* =========================================================================
            TRACK 2: PHÂN TÍCH TÀI CHÍNH & VẬN HÀNH NỘI BỘ (P&L, COGS, PARETO SKU, TỪ ĐIỂN TMĐT)
        ========================================================================= */}
        {analysisTrack === 'internal_finance' && !wiping && (
          <Suspense fallback={<div className="text-sm text-slate-400 p-8 text-center">{language === 'vi' ? 'Đang tải…' : 'Loading…'}</div>}>
            <InternalFinanceModule
              onBackToPortal={() => setAnalysisTrack('portal')}
              language={language}
            />
          </Suspense>
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
