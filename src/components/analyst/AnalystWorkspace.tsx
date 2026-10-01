import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  CalendarRange,
  ClipboardList,
  Database,
  FileText,
  FlaskConical,
  Gauge,
  GitBranch,
  HeartPulse,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  Megaphone,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  PlayCircle,
  Radio,
  Settings2,
  ShieldCheck,
  Sigma,
  Target,
  Tags,
  TrendingUp,
  UploadCloud,
  Users,
  Video,
  Wallet,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
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
import { CampaignCalendar } from './views/CampaignCalendar';
import { AdsIntelligenceView } from './views/AdsIntelligenceView';
import { LiveAuditor } from './views/LiveAuditor';
import { VideoAffiliateView } from './views/VideoAffiliateView';
import { RootCauseView } from './views/RootCauseView';
import { AnomalyOpportunityView } from './views/AnomalyOpportunityView';
import { ChangeImpactView } from './views/ChangeImpactView';
import { MonthlyPlanningView } from './views/MonthlyPlanningView';
import { ActionCenterView } from './views/ActionCenterView';
import { ReportCenterView } from './views/ReportCenterView';
import { CustomersView } from './views/CustomersView';
import { WhatIfView } from './views/WhatIfView';
import { AdvancedStatsView } from './views/AdvancedStatsView';
import { assessDataQuality, DEFAULT_STAGE, type SummaryStage } from '../../analytics';
import { PageTitle } from '../ui/primitives';
import { PlanningProvider, usePlanningState } from '../workspace/usePlanning';

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
  icon: LucideIcon;
  /** One-line description under the page title. */
  descVi?: string;
  /** Planned in a later phase — shown but not clickable. */
  phase?: number;
  classic?: boolean;
}

const GROUPS: { vi: string; en: string; items: NavItem[] }[] = [
  {
    vi: 'Hôm nay',
    en: 'Today',
    items: [
      { key: 'overview', vi: 'Executive Overview', en: 'Executive Overview', icon: Gauge, descVi: 'Điều gì đã thay đổi, ở sàn và ngành hàng nào' },
      { key: 'alerts', vi: 'Cảnh báo & Dolphin AI', en: 'Alerts & Dolphin AI', icon: Bell, descVi: 'Bản tin hôm nay và các cảnh báo cần xem' },
    ],
  },
  {
    vi: 'Hiệu quả',
    en: 'Performance',
    items: [
      { key: 'category', vi: 'Category Intelligence', en: 'Category Intelligence', icon: LayoutGrid, descVi: 'Ngành, nhóm hàng và SKU đóng góp thế nào' },
      { key: 'productsCombo', vi: 'Sản phẩm & Combo', en: 'Products & Combo', icon: PackageSearch, descVi: 'Sản phẩm bán chạy, combo và hiệu quả từng kênh' },
      { key: 'revenueProfit', vi: 'Doanh thu & Lợi nhuận', en: 'Revenue & Profit', icon: Wallet, descVi: 'Từ doanh số tới lợi nhuận đóng góp' },
      { key: 'orderHealth', vi: 'Sức khỏe đơn hàng', en: 'Order Health', icon: HeartPulse, descVi: 'Hủy, hoàn và lý do' },
      { key: 'customers', vi: 'Khách hàng', en: 'Customers', icon: Users, descVi: 'Khách mới, khách cũ và nhóm khách' },
    ],
  },
  {
    vi: 'Tăng trưởng',
    en: 'Growth',
    items: [
      { key: 'funnel', vi: 'Traffic & Funnel', en: 'Traffic & Funnel', icon: Workflow, descVi: 'Doanh thu theo kênh, nguồn truy cập và phễu' },
      { key: 'campaign', vi: 'Campaign & Calendar', en: 'Campaign & Calendar', icon: CalendarRange, descVi: 'Ngày sale, ngày thường và so sánh chiến dịch' },
      { key: 'ads', vi: 'Ads Intelligence', en: 'Ads Intelligence', icon: Megaphone, descVi: 'Chi phí, doanh thu quy đổi và ROAS' },
      { key: 'live', vi: 'Livestream', en: 'Livestream', icon: Radio, descVi: 'Phiên live, người xem và phễu live' },
      { key: 'video', vi: 'Video & Affiliate', en: 'Video & Affiliate', icon: Video, descVi: 'Video của shop và KOC' },
    ],
  },
  {
    vi: 'Phân tích sâu',
    en: 'Intelligence',
    items: [
      { key: 'rootCause', vi: 'Root Cause', en: 'Root Cause', icon: GitBranch, descVi: 'Tách thay đổi doanh số thành từng nguyên nhân' },
      { key: 'anomaly', vi: 'Anomaly & Opportunity', en: 'Anomaly & Opportunity', icon: Activity, descVi: 'Ngày bất thường và cơ hội' },
      { key: 'whatIf', vi: 'What-If', en: 'What-If', icon: FlaskConical, descVi: 'Mô phỏng khi đổi giá, Ads, tỷ lệ hủy' },
      { key: 'stats', vi: 'Thống kê nâng cao', en: 'Advanced statistics', icon: Sigma, descVi: 'Kiểm định, tương quan và chỉ số theo thứ' },
      { key: 'changeImpact', vi: 'Change Impact', en: 'Change Impact', icon: TrendingUp, descVi: 'Tác động của một thay đổi bạn đã làm' },
    ],
  },
  {
    vi: 'Kế hoạch',
    en: 'Planning',
    items: [
      { key: 'planning', vi: 'Monthly Planning', en: 'Monthly Planning', icon: Target, descVi: 'Mục tiêu tháng và tiến độ' },
      { key: 'actions', vi: 'Action Center', en: 'Action Center', icon: ClipboardList, descVi: 'Việc cần làm từ các phân tích' },
      { key: 'reports', vi: 'Report Center', en: 'Report Center', icon: FileText, descVi: 'Xuất báo cáo' },
    ],
  },
];

