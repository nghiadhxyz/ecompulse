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

/**
 * Colours come from the design tokens: dark before a mode is chosen (outside the workspace
 * shell, :root is dark), light / dark inside the workspace following the theme toggle.
 */
const OPTIONS: Array<{
  mode: WorkspaceMode;
  icon: typeof Store;
  title: { vi: string; en: string };
  subtitle: { vi: string; en: string };
  points: { vi: string[]; en: string[] };
  /** Icon tile: seller = the orange accent, analyst = primary. */
  iconCls: string;
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
    iconCls: 'bg-down-soft text-down',
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
    iconCls: 'bg-primary-soft text-primary',
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="workspace-mode-title">
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-card border border-line bg-surface p-6 text-fg shadow-card sm:p-7">
        {onClose && (
          <button type="button" onClick={onClose} className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-control text-muted hover:bg-hover hover:text-fg" aria-label={language === 'vi' ? 'Đóng' : 'Close'}>
            <X className="h-5 w-5" aria-hidden />
          </button>
        )}
        <h2 id="workspace-mode-title" className="pr-10 text-page text-fg">
          {language === 'vi' ? 'Bạn sử dụng EcomPulse chủ yếu để làm gì?' : 'What will you mainly use EcomPulse for?'}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {language === 'vi' ? 'Hai chế độ dùng chung dữ liệu và cùng công thức tính. Bạn có thể đổi bất cứ lúc nào mà không mất dữ liệu.' : 'Both modes share the same data and formulas. You can switch any time without losing data.'}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = currentMode === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => onSelect(opt.mode)}
                aria-pressed={selected}
                className={`rounded-card border p-5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  selected ? 'border-primary bg-primary-soft ring-2 ring-primary/20' : 'border-line bg-surface hover:border-primary/40 hover:bg-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-control ${opt.iconCls}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  {selected && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-small font-semibold text-primary-contrast">
                      <Check className="h-3 w-3" aria-hidden /> {language === 'vi' ? 'Đang dùng' : 'Current'}
                    </span>
                  )}
                </div>
                <div className="mt-3 text-card-title text-fg">{t(opt.title)}</div>
                <div className="mt-1 text-sm leading-snug text-fg">{t(opt.subtitle)}</div>
                <ul className="mt-3 space-y-1">
                  {opt.points[language].map((p) => (
                    <li key={p} className="flex items-center gap-1.5 text-small text-muted">
                      <Check className="h-3.5 w-3.5 shrink-0 text-up" aria-hidden /> {p}
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
