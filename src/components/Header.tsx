import React, { useState, useEffect } from 'react';
import {
  Upload,
  Download,
  Layers,
  Sparkles,
  BarChart3,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  LogOut,
  User,
  ShieldCheck,
  ChevronDown,
  Lock,
  Crown,
  Zap,
  Store,
  LineChart,
  ShoppingBag,
  Briefcase,
} from 'lucide-react';
import { downloadSampleShopeeExcel } from '../utils/excelParser';
import { ParsedStoreData, GoogleUserProfile } from '../types';
import ecompulseAvatar from '../assets/images/ecompulse_avatar_1787721096722.jpg';
import ecompulseLogo from '../assets/images/ecompulse_dolphin_logo.png';
import { ShopeeLogo, TikTokShopLogo } from './PlatformLogos';
import { EcommercePlatform } from './EcommercePlatformSelector';
import { OnPremiseSecurityModal } from './dashboard/OnPremiseSecurityModal';
import { PricingPlansModal } from './pricing/PricingPlansModal';
import { SecurityStatusBadge } from './security/SecurityStatusBadge';
import { ClearLocalDataModal } from './security/ClearLocalDataModal';
import {
  getCurrentSubscription,
  subscribeToPlanChanges,
} from '../utils/subscriptionStorage';
import { UserSubscription } from '../types/pricing';
import type { WorkspaceMode } from '../utils/workspacePreferences';

import { AnalysisTrack } from './DualTrackSelector';
import { DolphinOnboardingTourModal } from './onboarding/DolphinOnboardingTourModal';
import { ThemeToggle } from './ui/primitives';

