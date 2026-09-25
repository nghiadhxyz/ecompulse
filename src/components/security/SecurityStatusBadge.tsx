import React, { useState } from 'react';
import { ShieldCheck, Lock, Cpu, EyeOff, Info, CheckCircle2 } from 'lucide-react';

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
                100% Cục Bộ
              </span>
            </div>
            <p className="text-[11px] text-emerald-300/90 mt-0.5">
              {language === 'vi'
                ? 'Dữ liệu đang xử lý an toàn tại thiết bị này (In-Browser RAM & IndexedDB) • Tuyệt đối không gửi sang server'
                : 'Data is safely processed locally on this device (In-Browser RAM & IndexedDB) • Zero server transmission'}
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
        title="Bảo mật Local-First & Zero-Knowledge: 100% dữ liệu xử lý tại máy trạm"
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
        title="Bảo mật Local-First & Zero-Knowledge: 100% dữ liệu xử lý tại máy trạm"
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
          100% RAM
        </span>
      </button>

      {/* Tooltip Hover Bubble */}
      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 rounded-2xl bg-slate-900/98 border border-emerald-500/40 shadow-2xl backdrop-blur-2xl text-left z-50 animate-fadeIn pointer-events-none">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs pb-1.5 border-b border-white/10">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Zero-Knowledge Isolation</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
            {language === 'vi'
              ? 'Dữ liệu báo cáo Excel được bóc tách 100% trong bộ nhớ RAM trình duyệt của bạn, không gửi sang máy chủ.'
              : 'Excel reports are processed 100% inside your browser RAM, never uploaded to any remote servers.'}
          </p>
        </div>
      )}
    </div>
  );
};
