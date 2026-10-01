/**
 * Shared UI primitives of the light redesign (docs/redesign/README.md).
 * Colours come only from the design tokens (src/styles/tokens.css) through Tailwind utilities.
 */
import React, { useId, useState } from 'react';
import { ChevronDown, Database, Moon, Sun } from 'lucide-react';

// ------------------------------------------------------------------ status tones

export type Tone = 'up' | 'down' | 'mismatch' | 'note' | 'warn' | 'info' | 'primary' | 'neutral';

/** Strong text on a soft fill — never white text on a light fill. */
export const TONE_CLASS: Record<Tone, string> = {
  up: 'text-up bg-up-soft',
  down: 'text-down bg-down-soft',
  mismatch: 'text-mismatch bg-mismatch-soft',
  note: 'text-note bg-note-soft',
  warn: 'text-warn bg-warn-soft',
  info: 'text-info bg-info-soft',
  primary: 'text-primary bg-primary-soft',
  neutral: 'text-muted bg-surface-2 border border-line',
};

/** Dot colour of a tone (flags, legends). */
export const TONE_DOT: Record<Tone, string> = {
  up: 'bg-up',
  down: 'bg-down',
  mismatch: 'bg-mismatch',
  note: 'bg-note',
  warn: 'bg-warn',
  info: 'bg-info',
  primary: 'bg-primary',
  neutral: 'bg-muted',
};

/** Status badge: pill, 12/500, tone colours. */
export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; title?: string; icon?: React.ReactNode; className?: string }> = ({ tone = 'neutral', children, title, icon, className = '' }) => (
  <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-small whitespace-nowrap tabular ${TONE_CLASS[tone]} ${className}`}>
    {icon}
    {children}
  </span>
);

/** Filter / choice chip. A real button (keyboard), ≥ 40px tall hit area. */
export const Chip: React.FC<{ selected?: boolean; onClick?: () => void; disabled?: boolean; title?: string; children: React.ReactNode }> = ({ selected, onClick, disabled, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-pressed={selected}
    className={`inline-flex min-h-10 items-center gap-1.5 rounded-control px-3 text-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      selected ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-hover hover:text-fg'
    }`}
  >
    {children}
  </button>
);

// ------------------------------------------------------------------ tabs

export interface TabOption<T extends string> {
  key: T;
  label: React.ReactNode;
  disabled?: boolean;
  title?: string;
}

/** Tabs: selected = primary text on primary-soft; others muted, no border. */
export function Tabs<T extends string>({ value, onChange, options, label, size = 'md' }: { value: T; onChange: (v: T) => void; options: TabOption<T>[]; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap items-center gap-1">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            disabled={o.disabled}
            title={o.title}
            aria-pressed={on}
            className={`inline-flex items-center rounded-control font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${size === 'sm' ? 'min-h-8 px-2.5 text-small' : 'min-h-10 px-3 text-sm'} ${
              on ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-hover hover:text-fg'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ cards

/**
 * SectionCard: title + one-line description on the left, tools (tabs, export) on the right.
 * Long notes go in the collapsible "Ghi chú" footer, never in the body.
 * `span`: width inside a CardGrid (12 = full, 6 = half); leave it out in any other layout.
 */
export const SectionCard: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  tools?: React.ReactNode;
  notes?: React.ReactNode[];
  notesLabel?: string;
  span?: 4 | 6 | 8 | 12;
  id?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, tools, notes, notesLabel = 'Ghi chú', span, id, children, className = '' }) => {
  const [open, setOpen] = useState(false);
  const notesId = useId();
  const shown = (notes ?? []).filter(Boolean);
  const SPAN = { 4: 'xl:col-span-4', 6: 'xl:col-span-6', 8: 'xl:col-span-8', 12: 'xl:col-span-12' } as const;
  return (
    <section id={id} aria-label={typeof title === 'string' ? title : undefined} className={`${span ? `col-span-12 ${SPAN[span]}` : ''} min-w-0 rounded-card border border-line bg-surface p-5 shadow-card ${className}`}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-card-title text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-small text-muted">{description}</p>}
        </div>
        {tools && <div className="flex flex-wrap items-center gap-2">{tools}</div>}
      </header>
      {children}
      {shown.length > 0 && (
        <footer className="mt-4 border-t border-line pt-2">
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={notesId} className="inline-flex min-h-10 items-center gap-1 text-small text-muted hover:text-fg">
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
            {notesLabel} ({shown.length})
          </button>
          {open && (
            <ul id={notesId} className="mt-1 space-y-1 text-small text-muted">
              {shown.map((n, i) => (
                <li key={i}>• {n}</li>
              ))}
            </ul>
          )}
        </footer>
      )}
    </section>
  );
};

/** Page body: 12-column grid, 16px gaps. */
export const CardGrid: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => <div className={`grid grid-cols-12 gap-4 ${className}`}>{children}</div>;

/** Page title (22/600) with an optional one-line description. */
export const PageTitle: React.FC<{ title: string; description?: React.ReactNode; tools?: React.ReactNode }> = ({ title, description, tools }) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      <h1 className="text-page text-fg">{title}</h1>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
    </div>
    {tools}
  </div>
);

// ------------------------------------------------------------------ empty state

/** Small icon + one line of reason + one action. At most 160px tall — never a big empty frame. */
export const EmptyState: React.FC<{ reason: React.ReactNode; title?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }> = ({ reason, title, action, icon }) => (
  <div className="flex max-h-40 flex-wrap items-center gap-3 rounded-control bg-surface-2 px-4 py-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-muted" aria-hidden>
      {icon ?? <Database className="h-4 w-4" />}
    </span>
    <div className="min-w-0 flex-1">
      {title && <div className="text-sm font-semibold text-fg">{title}</div>}
      <p className="text-sm text-muted">{reason}</p>
    </div>
    {action}
  </div>
);

// ------------------------------------------------------------------ buttons

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }> = ({ variant = 'secondary', className = '', type = 'button', ...props }) => {
  const look = {
    primary: 'bg-primary text-primary-contrast hover:opacity-90',
    secondary: 'border border-line bg-surface text-fg hover:bg-hover',
    ghost: 'text-primary hover:bg-primary-soft',
  }[variant];
  return (
    <button
      type={type}
      {...props}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-control px-3.5 text-sm font-semibold whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 ${look} ${className}`}
    />
  );
};

// ------------------------------------------------------------------ theme toggle

export const ThemeToggle: React.FC<{ theme: 'light' | 'dark'; onToggle: () => void; lang: 'vi' | 'en' }> = ({ theme, onToggle, lang }) => {
  const dark = theme === 'dark';
  const label = lang === 'vi' ? (dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối') : dark ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button type="button" onClick={onToggle} title={label} aria-label={label} className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-line bg-surface text-muted hover:bg-hover hover:text-fg">
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
};
