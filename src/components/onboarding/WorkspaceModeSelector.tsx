import React, { useEffect } from 'react';
import { Store, LineChart, Check, X } from 'lucide-react';
import type { WorkspaceMode } from '../../utils/workspacePreferences';

interface WorkspaceModeSelectorProps {
  isOpen: boolean;
  currentMode: WorkspaceMode | null;
  onSelect: (mode: WorkspaceMode) => void;
  /** Omit to make the choice mandatory (first-run onboarding). */
  onClose?: () => void;
  language: 'vi' | 'en';
}

const OPTIONS: Array<{
  mode: WorkspaceMode;
  icon: typeof Store;
  title: { vi: string; en: string };
  subtitle: { vi: string; en: string };
  points: { vi: string[]; en: string[] };
  accent: string;
}> = [
  {
    mode: 'seller',
    icon: Store,
    title: { vi: 'Chủ shop / Người bán', en: 'Shop owner / Seller' },
    subtitle: {
      vi: 'Tôi muốn biết shop đang lời/lỗ thế nào và cần làm gì tiếp theo.',
      en: 'I want to know if my shop is making money and what to do next.',
    },
    points: {
      vi: ['Số liệu chính, dễ hiểu', 'Lời/lỗ thật sau chi phí', 'Việc cần kiểm tra hôm nay'],
      en: ['Key numbers in plain words', 'Real profit after costs', 'What to check today'],
    },
    accent: 'from-orange-500/25 to-amber-500/10 border-orange-400/40 text-orange-300',
  },
  {
    mode: 'analyst',
    icon: LineChart,
    title: { vi: 'Planner / Data Analyst', en: 'Planner / Data Analyst' },
    subtitle: {
      vi: 'Tôi cần phân tích sâu dữ liệu để tìm nguyên nhân và lập kế hoạch.',
      en: 'I need deep analysis to find drivers and plan the next period.',
    },
    points: {
      vi: ['Drill-down Ngành → SKU → Đơn', 'So sánh kỳ & phân rã đóng góp', 'Lập kế hoạch & đo kết quả'],
      en: ['Drill-down Category → SKU → Order', 'Period comparison & contribution', 'Planning & result tracking'],
    },
    accent: 'from-sky-500/25 to-indigo-500/10 border-sky-400/40 text-sky-300',
  },
];

export const WorkspaceModeSelector: React.FC<WorkspaceModeSelectorProps> = ({ isOpen, currentMode, onSelect, onClose, language }) => {
  useEffect(() => {
    if (!isOpen || !onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const t = (v: { vi: string; en: string }) => v[language];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="workspace-mode-title">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0b1024] border border-white/10 shadow-2xl p-5 sm:p-7">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            aria-label={language === 'vi' ? 'Đóng' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <h2 id="workspace-mode-title" className="text-lg sm:text-xl font-black text-white pr-8">
          {language === 'vi' ? 'Bạn sử dụng EcomPulse chủ yếu để làm gì?' : 'What will you mainly use EcomPulse for?'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          {language === 'vi'
            ? 'Hai chế độ dùng chung dữ liệu và cùng công thức tính. Bạn có thể đổi bất cứ lúc nào mà không mất dữ liệu.'
            : 'Both modes share the same data and formulas. You can switch any time without losing data.'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-5">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = currentMode === opt.mode;
            return (
              <button
                key={opt.mode}
                onClick={() => onSelect(opt.mode)}
                aria-pressed={selected}
                className={`text-left rounded-2xl border bg-gradient-to-b p-4 sm:p-5 transition-all hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${opt.accent} ${
                  selected ? 'ring-2 ring-white/50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </span>
                  {selected && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-white/15 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" /> {language === 'vi' ? 'Đang dùng' : 'Current'}
                    </span>
                  )}
                </div>
                <div className="mt-3 text-base font-black text-white uppercase tracking-wide">{t(opt.title)}</div>
                <div className="mt-1 text-sm text-slate-200 leading-snug">{t(opt.subtitle)}</div>
                <ul className="mt-3 space-y-1">
                  {opt.points[language].map((p) => (
                    <li key={p} className="text-xs text-slate-300 flex items-center gap-1.5">
                      <Check className="w-3 h-3 shrink-0 opacity-70" /> {p}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
