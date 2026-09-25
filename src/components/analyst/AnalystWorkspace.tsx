import React, { useMemo, useState } from 'react';
import { Loader2, PlayCircle, UploadCloud, LayoutDashboard } from 'lucide-react';
import {
  comparableRange,
  defaultComparisonMode,
  resolvePreset,
  type DatasetFilter,
  type DateRange,
  type Lang,
  type PeriodPreset,
  type Platform,
} from '../../analytics';
import type { ParsedStoreData } from '../../types';
import type { WorkspaceMode } from '../../utils/workspacePreferences';
import { useWorkspaceData } from '../workspace/useWorkspaceData';
import { ViewErrorBoundary } from '../workspace/ViewErrorBoundary';
import { WorkspaceProvider, type AnalystView, type EvidenceRequest, type WorkspaceView } from '../seller/SellerContext';
import { EvidenceDrawer } from '../seller/EvidenceDrawer';
import { GhostButton, PrimaryButton } from '../seller/ui';
import { DolphinView } from '../seller/views/DolphinView';
import { AdsLiveView } from '../seller/views/AdsLiveView';
import { DataView } from '../seller/views/DataView';
import { SettingsView } from '../seller/views/SettingsView';
import { DataQualityPanel } from '../data/DataQualityPanel';
import { AnalystFilterBar, type AnalystCompare } from './AnalystFilterBar';
import { ExecutiveOverview } from './views/ExecutiveOverview';
import { CategoryIntelligence } from './views/CategoryIntelligence';
import { ProductsCombo } from './views/ProductsCombo';
import { RevenueProfit } from './views/RevenueProfit';
import { OrderHealthAnalyst } from './views/OrderHealthAnalyst';
import { TrafficFunnel } from './views/TrafficFunnel';
import { DataMapping } from './views/DataMapping';

interface Props {
  language: Lang;
  setLanguage: (l: Lang) => void;
  onChangeMode: (m: WorkspaceMode) => void;
  legacyData: ParsedStoreData | null;
  legacyPlatform: string | null;
  startWithDemo?: boolean;
  onDemoStarted?: () => void;
  /** Opens the classic dashboard (legacy tabs, What-If, roadmap). */
  onOpenClassic: () => void;
}

interface NavItem {
  key: AnalystView | string;
  vi: string;
  en: string;
  /** Planned in a later phase — shown but not clickable. */
  phase?: number;
  classic?: boolean;
}

const GROUPS: { vi: string; en: string; items: NavItem[] }[] = [
  { vi: 'Hôm nay', en: 'Today', items: [{ key: 'overview', vi: 'Executive Overview', en: 'Executive Overview' }, { key: 'alerts', vi: 'Cảnh báo & Dolphin AI', en: 'Alerts & Dolphin AI' }] },
  {
    vi: 'Hiệu quả',
    en: 'Performance',
    items: [
      { key: 'category', vi: 'Category Intelligence', en: 'Category Intelligence' },
      { key: 'productsCombo', vi: 'Sản phẩm & Combo', en: 'Products & Combo' },
      { key: 'revenueProfit', vi: 'Doanh thu & Lợi nhuận', en: 'Revenue & Profit' },
      { key: 'orderHealth', vi: 'Sức khỏe đơn hàng', en: 'Order Health' },
      { key: 'customers', vi: 'Khách hàng', en: 'Customers', phase: 7 },
    ],
  },
  {
    vi: 'Tăng trưởng',
    en: 'Growth',
    items: [
      { key: 'funnel', vi: 'Traffic & Funnel', en: 'Traffic & Funnel' },
      { key: 'adsLiveBasic', vi: 'Ads & Live (cơ bản)', en: 'Ads & Live (basic)' },
      { key: 'campaign', vi: 'Campaign & Calendar', en: 'Campaign & Calendar', phase: 4 },
      { key: 'video', vi: 'Video & Affiliate', en: 'Video & Affiliate', phase: 4 },
    ],
  },
  {
    vi: 'Phân tích sâu',
    en: 'Intelligence',
    items: [
      { key: 'rootCause', vi: 'Root Cause', en: 'Root Cause', phase: 5 },
      { key: 'anomaly', vi: 'Anomaly & Opportunity', en: 'Anomaly & Opportunity', phase: 5 },
      { key: 'whatIf', vi: 'What-If (dashboard cổ điển)', en: 'What-If (classic)', classic: true },
      { key: 'changeImpact', vi: 'Change Impact', en: 'Change Impact', phase: 6 },
    ],
  },
  { vi: 'Kế hoạch', en: 'Planning', items: [{ key: 'planning', vi: 'Monthly Planning', en: 'Monthly Planning', phase: 6 }, { key: 'actions', vi: 'Action Center', en: 'Action Center', phase: 6 }] },
  { vi: 'Báo cáo', en: 'Reports', items: [{ key: 'reports', vi: 'Report Center', en: 'Report Center', phase: 6 }] },
  {
    vi: 'Dữ liệu',
    en: 'Data',
    items: [
      { key: 'dataHub', vi: 'Data Hub', en: 'Data Hub' },
      { key: 'dataQuality', vi: 'Chất lượng dữ liệu', en: 'Data Quality' },
      { key: 'mapping', vi: 'Data Mapping', en: 'Data Mapping' },
      { key: 'settings', vi: 'Giá vốn, phí & cài đặt', en: 'COGS, fees & settings' },
    ],
  },
];