/** Data pages, at the foot of the sidebar next to the data status. */
const DATA_ITEMS: NavItem[] = [
  { key: 'dataHub', vi: 'Data Hub', en: 'Data Hub', icon: UploadCloud, descVi: 'Nhập file và quản lý dữ liệu trên máy' },
  { key: 'dataQuality', vi: 'Chất lượng dữ liệu', en: 'Data Quality', icon: ShieldCheck, descVi: 'Dữ liệu đủ cho phân tích nào, chỗ nào lệch' },
  { key: 'mapping', vi: 'Data Mapping', en: 'Data Mapping', icon: Tags, descVi: 'Cột nào trong file được đọc thành chỉ số nào' },
  { key: 'settings', vi: 'Giá vốn, phí & cài đặt', en: 'COGS, fees & settings', icon: Settings2, descVi: 'Giá vốn, phí và ước tính cho cả shop' },
];
const ALL_ITEMS = [...GROUPS.flatMap((g) => g.items), ...DATA_ITEMS];

const ANALYTICS_VIEWS: AnalystView[] = ['overview', 'alerts', 'category', 'productsCombo', 'revenueProfit', 'orderHealth', 'funnel', 'campaign', 'ads', 'live', 'video', 'rootCause', 'anomaly', 'changeImpact', 'planning', 'actions', 'reports', 'customers', 'whatIf', 'stats', 'mapping', 'dataQuality'];

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
  const [stage, setStage] = useState<SummaryStage>(DEFAULT_STAGE);
  const [categories, setCategories] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRequest | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ecompulse-sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('ecompulse-sidebar', collapsed ? 'collapsed' : 'open');
    } catch {
      /* storage blocked */
    }
  }, [collapsed]);
  const planning = usePlanningState(dataset, ws.sourceKind === 'demo' ? 'demo' : 'imported', bounds?.end ?? null);

  const resolved = useMemo(() => {
    if (!bounds) return null;
    const range = preset === 'custom' ? resolvePreset('custom', bounds.end, custom ?? bounds) : resolvePreset(preset, bounds.end);
    const mode = compare === 'auto' || compare === 'custom' ? defaultComparisonMode(preset) : compare;
    const previousRange = compare === 'custom' && customCompare ? customCompare : comparableRange(range, mode);
    return { range, mode, previousRange };
  }, [bounds, preset, custom, compare, customCompare]);

  const baseFilter: DatasetFilter | null = useMemo(
    () => (resolved ? { range: resolved.range, platforms: platforms.length ? platforms : undefined, categories: categories.length ? categories : undefined, stage } : null),
    [resolved, platforms, categories, stage],
  );

  // Seller views reused here navigate with seller names — map them to Analyst modules.
  const SELLER_TO_ANALYST: Partial<Record<WorkspaceView, AnalystView>> = {
    home: 'overview',
    products: 'productsCombo',
    orders: 'orderHealth',
    adsLive: 'ads',
    dolphin: 'alerts',
    data: 'dataHub',
  };
  const goTo = (target: WorkspaceView, f?: Partial<DatasetFilter>) => {
    const v = SELLER_TO_ANALYST[target] ?? target;
    if (ALL_ITEMS.some((i) => i.key === v && !i.phase)) {
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
        <div className="bg-surface border border-line shadow-card rounded-2xl p-10 text-center text-sm text-fg" aria-live="polite">
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
        <div className="bg-surface border border-line shadow-card rounded-2xl p-6 sm:p-10 text-center">
          <h2 className="text-lg font-black text-fg">{vi ? 'Chưa có dữ liệu để phân tích' : 'No data to analyze yet'}</h2>
          <p className="text-sm text-muted mt-1.5">{vi ? 'Nhập file xuất đơn hàng ở Data Hub, hoặc dùng dữ liệu demo 3 tháng.' : 'Import order exports in the Data Hub, or use the 3-month demo.'}</p>
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
      stage,
      baseFilter,
      openEvidence: setEvidence,
      goTo,
      focus,
      settings: ws.costSettings,
      updateSettings: ws.updateSettings,
    };
    const showFilters = ANALYTICS_VIEWS.includes(view) && view !== 'alerts' && view !== 'mapping' && view !== 'dataQuality' && view !== 'changeImpact' && view !== 'actions';
    return (
      <PlanningProvider value={planning}>
      <WorkspaceProvider value={ctx}>
        <div className="space-y-4">
          {ws.sourceKind === 'demo' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-info-soft px-3 py-2 text-sm text-info">
              <span>{vi ? 'Đang xem dữ liệu demo của một shop mẫu (01/07–30/09/2025).' : 'Viewing demo data (01/07–30/09/2025).'}</span>
              <button type="button" onClick={ws.exitDemo} className="inline-flex min-h-10 items-center font-semibold underline underline-offset-2">{ws.hasImported ? (vi ? 'Quay lại dữ liệu của tôi' : 'Back to my data') : vi ? 'Thoát demo' : 'Exit demo'}</button>
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
              stage={dataset.orders.length === 0 && dataset.dailyMetrics.length > 0 ? stage : undefined}
              onStage={setStage}
              disabled={{
                stage: ['anomaly', 'campaign', 'stats'].includes(view) ? (vi ? 'Trang này luôn dùng đơn đặt để đúng ngày phát sinh' : 'This page always counts placed orders') : undefined,
              }}
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
            {view === 'campaign' && <CampaignCalendar />}
            {view === 'ads' && <AdsIntelligenceView />}
            {view === 'live' && <LiveAuditor />}
            {view === 'video' && <VideoAffiliateView />}
            {view === 'rootCause' && <RootCauseView />}
            {view === 'anomaly' && <AnomalyOpportunityView />}
            {view === 'changeImpact' && <ChangeImpactView />}
            {view === 'planning' && <MonthlyPlanningView />}
            {view === 'actions' && <ActionCenterView />}
            {view === 'reports' && <ReportCenterView />}
            {view === 'customers' && <CustomersView />}
            {view === 'whatIf' && <WhatIfView />}
            {view === 'stats' && <AdvancedStatsView />}
            {view === 'dataQuality' && <DataQualityPanel dataset={dataset} language={lang} />}
            {view === 'mapping' && <DataMapping />}
          </ViewErrorBoundary>
        </div>
      </WorkspaceProvider>
      </PlanningProvider>
    );
  };

  const navButton = (item: NavItem) => {
    const active = view === item.key;
    const Icon = item.icon;
    const label = vi ? item.vi : item.en;
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => (item.classic ? onOpenClassic() : goTo(item.key as AnalystView))}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? label : undefined}
        className={`flex min-h-10 w-full items-center gap-2.5 rounded-control px-3 text-left text-sm font-medium transition-colors ${
          active ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-hover hover:text-fg'
        } ${collapsed ? 'justify-center px-0' : ''}`}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    );
  };

  // Data status at the foot of the sidebar: how many analysis groups the data supports.
  const quality = useMemo(() => (dataset ? assessDataQuality(dataset) : null), [dataset]);
  const ready = quality ? quality.capabilities.filter((c) => c.status !== 'unavailable').length : 0;
  const current = ALL_ITEMS.find((i) => i.key === view);

  return (
    <div className="flex gap-6">
      <aside
        className={`hidden shrink-0 transition-[width] lg:block ${collapsed ? 'w-[72px]' : 'w-[248px]'}`}
        aria-label={vi ? 'Điều hướng Analyst' : 'Analyst navigation'}
      >
        <nav className="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col rounded-card border border-line bg-surface p-3 shadow-card">
          <div className="flex-1 space-y-4 overflow-y-auto">
            {GROUPS.map((g) => (
              <div key={g.en}>
                {!collapsed && <div className="px-3 pb-1 text-small text-muted">{vi ? g.vi : g.en}</div>}
                <div className="space-y-0.5">{g.items.map(navButton)}</div>
              </div>
            ))}
            <div>
              {!collapsed && <div className="px-3 pb-1 text-small text-muted">{vi ? 'Dữ liệu' : 'Data'}</div>}
              <div className="space-y-0.5">{DATA_ITEMS.map(navButton)}</div>
            </div>
          </div>
          <div className="mt-3 space-y-1 border-t border-line pt-3">
            {quality && (
              <button
                type="button"
                onClick={() => goTo('dataQuality')}
                title={vi ? 'Mở trang Chất lượng dữ liệu' : 'Open Data Quality'}
                className={`flex min-h-10 w-full items-center gap-2.5 rounded-control px-3 text-left text-small text-muted hover:bg-hover hover:text-fg ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <Database className="h-4 w-4 shrink-0" aria-hidden />
                {!collapsed && (
                  <span className="truncate">
                    {ready}/{quality.capabilities.length} {vi ? 'nhóm phân tích' : 'analysis groups'}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onOpenClassic}
              title={vi ? 'Dashboard cổ điển' : 'Classic dashboard'}
              className={`flex min-h-10 w-full items-center gap-2.5 rounded-control px-3 text-left text-small text-muted hover:bg-hover hover:text-fg ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
              {!collapsed && <span className="truncate">{vi ? 'Dashboard cổ điển' : 'Classic dashboard'}</span>}
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? (vi ? 'Mở rộng thanh bên' : 'Expand sidebar') : vi ? 'Thu gọn thanh bên' : 'Collapse sidebar'}
              title={collapsed ? (vi ? 'Mở rộng' : 'Expand') : vi ? 'Thu gọn' : 'Collapse'}
              className={`flex min-h-10 w-full items-center gap-2.5 rounded-control px-3 text-left text-small text-muted hover:bg-hover hover:text-fg ${collapsed ? 'justify-center px-0' : ''}`}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden /> : <PanelLeftClose className="h-4 w-4" aria-hidden />}
              {!collapsed && <span>{vi ? 'Thu gọn' : 'Collapse'}</span>}
            </button>
          </div>
        </nav>
      </aside>

      <div className="mx-auto w-full min-w-0 max-w-[1440px]">
        {/* Mobile / tablet navigation */}
        <div className="mb-3 lg:hidden">
          <label className="sr-only" htmlFor="analyst-nav">{vi ? 'Chọn module' : 'Module'}</label>
          <select
            id="analyst-nav"
            value={view}
            onChange={(e) => (e.target.value === '__classic' ? onOpenClassic() : goTo(e.target.value as AnalystView))}
            className="min-h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-fg"
          >
            {[...GROUPS, { vi: 'Dữ liệu', en: 'Data', items: DATA_ITEMS }].map((g) => (
              <optgroup key={g.en} label={vi ? g.vi : g.en}>
                {g.items.map((i) => (
                  <option key={i.key} value={i.classic ? '__classic' : i.key} disabled={!!i.phase}>
                    {vi ? i.vi : i.en}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="__classic">{vi ? 'Dashboard cổ điển' : 'Classic dashboard'}</option>
          </select>
        </div>
        {current && (
          <div className="mb-4">
            <PageTitle title={vi ? current.vi : current.en} description={vi ? current.descVi : undefined} />
          </div>
        )}
        {renderView()}
      </div>
      {dataset && <EvidenceDrawer dataset={dataset} request={evidence} onClose={() => setEvidence(null)} lang={lang} />}
    </div>
  );
};
