import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  FileSpreadsheet,
  Users,
  Sparkles,
  ArrowRight,
  Key,
  AlertCircle,
  CheckCircle2,
  Lock,
  Zap,
  TrendingUp,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import ecompulseAvatar from '../assets/images/ecompulse_avatar_1787721096722.jpg';
import {
  loginWithGoogle,
  loginAsDemoUser,
  getGoogleClientId,
  saveCustomClientId,
  getCustomClientId,
} from '../utils/googleSheetsService';
import { GoogleUserProfile } from '../types';
import { syncUserProfileToFirebase } from '../utils/firebaseService';

interface GoogleAuthScreenProps {
  onLoginSuccess: (user: GoogleUserProfile) => void;
  language: 'vi' | 'en';
}

export const GoogleAuthScreen: React.FC<GoogleAuthScreenProps> = ({
  onLoginSuccess,
  language,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [serverClientId, setServerClientId] = useState<string>('');
  const [customClientIdInput, setCustomClientIdInput] = useState<string>('');
  const [showConfigDetails, setShowConfigDetails] = useState<boolean>(false);
  const [savedClientIdMsg, setSavedClientIdMsg] = useState<boolean>(false);

  useEffect(() => {
    // Check if client ID is already stored or available from server
    const savedCustom = getCustomClientId();
    if (savedCustom) {
      setCustomClientIdInput(savedCustom);
    }

    getGoogleClientId().then((id) => {
      if (id) {
        setServerClientId(id);
      }
    });
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const activeClientId = customClientIdInput.trim() || serverClientId;
      if (!activeClientId) {
        setShowConfigDetails(true);
        throw new Error(
          language === 'vi'
            ? 'Vui lòng nhập Google Client ID của bạn ở mục cấu hình bên dưới để tiến hành đăng nhập, hoặc bấm "Dùng thử chế độ Demo"!'
            : 'Please provide a Google Client ID in the configuration box below or click "Try Demo Mode"!'
        );
      }

      if (customClientIdInput.trim()) {
        saveCustomClientId(customClientIdInput.trim());
      }

      const { user } = await loginWithGoogle(activeClientId);
      // Sync to Firebase Firestore
      syncUserProfileToFirebase(user.id || user.email, {
        email: user.email,
        displayName: user.name,
        photoURL: user.picture,
      });
      onLoginSuccess(user);
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(
        err.message ||
          (language === 'vi'
            ? 'Đăng nhập Google không thành công. Vui lòng kiểm tra Client ID hoặc thử lại.'
            : 'Google login failed. Please check your Client ID or try again.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClientId = () => {
    if (customClientIdInput.trim()) {
      saveCustomClientId(customClientIdInput.trim());
      setSavedClientIdMsg(true);
      setTimeout(() => setSavedClientIdMsg(false), 3000);
    }
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
    <div className="min-h-[85vh] flex items-center justify-center py-6 px-4 sm:px-6">
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
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-bold border border-blue-400/30">
                  Google Workspace Ready
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
                  Đăng nhập để bắt đầu <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400">
                    Phân Tích & Quản Trị Đa Kênh
                  </span>
                </>
              ) : (
                <>
                  Sign in to start <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400">
                    Multi-Channel Growth Analytics
                  </span>
                </>
              )}
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-lg">
              {language === 'vi'
                ? 'Liên kết liền mạch với tài khoản Google để tự động tạo Google Sheets cho nhân viên (Ads, CSKH, Kho, Live) và lưu trữ báo cáo an toàn trên Google Drive.'
                : 'Seamlessly connect with your Google account to auto-generate collaborative Google Sheets for your team and archive reports to Drive.'}
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-400">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100">
                  {language === 'vi' ? 'Google Sheets Trực Tuyến' : 'Collaborative Sheets'}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {language === 'vi'
                    ? 'Xuất lộ trình & thẻ việc 3 tab chuẩn hoá cho team.'
                    : 'Auto-formats roadmap & action cards for team execution.'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-blue-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100">
                  {language === 'vi' ? 'Phối Hợp Nhóm Từ Xa' : 'Remote Team Sync'}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {language === 'vi'
                    ? 'Nhân viên xem việc qua link sheet mà không cần vào app.'
                    : 'Team members access task sheets without app login.'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center flex-shrink-0 text-purple-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100">
                  {language === 'vi' ? 'Đồng Bộ Tiến Độ Real-time' : 'Real-time Progress'}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {language === 'vi'
                    ? 'Đánh dấu hoàn thành trên app, Sheet tự động cập nhật.'
                    : 'Check tasks on app, Sheets automatically updates status.'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 text-cyan-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100">
                  {language === 'vi' ? 'Bảo Mật Google OAuth' : 'Secure OAuth 2.0'}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {language === 'vi'
                    ? 'Dữ liệu chỉ nằm trong Drive của bạn, hoàn toàn riêng tư.'
                    : 'Direct client-to-Google encryption. Zero data stored.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Google Sign In Card */}
        <div className="lg:col-span-5">
          <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-white/[0.12] bg-slate-900/60 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative space-y-5 text-center">
              {/* Header inside card */}
              <div className="space-y-1.5">
                <div className="inline-flex p-2.5 rounded-2xl bg-white/10 border border-white/15 mb-2 shadow-inner">
                  {/* Official Google G Logo */}
                  <svg className="w-7 h-7" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">
                  {language === 'vi' ? 'Đăng Nhập Hệ Thống' : 'Account Sign In'}
                </h3>
                <p className="text-xs text-slate-300">
                  {language === 'vi'
                    ? 'Sử dụng tài khoản Google để đồng bộ Sheets & Drive'
                    : 'Use your Google account to sync with Sheets & Drive'}
                </p>
              </div>

              {/* Error Message if any */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs text-left flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{errorMsg}</p>
                    {errorMsg.includes('Client ID') && (
                      <button
                        onClick={() => setShowConfigDetails(true)}
                        className="text-[11px] underline mt-1 text-rose-200 hover:text-white"
                      >
                        {language === 'vi' ? 'Xem hướng dẫn dán Client ID' : 'Open Client ID settings'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Main Google Sign-In Button */}
              <button
                id="btn-google-sign-in"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm transition-all shadow-xl shadow-white/10 hover:shadow-white/20 active:scale-[0.98] flex items-center justify-center gap-3 border border-white group"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>{language === 'vi' ? 'Đang xác thực Google...' : 'Authenticating...'}</span>
                  </>
                ) : (
                  <>
                    {/* Google G Icon */}
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{language === 'vi' ? 'Tiếp tục với Google' : 'Continue with Google'}</span>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-slate-900/90 px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  {language === 'vi' ? 'Hoặc' : 'Or'}
                </span>
                <div className="border-t border-white/10 w-full" />
              </div>

              {/* Demo Mode Quick Access */}
              <button
                id="btn-demo-mode-login"
                type="button"
                onClick={handleDemoLogin}
                className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/[0.12] text-xs font-semibold transition-all flex items-center justify-center gap-2 group"
              >
                <Zap className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>{language === 'vi' ? 'Dùng thử ngay (Chế độ Demo)' : 'Try Demo Mode (Instant)'}</span>
              </button>

              {/* Client ID Configuration Accordion */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigDetails(!showConfigDetails)}
                  className="w-full py-1.5 text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center gap-1 transition-colors"
                >
                  <Key className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    {showConfigDetails
                      ? language === 'vi'
                        ? 'Ẩn cấu hình Client ID'
                        : 'Hide Client ID setting'
                      : language === 'vi'
                      ? 'Cấu hình Google OAuth Client ID'
                      : 'Configure OAuth Client ID'}
                  </span>
                  {showConfigDetails ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showConfigDetails && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-black/40 border border-white/10 text-left space-y-3 animate-fadeIn">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Google OAuth Client ID:
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={customClientIdInput}
                          onChange={(e) => setCustomClientIdInput(e.target.value)}
                          placeholder="964740747551-xxx.apps.googleusercontent.com"
                          className="flex-1 px-2.5 py-1.5 text-xs bg-slate-950 border border-white/20 rounded-lg text-slate-200 focus:outline-none focus:border-blue-400 font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleSaveClientId}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          Lưu
                        </button>
                      </div>
                      {savedClientIdMsg && (
                        <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Đã lưu Client ID thành công!
                        </p>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      💡 <strong>Mẹo:</strong> Lấy chuỗi Client ID từ màn hình Google Cloud Console mà bạn vừa tạo rồi dán vào đây để đăng nhập bằng tài khoản Google thật của bạn.
                    </p>
                  </div>
                )}
              </div>

              {/* Privacy Footnote */}
              <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>
                  {language === 'vi'
                    ? 'Bảo mật tuyệt đối qua Google OAuth 2.0'
                    : '100% Secure via Google OAuth 2.0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