const ANALYTICS_VIEWS: AnalystView[] = ['overview', 'alerts', 'category', 'productsCombo', 'revenueProfit', 'orderHealth', 'funnel', 'adsLiveBasic', 'mapping', 'dataQuality'];

export const AnalystWorkspace: React.FC<Props> = ({ language: lang, setLanguage, onChangeMode, legacyData, legacyPlatform, startWithDemo, onDemoStarted, onOpenClassic }) => {
  const vi = lang === 'vi';
  const ws = useWorkspaceData({ legacyData, legacyPlatform, startWithDemo, onDemoStarted });
  const { loading, dataset, bounds } = ws;
  const [view, setView] = useState<AnalystView>('overview');
  const [focus, setFocus] = useState<Partial<DatasetFilter> | null>(null);
  const [preset, setPreset] = useState<PeriodPreset>('last30');
  const [custom, setCustom] = useState<DateRange | null>(null);
  const [compare, setCompare] = useState<AnalystCompare>('auto');
  const [customCompare, setCustomCompare] = useState<DateRange | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRequest | null>(null);

  const resolved = useMemo(() => {
    if (!bounds) return null;
    const range = preset === 'custom' ? resolvePreset('custom', bounds.end, custom ?? bounds) : resolvePreset(preset, bounds.end);
    const mode = compare === 'auto' || compare === 'custom' ? defaultComparisonMode(preset) : compare;
    const previousRange = compare === 'custom' && customCompare ? customCompare : comparableRange(range, mode);
    return { range, mode, previousRange };
  }, [bounds, preset, custom, compare, customCompare]);

  const baseFilter: DatasetFilter | null = useMemo(
    () => (resolved ? { range: resolved.range, platforms: platforms.length ? platforms : undefined, categories: categories.length ? categories : undefined } : null),
    [resolved, platforms, categories],
  );

  // Seller views reused here navigate with seller names — map them to Analyst modules.
  const SELLER_TO_ANALYST: Partial<Record<WorkspaceView, AnalystView>> = {
    home: 'overview',
    products: 'productsCombo',
    orders: 'orderHealth',
    adsLive: 'adsLiveBasic',
    dolphin: 'alerts',
    data: 'dataHub',
  };
  const goTo = (target: WorkspaceView, f?: Partial<DatasetFilter>) => {
    const v = SELLER_TO_ANALYST[target] ?? target;
    if (GROUPS.flatMap((g) => g.items).some((i) => i.key === v && !i.phase) || v === 'settings') {
      setFocus(f ?? null);
      setView(v as AnalystView);
      window.scrollTo({ top: 0 });
    }
  };

  const availableCategories = useMemo(() => (dataset ? [...new Set(dataset.products.map((p) => p.category).filter(Boolean) as string[])].sort() : []), [dataset]);
  const availablePlatforms = useMemo(
    () => (dataset ? [...new Set<Platform>([...dataset.orders.map((o) => o.platform), ...dataset.dailyMetrics.map((d) => d.platform)])] : []),
    [dataset],
  );

  const renderView = () => {
    if (loading) {
      return (
        <div className="glass-panel rounded-2xl p-10 text-center text-sm text-slate-300" aria-live="polite">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" aria-hidden />
          {vi ? 'Đang tải dữ liệu đã lưu trên máy…' : 'Loading saved data…'}
        </div>
      );
    }
    if (view === 'dataHub') {
      return <DataView lang={lang} dataset={dataset} sourceKind={ws.sourceKind} onOutcome={ws.applyImport} onLoadDemo={ws.loadDemo} onClear={ws.clear} persisted={ws.persisted} />;
    }
    if (view === 'settings') {
      return <SettingsView lang={lang} dataset={dataset} settings={ws.costSettings} onChange={ws.updateSettings} workspaceMode="analyst" onChangeMode={onChangeMode} onChangeLanguage={setLanguage} />;
    }
    if (!dataset || !bounds || !resolved || !baseFilter) {
      return (
        <div className="glass-panel rounded-2xl p-6 sm:p-10 text-center">
          <h2 className="text-lg font-black text-white">{vi ? 'Chưa có dữ liệu để phân tích' : 'No data to analyze yet'}</h2>
          <p className="text-sm text-slate-400 mt-1.5">{vi ? 'Nhập file xuất đơn hàng ở Data Hub, hoặc dùng dữ liệu demo 3 tháng.' : 'Import order exports in the Data Hub, or use the 3-month demo.'}</p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <PrimaryButton onClick={() => setView('dataHub')}><UploadCloud className="w-4 h-4" /> Data Hub</PrimaryButton>
            <GhostButton onClick={ws.loadDemo}><PlayCircle className="w-4 h-4" /> {vi ? 'Dữ liệu demo' : 'Demo data'}</GhostButton>
          </div>
        </div>
      );
    }
    const ctx = {
      lang,
      dataset,
      asOf: bounds.end,
      preset,
      range: resolved.range,
      compareMode: resolved.mode,
      previousRange: resolved.previousRange,
      platforms: baseFilter.platforms,
      baseFilter,
      openEvidence: setEvidence,
      goTo,
      focus,
    };
    const showFilters = ANALYTICS_VIEWS.includes(view) && view !== 'alerts' && view !== 'mapping' && view !== 'dataQuality';
    return (
      <WorkspaceProvider value={ctx}>
        <div className="space-y-4">
          {ws.sourceKind === 'demo' && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-sky-200 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-3 py-2">
              <span>{vi ? 'Đang xem dữ liệu demo của một shop mẫu (01/07–30/09/2025).' : 'Viewing demo data (01/07–30/09/2025).'}</span>
              <button onClick={ws.exitDemo} className="font-bold underline underline-offset-2">{ws.hasImported ? (vi ? 'Quay lại dữ liệu của tôi' : 'Back to my data') : vi ? 'Thoát demo' : 'Exit demo'}</button>
            </div>
          )}
          {showFilters && (
            <AnalystFilterBar
              lang={lang}
              bounds={bounds}
              preset={preset}
              onPreset={(p) => {
                setPreset(p);
                if (p === 'custom' && !custom) setCustom(resolved.range);
              }}
              custom={custom ?? resolved.range}
              onCustom={setCustom}
              compare={compare}
              onCompare={(c) => {
                setCompare(c);
                if (c === 'custom' && !customCompare) setCustomCompare(resolved.previousRange);
              }}
              customCompare={customCompare ?? resolved.previousRange}
              onCustomCompare={setCustomCompare}
              range={resolved.range}
              previousRange={resolved.previousRange}
              platforms={platforms}
              onPlatforms={setPlatforms}
              availablePlatforms={availablePlatforms}
              categories={categories}
              onCategories={setCategories}
              availableCategories={availableCategories}
            />
          )}
          <ViewErrorBoundary lang={lang} key={view}>
            {view === 'overview' && <ExecutiveOverview />}
            {view === 'alerts' && <DolphinView key={bounds.end} />}
            {view === 'category' && <CategoryIntelligence />}
            {view === 'productsCombo' && <ProductsCombo />}
            {view === 'revenueProfit' && <RevenueProfit />}
            {view === 'orderHealth' && <OrderHealthAnalyst />}
            {view === 'funnel' && <TrafficFunnel />}
            {view === 'adsLiveBasic' && <AdsLiveView />}
            {view === 'dataQuality' && <DataQualityPanel dataset={dataset} language={lang} />}
            {view === 'mapping' && <DataMapping />}
          </ViewErrorBoundary>
        </div>
      </WorkspaceProvider>
    );
  };

  const navButton = (item: NavItem) => {
    const active = view === item.key;
    if (item.phase) {
      return (
        <span key={item.key} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 cursor-not-allowed" title={vi ? `Sẽ có ở Phase ${item.phase}` : `Coming in phase ${item.phase}`}>
          {vi ? item.vi : item.en}
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10">P{item.phase}</span>
        </span>
      );
    }
    return (
      <button
        key={item.key}
        onClick={() => (item.classic ? onOpenClassic() : goTo(item.key as AnalystView))}
        aria-current={active ? 'page' : undefined}
        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold ${active ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-white/[0.06]'}`}
      >
        {vi ? item.vi : item.en}
      </button>
    );
  };

  return (
    <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-5">
      <aside className="hidden lg:block" aria-label={vi ? 'Điều hướng Analyst' : 'Analyst navigation'}>
        <nav className="sticky top-20 space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-2.5 max-h-[calc(100vh-6rem)] overflow-y-auto">
          {GROUPS.map((g) => (
            <div key={g.en}>
              <div className="px-2.5 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{vi ? g.vi : g.en}</div>
              <div className="space-y-0.5">{g.items.map(navButton)}</div>
            </div>
          ))}
          <div className="border-t border-white/10 pt-2">
            <button onClick={onOpenClassic} className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-white/[0.06] flex items-center gap-1.5">
              <LayoutDashboard className="w-3.5 h-3.5" aria-hidden /> {vi ? 'Dashboard cổ điển' : 'Classic dashboard'}
            </button>
          </div>
        </nav>
      </aside>

      {/* Mobile / tablet navigation */}
      <div className="lg:hidden mb-3">
        <label className="sr-only" htmlFor="analyst-nav">{vi ? 'Chọn module' : 'Module'}</label>
        <select
          id="analyst-nav"
          value={view}
          onChange={(e) => (e.target.value === '__classic' ? onOpenClassic() : goTo(e.target.value as AnalystView))}
          className="w-full bg-white/[0.06] border border-white/15 rounded-xl px-3 py-2 text-sm text-slate-100 [color-scheme:dark]"
        >
          {GROUPS.map((g) => (
            <optgroup key={g.en} label={vi ? g.vi : g.en}>
              {g.items.map((i) => (
                <option key={i.key} value={i.classic ? '__classic' : i.key} disabled={!!i.phase}>
                  {vi ? i.vi : i.en}{i.phase ? ` (Phase ${i.phase})` : ''}
                </option>
              ))}
            </optgroup>
          ))}
          <option value="__classic">{vi ? 'Dashboard cổ điển' : 'Classic dashboard'}</option>
        </select>
      </div>

      <div className="min-w-0">{renderView()}</div>
      {dataset && <EvidenceDrawer dataset={dataset} request={evidence} onClose={() => setEvidence(null)} lang={lang} />}
    </div>
  );
};
