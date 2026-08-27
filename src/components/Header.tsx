import React, { useState } from 'react';
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
} from 'lucide-react';
import { downloadSampleShopeeExcel } from '../utils/excelParser';
import { ParsedStoreData, GoogleUserProfile } from '../types';
import ecompulseAvatar from '../assets/images/ecompulse_avatar_1787721096722.jpg';
import { ShopeeLogo, TikTokShopLogo, LazadaLogo } from './PlatformLogos';
import { EcommercePlatform } from './EcommercePlatformSelector';

interface HeaderProps {
  currentData: ParsedStoreData | null;
  selectedPlatform: EcommercePlatform | null;
  currentUser: GoogleUserProfile | null;
  onLogout?: () => void;
  onOpenLogin?: () => void;
  onResetData: () => void;
  onChangePlatform?: () => void;
  onOpenUpload: () => void;
  activeTab: 'overview' | 'deep' | 'ai' | 'raw';
  setActiveTab: (tab: 'overview' | 'deep' | 'ai' | 'raw') => void;
  language: 'vi' | 'en';
  setLanguage: (lang: 'vi' | 'en') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentData,
  selectedPlatform,
  currentUser,
  onLogout,
  onOpenLogin,
  onResetData,
  onChangePlatform,
  onOpenUpload,
  activeTab,
  setActiveTab,
  language,
  setLanguage,
}) => {
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);

  const renderPlatformBadge = () => {
    if (!selectedPlatform) return null;
    switch (selectedPlatform) {
      case 'tiktok':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-semibold backdrop-blur-md">
            <TikTokShopLogo className="w-4 h-4 rounded-md !p-0.5" />
            <span className="hidden sm:inline">TikTok Shop</span>
          </div>
        );
      case 'lazada':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-semibold backdrop-blur-md">
            <LazadaLogo className="w-4 h-4 rounded-md !p-0.5" />
            <span className="hidden sm:inline">Lazada</span>
          </div>
        );
      case 'shopee':
      default:
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-orange-500/15 border border-orange-400/30 text-orange-300 text-xs font-semibold backdrop-blur-md">
            <ShopeeLogo className="w-4 h-4 rounded-md !p-0.5" />
            <span className="hidden sm:inline">Shopee</span>
          </div>
        );
    }
  };

  return (
    <header className="glass-panel text-white sticky top-0 z-30 shadow-2xl border-x-0 border-t-0 border-b border-white/[0.12] bg-slate-950/40 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-sky-500/25 ring-1 ring-white/30 backdrop-blur-md bg-slate-900 flex-shrink-0 group">
              <img
                src={ecompulseAvatar}
                alt="EcomPulse Avatar Logo"
                className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20 pointer-events-none" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black tracking-tight text-white">
                  Ecom<span className="text-blue-400">Pulse</span>
                </span>
                {renderPlatformBadge()}
              </div>
              <p className="text-xs text-slate-300/80 font-medium hidden sm:block">
                Hệ Thống Phân Tích & Ra Quyết Định Dữ Liệu TMĐT
              </p>
            </div>
          </div>

          {/* Current File Information & Action Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {currentData ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-md">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[200px]" title={currentData.fileName}>
                    {currentData.fileName}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/30">
                    {currentData.sheetCount} sheets
                  </span>
                </div>

                {onChangePlatform && (
                  <button
                    onClick={onChangePlatform}
                    className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] rounded-xl transition-all shadow-sm"
                    title="Đổi sàn thương mại điện tử khác"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                    <span className="hidden sm:inline">Đổi sàn</span>
                  </button>
                )}

                <button
                  id="btn-reset-data"
                  onClick={onResetData}
                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-300 bg-white/[0.06] hover:bg-rose-500/15 border border-white/[0.12] hover:border-rose-400/30 rounded-xl transition-all shadow-sm"
                  title="Xóa dữ liệu hiện tại để tải file khác"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">Xóa dữ liệu</span>
                </button>
              </div>
            ) : selectedPlatform && onChangePlatform ? (
              <button
                onClick={onChangePlatform}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] rounded-xl transition-all shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
                <span>Đổi sàn TMĐT</span>
              </button>
            ) : null}

            {/* Download Sample Excel */}
            <button
              id="btn-download-sample"
              onClick={downloadSampleShopeeExcel}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] rounded-xl transition-all shadow-sm backdrop-blur-md"
              title="Tải file Excel mẫu 21 sheet chuẩn để thử nghiệm"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-blue-300" />
              <span className="hidden sm:inline">Tải mẫu</span> .XLSX
            </button>

            {/* Upload Button */}
            <button
              id="btn-open-upload-modal"
              onClick={onOpenUpload}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl transition-all shadow-lg shadow-blue-500/25 border border-blue-400/30 active:scale-95"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              <span>{currentData ? 'Tải file khác' : 'Nhập Excel'}</span>
            </button>

            {/* Language Toggle */}
            <button
              id="btn-lang-toggle"
              onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
              className="px-2.5 py-1 text-xs font-bold text-slate-200 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] rounded-lg border border-white/[0.12] backdrop-blur-md transition-colors"
              title="Chuyển đổi ngôn ngữ / Switch Language"
            >
              {language.toUpperCase()}
            </button>

            {/* User Profile & Account Dropdown */}
            {currentUser ? (
              <div className="relative">
                <button
                  id="btn-user-profile-menu"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.15] transition-all shadow-sm group"
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
                  <div className="text-left hidden md:block max-w-[110px] truncate">
                    <p className="text-xs font-semibold text-white leading-tight truncate">
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-none truncate">
                      {currentUser.email}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform" />
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900/95 border border-white/20 shadow-2xl backdrop-blur-2xl p-3 z-50 animate-fadeIn">
                      <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                        {currentUser.picture ? (
                          <img
                            src={currentUser.picture}
                            alt={currentUser.name}
                            className="w-10 h-10 rounded-xl object-cover ring-2 ring-blue-500/50"
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
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              {currentUser.loginMethod === 'google'
                                ? 'Google Account'
                                : 'Tài khoản Demo'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              Firebase Firestore Active
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        {onLogout && (
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              onLogout();
                            }}
                            className="w-full px-3 py-2 text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-xl transition-colors flex items-center gap-2"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>{language === 'vi' ? 'Đăng xuất tài khoản' : 'Sign Out'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : onOpenLogin ? (
              <button
                onClick={onOpenLogin}
                className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 rounded-xl transition-all shadow-md shadow-white/10"
              >
                <span>{language === 'vi' ? 'Đăng nhập Google' : 'Sign in'}</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Navigation Tabs - Only shown when data is loaded */}
        {currentData && (
          <div className="flex items-center space-x-1.5 sm:space-x-2 border-t border-white/[0.08] pt-2 pb-2.5 overflow-x-auto scrollbar-none">
            <button
              id="tab-overview"
              onClick={() => setActiveTab('overview')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'overview'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40 shadow-lg shadow-blue-500/15 backdrop-blur-md'
                  : 'text-slate-300/80 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>{language === 'vi' ? 'Tổng Quan & Phễu Chuyển Đổi' : 'Overview & Funnel'}</span>
            </button>

            <button
              id="tab-deep"
              onClick={() => setActiveTab('deep')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'deep'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40 shadow-lg shadow-blue-500/15 backdrop-blur-md'
                  : 'text-slate-300/80 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{language === 'vi' ? 'Phân Tích Đa Chiều & Ma Trận ABC' : 'Deep Analytics & ABC'}</span>
            </button>

            <button
              id="tab-ai"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'ai'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40 shadow-lg shadow-purple-500/15 backdrop-blur-md'
                  : 'text-slate-300/80 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-300" />
              <span>{language === 'vi' ? 'Thẻ Hành Động & AI Trợ Lý' : 'Action Cards & AI Copilot'}</span>
            </button>

            <button
              id="tab-raw"
              onClick={() => setActiveTab('raw')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'raw'
                  ? 'bg-slate-500/20 text-slate-200 border border-slate-400/40 shadow-lg shadow-slate-500/15 backdrop-blur-md'
                  : 'text-slate-300/80 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{language === 'vi' ? `Dữ Liệu Gốc (${currentData.sheetCount} Sheets)` : `Raw Data (${currentData.sheetCount} Sheets)`}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
