import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  EyeOff,
  Bot,
  Sparkles,
  CheckCircle2,
  Cpu,
  Lock,
} from 'lucide-react';

interface ProcessingProgressBarProps {
  progress?: number; // 0 to 100
  currentStep?: 1 | 2 | 3;
  fileName?: string;
  language?: 'vi' | 'en';
}

export const ProcessingProgressBar: React.FC<ProcessingProgressBarProps> = ({
  progress = 0,
  currentStep = 1,
  fileName,
  language = 'vi',
}) => {
  const [displayProgress, setDisplayProgress] = useState(progress);

  useEffect(() => {
    setDisplayProgress(progress);
  }, [progress]);

  const steps = [
    {
      id: 1,
      title: language === 'vi' ? 'Bóc tách file tại thiết bị' : 'In-Device File Parsing',
      subtitle: language === 'vi' ? 'In-Browser RAM • 21 Sheets' : 'In-Browser RAM • Multi-Sheets',
      icon: Cpu,
      color: 'emerald',
    },
    {
      id: 2,
      title: language === 'vi' ? 'Làm sạch dữ liệu PII' : 'PII Data Sanitization',
      subtitle: language === 'vi' ? 'Ẩn danh SĐT, tên khách' : 'Anonymize Phone & Name',
      icon: EyeOff,
      color: 'cyan',
    },
    {
      id: 3,
      title: language === 'vi' ? 'Kết nối Dolphin AI' : 'Connecting Dolphin AI',
      subtitle: language === 'vi' ? 'Chuẩn hóa phễu & Action Cards' : 'Funnel & Action Cards',
      icon: Bot,
      color: 'blue',
    },
  ];

  return (
    <div className="w-full p-5 sm:p-6 rounded-3xl bg-slate-900/95 border border-emerald-500/30 shadow-2xl backdrop-blur-2xl space-y-5 text-left animate-fadeIn">
      {/* Top Header Information */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
              <span>{language === 'vi' ? 'Tiến Trình Xử Lý Dữ Liệu An Toàn' : 'Secure Data Processing'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
                Local RAM
              </span>
            </h4>
            {fileName && (
              <p className="text-[11px] text-slate-400 truncate max-w-sm">
                {fileName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="text-xs font-mono font-black text-emerald-400">
            {Math.round(displayProgress)}%
          </span>
          <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>

      {/* Main Animated Progress Bar Track */}
      <div className="relative w-full h-3 rounded-full bg-slate-950/80 border border-white/10 overflow-hidden shadow-inner p-0.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-300 relative overflow-hidden shadow-lg shadow-emerald-500/50"
          style={{ width: `${Math.max(5, displayProgress)}%` }}
        >
          {/* Shimmer light effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>

      {/* 3 Sequential Step Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
        {steps.map((step) => {
          const isCompleted = currentStep > step.id || displayProgress >= (step.id === 1 ? 35 : step.id === 2 ? 70 : 100);
          const isCurrent = currentStep === step.id && !isCompleted;
          const StepIcon = step.icon;

          return (
            <div
              key={step.id}
              className={`p-3 rounded-2xl border transition-all flex items-start gap-2.5 ${
                isCompleted
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                  : isCurrent
                  ? 'bg-blue-600/15 border-blue-400/50 text-white ring-1 ring-blue-400/30 shadow-lg shadow-blue-500/10'
                  : 'bg-white/[0.02] border-white/5 text-slate-500 opacity-60'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  isCompleted
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isCurrent
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-white/5 text-slate-500'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <StepIcon className={`w-3.5 h-3.5 ${isCurrent ? 'animate-pulse' : ''}`} />
                )}
              </div>

              <div className="overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400">
                    Bước {step.id}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-300 font-bold animate-pulse">
                      Đang chạy
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-white truncate leading-tight mt-0.5">
                  {step.title}
                </p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">
                  {step.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Security Assurance Tag */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Bảo mật On-Premise: 100% dữ liệu xử lý trong RAM máy khách</span>
        </div>
        <span className="text-slate-400 font-mono text-[10px]">
          RAM Isolation: Active
        </span>
      </div>
    </div>
  );
};
