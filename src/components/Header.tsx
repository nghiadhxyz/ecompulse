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
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">Tài Chính Nội Bộ</span>
        </div>
      );
    }
    if (!selectedPlatform) return null;
    switch (selectedPlatform) {
      case 'tiktok':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-semibold backdrop-blur-md">
            <TikTokShopLogo className="w-4 h-4 rounded-md" />
            <span className="hidden sm:inline">TikTok Shop</span>
          </div>
        );
      case 'shopee':
      default:
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-orange-500/15 border border-orange-400/30 text-orange-300 text-xs font-semibold backdrop-blur-md">
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
      <header className="text-white sticky top-0 z-30 shadow-2xl border-b border-white/[0.1] bg-slate-950/80 backdrop-blur-2xl">
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
              <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/40 backdrop-blur-md bg-[#080d24] shrink-0 group-hover:scale-105 transition-all flex items-center justify-center">
                <img
                  src={ecompulseLogo}
                  alt="EcomPulse AI Logo"
                  className="w-full h-full object-contain p-0.5"
                />
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-lg font-black tracking-tight text-white group-hover:text-blue-200 transition-colors whitespace-nowrap">
                  Ecom<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Pulse AI</span>
                </span>
                {renderPlatformBadge()}
              </div>
            </div>

            {/* =========================================================
                CENTER: DUAL-TRACK SEGMENTED SWITCHER (Luồng 1 & Luồng 2)
            ========================================================= */}
            {onChangeTrack && (
              <div className="flex items-center bg-slate-900/90 p-1 rounded-2xl border border-white/15 backdrop-blur-xl shadow-lg shadow-black/20 shrink-0">
                <button
                  id="nav-track-marketplace"
                  onClick={() => onChangeTrack('marketplace')}
                  className={`flex items-center space-x-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    currentTrack === 'marketplace'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-500/25 border border-sky-400/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.08] border border-transparent'
                  }`}
                  title="Phân tích & Đối soát Sàn TMĐT (Shopee, TikTok Shop)"
                >
                  <span className="text-sm">🚀</span>
                  <span>Phân Tích Sàn (Shopee & TikTok)</span>
                </button>

                <button
                  id="nav-track-internal-finance"
                  onClick={() => onChangeTrack('internal_finance')}
                  className={`flex items-center space-x-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    currentTrack === 'internal_finance'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25 border border-emerald-400/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.08] border border-transparent'
                  }`}
                  title="Báo cáo P&L, Cơ cấu chi phí & Tài chính nội bộ doanh nghiệp"
                >
                  <span className="text-sm">💼</span>
                  <span>Tài Chính Nội Bộ</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-400/20 text-emerald-300 font-extrabold border border-emerald-400/30 uppercase hidden sm:inline">
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
                      ? 'bg-orange-500/10 border-orange-400/30 text-orange-300 hover:bg-orange-500/20'
                      : 'bg-sky-500/10 border-sky-400/30 text-sky-300 hover:bg-sky-500/20'
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
                className={`hidden md:inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-xs font-bold shadow-sm backdrop-blur-md whitespace-nowrap shrink-0 group ${
                  isEnterprise
                    ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 border-cyan-400/50 text-cyan-300 hover:text-white'
                    : isPaid
                    ? 'bg-gradient-to-r from-amber-500/20 to-purple-500/20 border-amber-400/50 text-amber-300 hover:text-white'
                    : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/15 text-slate-300 hover:text-white'
                }`}
                title="Quản lý gói & Nâng cấp Premium"
              >
                <Crown
                  className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${
                    isEnterprise ? 'text-cyan-400' : isPaid ? 'text-amber-400' : 'text-amber-400/80'
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
              {currentData ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="hidden 2xl:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-medium backdrop-blur-md whitespace-nowrap">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate max-w-[140px]" title={currentData.fileName}>
                      {currentData.fileName}
                    </span>
                  </div>

                  {onChangePlatform && (
                    <button
                      onClick={onChangePlatform}
                      className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] rounded-xl transition-all shadow-sm whitespace-nowrap shrink-0"
                      title="Đổi sàn thương mại điện tử khác"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                      <span className="hidden sm:inline">Đổi sàn</span>
                    </button>
                  )}

                  <button
                    id="btn-reset-data"
                    onClick={onResetData}
                    className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-300 bg-white/[0.06] hover:bg-rose-500/15 border border-white/[0.12] hover:border-rose-400/30 rounded-xl transition-all shadow-sm whitespace-nowrap shrink-0"
                    title="Xóa dữ liệu hiện tại để tải file khác"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    <span className="hidden sm:inline">Xóa file</span>
                  </button>
                </div>
              ) : selectedPlatform && onChangePlatform ? (
                <button
                  onClick={onChangePlatform}
                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] rounded-xl transition-all shadow-sm whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                  <span>Đổi sàn</span>
                </button>
              ) : null}

              {/* Download Sample Excel */}
              <button
                id="btn-download-sample"
                onClick={downloadSampleShopeeExcel}
                className="hidden xl:inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] rounded-xl transition-all shadow-sm backdrop-blur-md whitespace-nowrap shrink-0"
                title="Tải file Excel mẫu 21 sheet chuẩn để thử nghiệm"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-blue-300" />
                <span>Mẫu .XLSX</span>
              </button>

              {/* Main Upload / Import Button */}
              <button
                id="btn-open-upload-modal"
                onClick={onOpenUpload}
                className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl transition-all shadow-lg shadow-blue-500/25 border border-blue-400/30 active:scale-95 whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                <span>{currentData ? 'Tải file khác' : 'Nhập Excel'}</span>
              </button>

              {/* Tour Guide Button */}
              <button
                id="btn-header-tour-guide"
                onClick={() => setShowTourModal(true)}
                className="hidden lg:inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-cyan-300 hover:text-white bg-gradient-to-r from-cyan-500/15 to-blue-500/15 hover:from-cyan-500/25 hover:to-blue-500/25 border border-cyan-400/40 rounded-xl transition-all shadow-sm backdrop-blur-md whitespace-nowrap shrink-0 active:scale-95"
                title="Mở Tour hướng dẫn sử dụng 1 phút"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>Tour 1 Phút</span>
              </button>

              {/* Language Toggle */}
              <button
                id="btn-lang-toggle"
                onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
                className="px-2 py-1 text-xs font-bold text-slate-200 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] rounded-xl border border-white/[0.12] backdrop-blur-md transition-colors whitespace-nowrap shrink-0"
                title="Chuyển đổi ngôn ngữ / Switch Language"
              >
                {language.toUpperCase()}
              </button>

              {/* User Profile & Account Dropdown */}
              {currentUser ? (
                <div className="relative shrink-0">
                  <button
                    id="btn-user-profile-menu"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.15] transition-all shadow-sm group shrink-0"
                    title={currentUser.email}
                  >
                    {currentUser.picture ? (
                      <img
                        src={currentUser.picture}
                        alt={currentUser.name}
                        className="w-6 h-6 rounded-lg object-cover ring-1 ring-white/30"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-[11px] font-bold text-white">
                        {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform" />
                  </button>

                  {/* Dropdown Menu */}
                  {showUserMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowUserMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900/95 border border-white/20 shadow-2xl backdrop-blur-2xl p-3.5 z-50 animate-fadeIn">
                        <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                          {currentUser.picture ? (
                            <img
                              src={currentUser.picture}
                              alt={currentUser.name}
                              className="w-10 h-10 rounded-xl object-cover ring-2 ring-emerald-500/50"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-sm font-bold text-white">
                              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-white truncate">
                              {currentUser.name}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {currentUser.email}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">
                                <Crown className="w-2.5 h-2.5" />
                                {currentSub.planName}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
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
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-300 hover:text-white hover:bg-amber-500/15 rounded-xl transition-all flex items-center justify-between group"
                          >
                            <span className="flex items-center space-x-2">
                              <Crown className="w-3.5 h-3.5 text-amber-400" />
                              <span>{language === 'vi' ? 'Quản lý Gói & Nâng Cấp' : 'Subscription & Upgrade'}</span>
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                              Pro
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              setShowSecurityModal(true);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-300 hover:text-white hover:bg-emerald-500/15 rounded-xl transition-all flex items-center space-x-2"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Trung Tâm Bảo Mật On-Premise</span>
                          </button>

                          {onOpenWorkspaceMode && (
                            <button
                              onClick={() => {
                                setShowUserMenu(false);
                                onOpenWorkspaceMode();
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-sky-300 hover:text-white hover:bg-sky-500/15 rounded-xl transition-all flex items-center space-x-2"
                            >
                              <LineChart className="w-3.5 h-3.5 text-sky-400" />
                              <span>{language === 'vi' ? 'Chế độ làm việc (Seller / Analyst)' : 'Workspace mode (Seller / Analyst)'}</span>
                            </button>
                          )}

                          {/* Feature 3: Clear All Local Data button in Menu */}
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              setShowClearDataModal(true);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-500/20 rounded-xl transition-all flex items-center space-x-2"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>Xóa Sạch Dữ Liệu Local (1-Click)</span>
                          </button>

                          {onLogout && (
                            <button
                              id="btn-logout"
                              onClick={() => {
                                setShowUserMenu(false);
                                onLogout();
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-xl transition-all flex items-center space-x-2 border-t border-white/10 mt-1 pt-2"
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
          {currentData && (
            <div className="flex border-t border-white/[0.08] overflow-x-auto no-scrollbar py-2.5 gap-2 sm:gap-3">
              <button
                id="nav-tab-overview"
                onClick={() => setActiveTab('overview')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'overview'
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-400/40 shadow-md shadow-blue-500/10 backdrop-blur-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent'
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
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-400/40 shadow-md shadow-blue-500/10 backdrop-blur-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent'
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
                    ? 'bg-gradient-to-r from-purple-600/30 to-blue-600/30 text-purple-300 border border-purple-400/40 shadow-md shadow-purple-500/10 backdrop-blur-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>{language === 'vi' ? 'Trung Tâm Quyết Định AI' : 'AI Decision Center'}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-400/30 hidden sm:inline">
                  Phase 2
                </span>
              </button>

              <button
                id="nav-tab-raw"
                onClick={() => setActiveTab('raw')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'raw'
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-400/40 shadow-md shadow-blue-500/10 backdrop-blur-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent'
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