interface HeaderProps {
  currentData: ParsedStoreData | null;
  selectedPlatform: EcommercePlatform | null;
  currentUser: GoogleUserProfile | null;
  currentTrack?: AnalysisTrack;
  onChangeTrack?: (track: AnalysisTrack) => void;
  onLogout?: () => void;
  onOpenLogin?: () => void;
  onResetData: () => void;
  onChangePlatform?: () => void;
  onOpenUpload: () => void;
  onOpenPricing?: () => void;
  activeTab: 'overview' | 'deep' | 'ai' | 'raw';
  setActiveTab: (tab: 'overview' | 'deep' | 'ai' | 'raw') => void;
  language: 'vi' | 'en';
  setLanguage: (lang: 'vi' | 'en') => void;
  workspaceMode?: WorkspaceMode | null;
  onOpenWorkspaceMode?: () => void;
  /** Seller Mode has its own Data page — hide the classic file/upload controls and tabs. */
  hideDataControls?: boolean;
  /** Workspace colour theme; the toggle shows only when both are given. */
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentData,
  selectedPlatform,
  currentUser,
  currentTrack = 'marketplace',
  onChangeTrack,
  onLogout,
  onOpenLogin,
  onResetData,
  onChangePlatform,
  onOpenUpload,
  onOpenPricing,
  activeTab,
  setActiveTab,
  language,
  setLanguage,
  workspaceMode,
  onOpenWorkspaceMode,
  hideDataControls = false,
  theme,
  onToggleTheme,
}) => {
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const [showPricingModal, setShowPricingModal] = useState<boolean>(false);
  const [showClearDataModal, setShowClearDataModal] = useState<boolean>(false);
  const [showTourModal, setShowTourModal] = useState<boolean>(false);
  const [currentSub, setCurrentSub] = useState<UserSubscription>(() =>
    getCurrentSubscription()
  );

  useEffect(() => {
    setCurrentSub(getCurrentSubscription());
    const unsub = subscribeToPlanChanges((sub) => {
      setCurrentSub(sub);
    });
    return () => unsub();
  }, []);

  const handleOpenPricing = () => {
    if (onOpenPricing) {
      onOpenPricing();
    } else {
      setShowPricingModal(true);
    }
  };

  const renderPlatformBadge = () => {
    if (currentTrack === 'internal_finance') {
      return (
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-up-soft border border-up/30 text-up text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-up animate-pulse" />
          <span className="hidden sm:inline">Tài Chính Nội Bộ</span>
        </div>
      );
    }
    if (!selectedPlatform) return null;
    switch (selectedPlatform) {
      case 'tiktok':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-primary-soft border border-primary/30 text-primary text-xs font-semibold">
            <TikTokShopLogo className="w-4 h-4 rounded-md" />
            <span className="hidden sm:inline">TikTok Shop</span>
          </div>
        );
      case 'shopee':
      default:
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-down-soft border border-down/30 text-down text-xs font-semibold">
            <ShopeeLogo className="w-4 h-4 rounded-md" />
            <span className="hidden sm:inline">Shopee</span>
          </div>
        );
    }
  };

  const isPaid = currentSub.planId !== 'experience';
  const isEnterprise = currentSub.planId === 'enterprise';

  return (
    <>
      <header className="text-fg sticky top-0 z-30 border-b border-line bg-surface">
        <div className="w-full max-w-[1700px] mx-auto px-3 sm:px-5 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3 sm:gap-6">
            
            {/* =========================================================
                LEFT: BRAND LOGO & PLATFORM INDICATOR
            ========================================================= */}
            <div 
              onClick={() => onChangeTrack && onChangeTrack('portal')}
              className="flex items-center space-x-2.5 cursor-pointer group shrink-0 select-none"
              title="Quay về màn hình chọn phân hệ"
            >
              <div className="relative w-9 h-9 rounded-xl overflow-hidden ring-1 ring-line bg-surface shrink-0 group-hover:scale-105 transition-all flex items-center justify-center">
                <img
                  src={ecompulseLogo}
                  alt="EcomPulse AI Logo"
                  className="w-full h-full object-contain p-0.5"
                />
              </div>

              <div className="flex items-center space-x-2">
                <span className="hidden sm:inline text-lg font-black tracking-tight text-fg group-hover:text-primary transition-colors whitespace-nowrap">
                  Ecom<span className="text-primary">Pulse AI</span>
                </span>
                {renderPlatformBadge()}
              </div>
            </div>

            {/* =========================================================
                CENTER: DUAL-TRACK SEGMENTED SWITCHER (Luồng 1 & Luồng 2)
            ========================================================= */}
            {onChangeTrack && (
              <div className="hidden lg:flex items-center bg-surface-2 p-1 rounded-control border border-line shrink-0">
                <button
                  id="nav-track-marketplace"
                  onClick={() => onChangeTrack('marketplace')}
                  className={`flex items-center space-x-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    currentTrack === 'marketplace'
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted hover:text-fg hover:bg-hover'
                  }`}
                  title="Phân tích & Đối soát Sàn TMĐT (Shopee, TikTok Shop)"
                >
                  <ShoppingBag className="w-4 h-4" aria-hidden />
                  <span>Phân Tích Sàn (Shopee & TikTok)</span>
                </button>

                <button
                  id="nav-track-internal-finance"
                  onClick={() => onChangeTrack('internal_finance')}
                  className={`flex items-center space-x-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    currentTrack === 'internal_finance'
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted hover:text-fg hover:bg-hover'
                  }`}
                  title="Báo cáo P&L, Cơ cấu chi phí & Tài chính nội bộ doanh nghiệp"
                >
                  <Briefcase className="w-4 h-4" aria-hidden />
                  <span>Tài Chính Nội Bộ</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-up-soft text-up font-extrabold border border-up/30 uppercase hidden sm:inline">
                    New
                  </span>
                </button>
              </div>
            )}

            {/* =========================================================
                RIGHT: ACTIONS, TOOLS & USER PROFILE
            ========================================================= */}
            <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
              
              {/* Workspace mode (Seller / Analyst) */}
              {onOpenWorkspaceMode && workspaceMode && (
                <button
                  onClick={onOpenWorkspaceMode}
                  className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold whitespace-nowrap shrink-0 transition-all ${
                    workspaceMode === 'seller'
                      ? 'bg-down-soft border-down/30 text-down hover:bg-down-soft'
                      : 'bg-primary-soft border-primary/30 text-primary hover:bg-primary-soft'
                  }`}
                  title={language === 'vi' ? 'Đổi chế độ làm việc' : 'Switch workspace mode'}
                >
                  {workspaceMode === 'seller' ? <Store className="w-3.5 h-3.5" /> : <LineChart className="w-3.5 h-3.5" />}
                  <span>
                    {workspaceMode === 'seller'
                      ? language === 'vi' ? 'Chủ shop' : 'Seller'
                      : language === 'vi' ? 'Analyst' : 'Analyst'}
                  </span>
                </button>
              )}

              {/* Security Shield Compact Badge */}
              <div className="hidden lg:flex items-center shrink-0">
                <SecurityStatusBadge
                  variant="compact"
                  onClick={() => setShowSecurityModal(true)}
                  language={language}
                />
              </div>

              {/* Pricing & Plan Pill */}
              <button
                id="btn-pricing-plans"
                onClick={handleOpenPricing}
                className={`hidden md:inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-xs font-bold shadow-sm whitespace-nowrap shrink-0 group ${
                  isEnterprise
                    ? 'bg-primary-soft border-primary/30 text-primary'
                    : isPaid
                    ? 'bg-warn-soft border-warn/30 text-warn'
                    : 'bg-surface-2 hover:bg-hover border-line text-fg hover:text-fg'
                }`}
                title="Quản lý gói & Nâng cấp Premium"
              >
                <Crown
                  className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${
                    isEnterprise ? 'text-primary' : isPaid ? 'text-warn' : 'text-warn'
                  }`}
                />
                <span className="text-[11px]">
                  {isEnterprise
                    ? 'ENTERPRISE 👑'
                    : isPaid
                    ? currentSub.planId === 'pro_semi_annual'
                      ? 'PRO 6T ⭐'
                      : 'PRO Tháng'
                    : 'Gói Pro'}
                </span>
              </button>

              {/* Data File Status / Reset */}
              {hideDataControls ? null : currentData ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="hidden 2xl:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-up-soft border border-up/30 text-up text-xs font-medium whitespace-nowrap">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-up shrink-0" />
                    <span className="truncate max-w-[140px]" title={currentData.fileName}>
                      {currentData.fileName}
                    </span>
                  </div>

                  {onChangePlatform && (
                    <button
                      onClick={onChangePlatform}
                      className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-fg hover:text-fg bg-surface-2 hover:bg-hover border border-line rounded-xl transition-all shadow-sm whitespace-nowrap shrink-0"
                      title="Đổi sàn thương mại điện tử khác"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1 text-primary" />
                      <span className="hidden sm:inline">Đổi sàn</span>
                    </button>
                  )}

                  <button
                    id="btn-reset-data"
                    onClick={onResetData}
                    className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-fg hover:text-down bg-surface-2 hover:bg-down-soft border border-line hover:border-down/30 rounded-xl transition-all shadow-sm whitespace-nowrap shrink-0"
                    title="Xóa dữ liệu hiện tại để tải file khác"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    <span className="hidden sm:inline">Xóa file</span>
                  </button>
                </div>
              ) : selectedPlatform && onChangePlatform ? (
                <button
                  onClick={onChangePlatform}
                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-fg hover:text-fg bg-surface-2 hover:bg-hover border border-line rounded-xl transition-all shadow-sm whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1 text-primary" />
                  <span>Đổi sàn</span>
                </button>
              ) : null}

              {/* Download Sample Excel */}
              {!hideDataControls && (<>
              <button
                id="btn-download-sample"
                onClick={downloadSampleShopeeExcel}
                className="hidden xl:inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-fg hover:text-fg bg-surface-2 hover:bg-hover border border-line rounded-xl transition-all shadow-sm whitespace-nowrap shrink-0"
                title="Tải file Excel mẫu 21 sheet chuẩn để thử nghiệm"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-primary" />
                <span>Mẫu .XLSX</span>
              </button>

              {/* Main Upload / Import Button */}
              <button
                id="btn-open-upload-modal"
                onClick={onOpenUpload}
                className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-primary-contrast bg-primary hover:opacity-90 rounded-xl transition-all active:scale-95 whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                <span>{currentData ? 'Tải file khác' : 'Nhập Excel'}</span>
              </button>
              </>)}

              {/* Tour Guide Button */}
              <button
                id="btn-header-tour-guide"
                onClick={() => setShowTourModal(true)}
                className="hidden lg:inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-primary hover:text-fg bg-primary-soft hover:bg-hover border border-primary/30 rounded-xl transition-all shadow-sm whitespace-nowrap shrink-0 active:scale-95"
                title="Mở Tour hướng dẫn sử dụng 1 phút"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Tour 1 Phút</span>
              </button>

              {/* Language Toggle */}
              <button
                id="btn-lang-toggle"
                onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
                className="h-10 min-w-10 px-2 text-xs font-bold text-fg bg-surface hover:bg-hover rounded-control border border-line transition-colors whitespace-nowrap shrink-0"
                title="Chuyển đổi ngôn ngữ / Switch Language"
              >
                {language.toUpperCase()}
              </button>

              {/* Light / dark (workspace only) */}
              {theme && onToggleTheme && <ThemeToggle theme={theme} onToggle={onToggleTheme} lang={language} />}

              {/* User Profile & Account Dropdown */}
              {currentUser ? (
                <div className="relative shrink-0">
                  <button
                    id="btn-user-profile-menu"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-xl bg-surface-2 hover:bg-hover border border-line transition-all shadow-sm group shrink-0"
                    title={currentUser.email}
                  >
                    {currentUser.picture ? (
                      <img
                        src={currentUser.picture}
                        alt={currentUser.name}
                        className="w-6 h-6 rounded-lg object-cover ring-1 ring-line"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center text-[11px] font-bold text-primary-contrast">
                        {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 text-muted group-hover:text-fg transition-transform" />
                  </button>

                  {/* Dropdown Menu */}
                  {showUserMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowUserMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-surface border border-line shadow-card p-3.5 z-50 animate-fadeIn">
                        <div className="flex items-center gap-3 pb-3 border-b border-line">
                          {currentUser.picture ? (
                            <img
                              src={currentUser.picture}
                              alt={currentUser.name}
                              className="w-10 h-10 rounded-xl object-cover ring-2 ring-emerald-500/50"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-sm font-bold text-primary-contrast">
                              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-fg truncate">
                              {currentUser.name}
                            </p>
                            <p className="text-[11px] text-muted truncate">
                              {currentUser.email}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] text-warn bg-warn-soft px-1.5 py-0.5 rounded border border-warn/30 font-bold">
                                <Crown className="w-2.5 h-2.5" />
                                {currentSub.planName}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] text-up bg-up-soft px-1.5 py-0.5 rounded border border-up/30">
                                <Lock className="w-2.5 h-2.5" />
                                Local IndexedDB
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 space-y-1">
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              handleOpenPricing();
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-warn hover:text-fg hover:bg-warn-soft rounded-xl transition-all flex items-center justify-between group"
                          >
                            <span className="flex items-center space-x-2">
                              <Crown className="w-3.5 h-3.5 text-warn" />
                              <span>{language === 'vi' ? 'Quản lý Gói & Nâng Cấp' : 'Subscription & Upgrade'}</span>
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-warn-soft text-warn font-bold">
                              Pro
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              setShowSecurityModal(true);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-up hover:text-fg hover:bg-up-soft rounded-xl transition-all flex items-center space-x-2"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-up" />
                            <span>Trung Tâm Bảo Mật On-Premise</span>
                          </button>

                          {onOpenWorkspaceMode && (
                            <button
                              onClick={() => {
                                setShowUserMenu(false);
                                onOpenWorkspaceMode();
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-primary hover:text-fg hover:bg-primary-soft rounded-xl transition-all flex items-center space-x-2"
                            >
                              <LineChart className="w-3.5 h-3.5 text-primary" />
                              <span>{language === 'vi' ? 'Chế độ làm việc (Seller / Analyst)' : 'Workspace mode (Seller / Analyst)'}</span>
                            </button>
                          )}

                          {/* Feature 3: Clear All Local Data button in Menu */}
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              setShowClearDataModal(true);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-down hover:text-fg hover:bg-down-soft rounded-xl transition-all flex items-center space-x-2"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-down" />
                            <span>Xóa Sạch Dữ Liệu Local (1-Click)</span>
                          </button>

                          {onLogout && (
                            <button
                              id="btn-logout"
                              onClick={() => {
                                setShowUserMenu(false);
                                onLogout();
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-fg hover:text-fg hover:bg-hover rounded-xl transition-all flex items-center space-x-2 border-t border-line mt-1 pt-2"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              <span>
                                {language === 'vi'
                                  ? 'Đăng xuất phiên làm việc'
                                  : 'Sign out'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Navigation Sub-Header (Tabs) */}
          {currentData && !hideDataControls && (
            <div className="flex border-t border-line overflow-x-auto no-scrollbar py-2.5 gap-2 sm:gap-3">
              <button
                id="nav-tab-overview"
                onClick={() => setActiveTab('overview')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'overview'
                    ? 'bg-primary-soft text-primary border border-primary/30 shadow-md'
                    : 'text-fg hover:text-fg hover:bg-hover border border-transparent'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>{language === 'vi' ? 'Tổng Quan KPI' : 'KPI Overview'}</span>
              </button>

              <button
                id="nav-tab-deep"
                onClick={() => setActiveTab('deep')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'deep'
                    ? 'bg-primary-soft text-primary border border-primary/30 shadow-md'
                    : 'text-fg hover:text-fg hover:bg-hover border border-transparent'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>{language === 'vi' ? 'Phân Tích Đa Chiều' : 'Deep Analytics'}</span>
              </button>

              <button
                id="nav-tab-ai"
                onClick={() => setActiveTab('ai')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'ai'
                    ? 'bg-primary-soft text-primary border border-primary/30'
                    : 'text-fg hover:text-fg hover:bg-hover border border-transparent'
                }`}
              >
                <Sparkles className="w-4 h-4 text-primary" />
                <span>{language === 'vi' ? 'Trung Tâm Quyết Định AI' : 'AI Decision Center'}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-primary-soft text-primary text-[10px] font-bold border border-primary/30 hidden sm:inline">
                  Phase 2
                </span>
              </button>

              <button
                id="nav-tab-raw"
                onClick={() => setActiveTab('raw')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'raw'
                    ? 'bg-primary-soft text-primary border border-primary/30 shadow-md'
                    : 'text-fg hover:text-fg hover:bg-hover border border-transparent'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{language === 'vi' ? 'Dữ Liệu Thô Chi Tiết' : 'Raw Sheet Data'}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* On-Premise Security & Privacy Center Modal */}
      <OnPremiseSecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        userId={currentUser?.id || currentUser?.email || 'local-user'}
        language={language}
      />

      {/* Clear Local Data Modal */}
      <ClearLocalDataModal
        isOpen={showClearDataModal}
        onClose={() => setShowClearDataModal(false)}
        onCleared={() => {
          onResetData();
        }}
        language={language}
      />

      {/* Pricing & Subscription Plans Modal */}
      <PricingPlansModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        language={language}
      />

      {/* Dolphin Onboarding Tour Modal */}
      <DolphinOnboardingTourModal
        isOpen={showTourModal}
        onClose={() => setShowTourModal(false)}
        onStartMarketplace={() => onChangeTrack && onChangeTrack('marketplace')}
        onStartInternalFinance={() => onChangeTrack && onChangeTrack('internal_finance')}
        onOpenUpload={onOpenUpload}
        language={language}
      />
    </>
  );
};
