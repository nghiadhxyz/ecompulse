import React, { useState } from 'react';
import {
  ShieldCheck,
  FileSpreadsheet,
  Users,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Lock,
  Zap,
  HardDrive,
  Cpu,
} from 'lucide-react';
import ecompulseAvatar from '../assets/images/ecompulse_avatar_1787721096722.jpg';
import {
  loginAsDemoUser,
  saveGoogleUser,
} from '../utils/googleSheetsService';
import { GoogleUserProfile } from '../types';
import { syncUserProfileToFirebase } from '../utils/firebaseService';
import { OnPremiseSecurityModal } from './dashboard/OnPremiseSecurityModal';

interface GoogleAuthScreenProps {
  onLoginSuccess: (user: GoogleUserProfile) => void;
  language: 'vi' | 'en';
}

export const GoogleAuthScreen: React.FC<GoogleAuthScreenProps> = ({
  onLoginSuccess,
  language,
}) => {
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);

  const handleOnPremiseLogin = () => {
    const onPremiseUser: GoogleUserProfile = {
      id: `onprem_${Date.now()}`,
      email: 'seller.onpremise@local.workspace',
      name: 'Nhà Bán Hàng (Chế Độ On-Premise)',
      picture: '',
      loginMethod: 'demo',
    };
    saveGoogleUser(onPremiseUser);
    syncUserProfileToFirebase(onPremiseUser.id, {
      email: onPremiseUser.email,
      displayName: onPremiseUser.name,
    });
    onLoginSuccess(onPremiseUser);
  };

  const handleDemoLogin = () => {
    const demoUser = loginAsDemoUser(
      'seller.demo@ecompulse.vn',
      'Nhà Bán Hàng EcomPulse'
    );
    syncUserProfileToFirebase(demoUser.id || demoUser.email, {
      email: demoUser.email,
      displayName: demoUser.name,
      photoURL: demoUser.picture,
    });
    onLoginSuccess(demoUser);
  };

  return (
    <>
      <div className="min-h-[85vh] flex items-center justify-center py-6 px-4 sm:px-6 animate-in fade-in duration-300">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Branding & Value Proposition */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Logo & Badge */}
            <div className="flex items-center space-x-3">
              <div className="relative w-12 h-12 rounded-2xl overflow-hidden shadow-xl shadow-sky-500/25 ring-2 ring-white/20 bg-slate-900 flex-shrink-0">
                <img
                  src={ecompulseAvatar}
                  alt="EcomPulse Logo"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black tracking-tight text-white">
                    Ecom<span className="text-blue-400">Pulse</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-400/30">
                    🛡️ On-Premise Isolated
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {language === 'vi'
                    ? 'Hệ Thống Phân Tích Dòng Tiền & Ra Quyết Định TMĐT'
                    : 'E-commerce Revenue Leakage & Decision Matrix Engine'}
                </p>
              </div>
            </div>

            {/* Heading */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight">
                {language === 'vi' ? (
                  <>
                    Phân Tích Dữ Liệu TMĐT <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400">
                      Bảo Mật Tuyệt Đối Tại Máy Trạm
                    </span>
                  </>
                ) : (
                  <>
                    Multi-Channel Growth Analytics <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400">
                      100% Client-Side Isolated
                    </span>
                  </>
                )}
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed max-w-lg">
                {language === 'vi'
                  ? 'Phân tích tức thì 21 sheet báo cáo Shopee, TikTok Shop hoàn toàn trong bộ nhớ RAM trình duyệt. Dữ liệu doanh thu, đơn hàng, khách hàng chỉ hiển thị ở máy của bạn, không gửi về bất kỳ máy chủ nào.'
                  : 'Instantly parse multi-sheet e-commerce reports entirely within your browser RAM. Your data stays 100% on your local machine.'}
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 backdrop-blur-md flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 text-emerald-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">
                    {language === 'vi' ? 'Bảo Mật On-Premise' : 'On-Premise Privacy'}
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {language === 'vi'
                      ? 'Dữ liệu không rời máy trạm, lưu cục bộ IndexedDB.'
                      : 'Data never leaves your machine, stored locally.'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-blue-400">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">
                    {language === 'vi' ? 'Google Sheets Bằng Link' : 'Direct Sheet Link'}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {language === 'vi'
                      ? 'Dán link sheet để lưu liên kết & copy 1-click cho team.'
                      : 'Paste sheet link to assign tasks without OAuth.'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center flex-shrink-0 text-purple-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">
                    {language === 'vi' ? 'AI 7 Trụ Cột & What-If' : 'AI 7 Pillars & What-If'}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {language === 'vi'
                      ? 'Thuật toán toán học cục bộ & hỗ trợ BYOK/Offline.'
                      : 'Deterministic local math & BYOK/Offline support.'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 text-cyan-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">
                    {language === 'vi' ? 'Zero Data Ingestion' : 'Zero Cloud Upload'}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {language === 'vi'
                      ? 'Không có backend thu thập số liệu nhà bán hàng.'
                      : 'Zero server-side persistence of customer data.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Audit button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowSecurityModal(true)}
                className="inline-flex items-center space-x-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="underline">Xem Chứng Chỉ & Kiểm Toán Bảo Mật On-Premise</span>
              </button>
            </div>
          </div>

          {/* Right Column: Access Card */}
          <div className="lg:col-span-5">
            <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-white/[0.12] bg-slate-900/70 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative space-y-5 text-center">
                {/* Header inside card */}
                <div className="space-y-1.5">
                  <div className="inline-flex p-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 mb-2 shadow-inner text-emerald-400">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    {language === 'vi' ? 'Truy Cập Hệ Thống' : 'Access System'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    {language === 'vi'
                      ? 'Chế độ làm việc On-Premise bảo mật trên máy của bạn'
                      : 'Local workspace ready to analyze'}
                  </p>
                </div>

                {/* Primary Option 1: On-Premise Local Privacy Direct Access */}
                <button
                  id="btn-onpremise-direct-access"
                  type="button"
                  onClick={handleOnPremiseLogin}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm transition-all shadow-xl shadow-emerald-500/25 active:scale-[0.98] flex items-center justify-center gap-2.5 border border-emerald-400/40 group"
                >
                  <Lock className="w-4 h-4 text-emerald-200 group-hover:scale-110 transition-transform" />
                  <span>
                    {language === 'vi'
                      ? 'Bắt Đầu Làm Việc (100% Dữ Liệu Nội Bộ)'
                      : 'Enter Local Workspace'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Option 2: Demo Mode Quick Access */}
                <button
                  id="btn-demo-mode-login"
                  type="button"
                  onClick={handleDemoLogin}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/[0.12] text-xs font-semibold transition-all flex items-center justify-center gap-2 group"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span>
                    {language === 'vi'
                      ? 'Dùng thử Dữ liệu Mẫu (Demo Mode)'
                      : 'Try Demo Mode (Sample Data)'}
                  </span>
                </button>

                {/* Security Guarantee Note */}
                <div className="pt-3 border-t border-white/[0.08] flex items-center justify-center gap-2 text-[11px] text-emerald-400/90">
                  <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    {language === 'vi'
                      ? 'Cam kết: Dữ liệu 100% tại trình duyệt máy trạm'
                      : 'Data isolation guarantee: 100% Client-Side'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* On-Premise Security & Privacy Center Modal */}
      <OnPremiseSecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        language={language}
      />
    </>
  );
};
