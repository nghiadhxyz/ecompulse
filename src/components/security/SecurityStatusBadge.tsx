import React, { useState } from 'react';
import { ShieldCheck, Lock, Cpu, EyeOff, Info, CheckCircle2 } from 'lucide-react';
import { useAiPrivacyMode } from '../workspace/AiPrivacySettings';

interface SecurityStatusBadgeProps {
  variant?: 'compact' | 'full' | 'banner';
  onClick?: () => void;
  className?: string;
  language?: 'vi' | 'en';
}

export const SecurityStatusBadge: React.FC<SecurityStatusBadgeProps> = ({
  variant = 'compact',
  onClick,
  className = '',
  language = 'vi',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  // With Cloud AI on, aggregates can leave the device — the badge must not claim otherwise.
  const cloud = useAiPrivacyMode() === 'cloud_ai';
  const vi = language === 'vi';
  const title = cloud
    ? vi ? 'Local-first: file và đơn hàng ở trên máy. Cloud AI đang bật — số liệu tổng hợp ẩn danh có thể được gửi tới Gemini khi bạn dùng AI.' : 'Local-first: files and orders stay here. Cloud AI is on — anonymized aggregates may be sent to Gemini.'
    : vi ? 'Local-first: file, đơn hàng và số liệu xử lý tại máy này; AI không gửi dữ liệu ra ngoài.' : 'Local-first: files, orders and numbers stay on this device.';

  if (variant === 'banner') {
    return (
      <div
        onClick={onClick}
        className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-900/90 to-teal-950/60 border border-emerald-400/40 shadow-xl backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer group hover:border-emerald-300/60 transition-all ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white tracking-wide uppercase">
                🟢 Local-First Shield Active
              </span>
              <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                {cloud ? 'Cloud AI' : '100% Cục Bộ'}
              </span>
            </div>
            <p className="text-[11px] text-emerald-300/90 mt-0.5">
              {cloud
                ? vi ? 'File và đơn hàng xử lý tại thiết bị này • Cloud AI đang bật: chỉ số liệu tổng hợp ẩn danh được gửi khi bạn dùng AI' : 'Files and orders processed on this device • Cloud AI on: only anonymized aggregates are sent when you use AI'
                : vi ? 'Dữ liệu xử lý tại thiết bị này (RAM trình duyệt & IndexedDB) • AI ở chế độ không gửi dữ liệu ra ngoài' : 'Data processed on this device (browser RAM & IndexedDB) • AI does not send data out'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <span className="text-[11px] font-bold text-emerald-300 group-hover:text-white transition-colors underline decoration-emerald-400/50">
            {language === 'vi' ? 'Xem chứng chỉ & Quản lý dữ liệu →' : 'View certificate & Manage data →'}
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 hover:text-white transition-all text-xs font-bold shadow-md shadow-emerald-500/10 backdrop-blur-md group ${className}`}
        title={title}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <ShieldCheck className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
        <span className="font-extrabold tracking-tight">
          Local-First Shield Active:
        </span>
        <span className="text-emerald-200/90 font-medium hidden md:inline">
          {language === 'vi'
            ? 'Dữ liệu đang xử lý an toàn tại thiết bị này'
            : 'Data processed safely on this device'}
        </span>
      </button>
    );
  }

  // Compact default variant
  return (
    <div className="relative inline-flex items-center shrink-0">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 hover:text-white text-xs font-medium transition-all shadow-sm backdrop-blur-md group whitespace-nowrap ${className}`}
        title={title}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-semibold tracking-tight hidden xl:inline">
          Local-First Shield
        </span>
        <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-400/20 text-emerald-300 font-bold border border-emerald-400/30">
          {cloud ? 'Cloud AI' : '100% RAM'}
        </span>
      </button>

      {/* Tooltip Hover Bubble */}
      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 rounded-2xl bg-slate-900/98 border border-emerald-500/40 shadow-2xl backdrop-blur-2xl text-left z-50 animate-fadeIn pointer-events-none">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs pb-1.5 border-b border-white/10">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{cloud ? (vi ? 'Local-first · Cloud AI bật' : 'Local-first · Cloud AI on') : 'Local-first'}</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
            {title}
          </p>
        </div>
      )}
    </div>
  );
};
