import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { GoogleAuthScreen } from './components/GoogleAuthScreen';
import { KpiOverviewTab } from './components/KpiOverviewTab';
import { DeepAnalyticsTab } from './components/DeepAnalyticsTab';
import { AiActionCenterTab } from './components/AiActionCenterTab';
import { RawDataTab } from './components/RawDataTab';
import { UploadModal } from './components/UploadModal';
import { EmptyStateUpload } from './components/EmptyStateUpload';
import { EcommercePlatformSelector, EcommercePlatform } from './components/EcommercePlatformSelector';
import { ParsedStoreData, GoogleUserProfile } from './types';
import { getSavedGoogleUser, clearGoogleSession } from './utils/googleSheetsService';

export default function App() {
  const [currentUser, setCurrentUser] = useState<GoogleUserProfile | null>(() => getSavedGoogleUser());
  const [currentData, setCurrentData] = useState<ParsedStoreData | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<EcommercePlatform | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'deep' | 'ai' | 'raw'>('overview');
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');

  // Check saved session on mount
  useEffect(() => {
    const saved = getSavedGoogleUser();
    if (saved) {
      setCurrentUser(saved);
    }
  }, []);

  const handleLoginSuccess = (user: GoogleUserProfile) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    clearGoogleSession();
    setCurrentUser(null);
    setCurrentData(null);
    setSelectedPlatform(null);
    setActiveTab('overview');
  };

  const handleDataLoaded = (customData: ParsedStoreData) => {
    setCurrentData(customData);
    setActiveTab('overview');
  };

  const handleSelectPlatform = (platform: EcommercePlatform) => {
    setSelectedPlatform(platform);
  };

  const handleLoadSampleData = (platform: EcommercePlatform, data: ParsedStoreData) => {
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
    <div className="min-h-screen text-slate-100 antialiased flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Navigation Header */}
      <Header
        currentData={currentData}
        selectedPlatform={selectedPlatform}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={() => {}}
        onResetData={handleResetData}
        onChangePlatform={handleChangePlatform}
        onOpenUpload={() => setIsUploadOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        language={language}
        setLanguage={setLanguage}
      />

      {/* Main Content View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">
        {!currentUser ? (
          /* Step 0: Google Account Login Gate */
          <GoogleAuthScreen
            onLoginSuccess={handleLoginSuccess}
            language={language}
          />
        ) : !currentData ? (
          !selectedPlatform ? (
            /* Step 1: E-commerce Platform Selection Portal */
            <EcommercePlatformSelector
              onSelectPlatform={handleSelectPlatform}
              onLoadSampleData={handleLoadSampleData}
              currentUser={currentUser}
              language={language}
            />
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
              />
            )}
          </>
        )}
      </main>

      {/* Zero-Setup Excel Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDataLoaded={handleDataLoaded}
        onSelectSample={() => {}}
      />
    </div>
  );
}

