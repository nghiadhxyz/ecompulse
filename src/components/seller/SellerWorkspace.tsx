import React, { useState } from 'react';
import { Home, Package, ShoppingBag, Megaphone, Bot, Database, Settings, Loader2, UploadCloud, PlayCircle } from 'lucide-react';
import {
  comparableRange,
  defaultComparisonMode,
  resolvePreset,
  type DateRange,
  type Lang,
  type PeriodPreset,
  type Platform,
} from '../../analytics';
import type { ParsedStoreData } from '../../types';
import type { WorkspaceMode } from '../../utils/workspacePreferences';
import { SellerProvider, type EvidenceRequest, type SellerView, type WorkspaceView } from './SellerContext';
import { FilterBar } from './FilterBar';
import { EvidenceDrawer } from './EvidenceDrawer';
import { GhostButton, PrimaryButton } from './ui';
import { HomeView } from './views/HomeView';
import { ProductsView } from './views/ProductsView';
import { OrdersView } from './views/OrdersView';
import { AdsLiveView } from './views/AdsLiveView';
import { DolphinView } from './views/DolphinView';
import { DataView } from './views/DataView';
import { SettingsView } from './views/SettingsView';
import { useWorkspaceData } from '../workspace/useWorkspaceData';
import { DEFAULT_STAGE, type SummaryStage } from '../../analytics';
import { ViewErrorBoundary } from '../workspace/ViewErrorBoundary';

interface SellerWorkspaceProps {
  language: Lang;
  setLanguage: (l: Lang) => void;
  workspaceMode: WorkspaceMode;
  onChangeMode: (m: WorkspaceMode) => void;
  /** Report loaded through the classic upload flow, if any (used read-only). */
  legacyData: ParsedStoreData | null;
  legacyPlatform: string | null;
  /** Load the demo on entry (user clicked "Xem demo"). */
  startWithDemo?: boolean;
  onDemoStarted?: () => void;
}

const NAV: { key: SellerView; icon: typeof Home; vi: string; en: string; short: string }[] = [
  { key: 'home', icon: Home, vi: 'Tổng quan', en: 'Home', short: 'Home' },
  { key: 'products', icon: Package, vi: 'Sản phẩm', en: 'Products', short: 'Sản phẩm' },
  { key: 'orders', icon: ShoppingBag, vi: 'Đơn hàng', en: 'Orders', short: 'Đơn' },
  { key: 'adsLive', icon: Megaphone, vi: 'Ads & Live', en: 'Ads & Live', short: 'Ads/Live' },
  { key: 'dolphin', icon: Bot, vi: 'Dolphin AI', en: 'Dolphin AI', short: 'Dolphin' },
  { key: 'data', icon: Database, vi: 'Dữ liệu', en: 'Data', short: 'Dữ liệu' },
  { key: 'settings', icon: Settings, vi: 'Cài đặt', en: 'Settings', short: 'Cài đặt' },
];

export const SellerWorkspace: React.FC<SellerWorkspaceProps> = ({ language: lang, setLanguage, workspaceMode, onChangeMode, legacyData, legacyPlatform, startWithDemo, onDemoStarted }) => {
  const vi = lang === 'vi';
  const ws = useWorkspaceData({ legacyData, legacyPlatform, startWithDemo, onDemoStarted });
  const { loading, dataset, bounds, persisted, costSettings } = ws;
  const [view, setView] = useState<SellerView>('home');
  const [preset, setPreset] = useState<PeriodPreset>('last30');
  const [custom, setCustom] = useState<DateRange | null>(null);
  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [stage, setStage] = useState<SummaryStage>(DEFAULT_STAGE);
  const [evidence, setEvidence] = useState<EvidenceRequest | null>(null);
  const loadDemo = () => {
    ws.loadDemo();
    setView('home');
    setPreset('last30');
  };

  const content = (() => {
    if (loading) {
      return (
        <div className="glass-panel rounded-2xl p-10 text-center text-sm text-slate-300" aria-live="polite">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" aria-hidden />
          {vi ? 'Đang tải dữ liệu đã lưu trên máy…' : 'Loading saved data…'}
        </div>
      );
    }
    if (view === 'data' || !dataset) {
      if (view !== 'data' && view !== 'settings') {
        return (
          <div className="glass-panel rounded-2xl p-6 sm:p-10 text-center">
            <h2 className="text-lg sm:text-xl font-black text-white">{vi ? 'Bắt đầu với dữ liệu của shop' : 'Start with your shop data'}</h2>
            <p className="text-sm text-slate-400 mt-1.5 max-w-lg mx-auto">
              {vi
                ? 'Nhập file xuất đơn hàng từ Shopee, TikTok Shop hoặc Lazada. File được xử lý ngay trên máy của bạn.'
                : 'Import order exports from Shopee, TikTok Shop or Lazada. Files are processed on your device.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <PrimaryButton onClick={() => setView('data')}>
                <UploadCloud className="w-4 h-4" /> {vi ? 'Nhập file đơn hàng' : 'Import orders'}
              </PrimaryButton>
              <GhostButton onClick={loadDemo}>
                <PlayCircle className="w-4 h-4" /> {vi ? 'Xem với dữ liệu demo 3 tháng' : 'Try the 3-month demo'}
              </GhostButton>
            </div>
          </div>
        );
      }
    }
    if (view === 'data') {
      return <DataView lang={lang} dataset={dataset} sourceKind={ws.sourceKind} onOutcome={ws.applyImport} onLoadDemo={loadDemo} onClear={ws.clear} persisted={persisted} />;
    }
    if (view === 'settings') {
      return (
        <SettingsView
          lang={lang}
          dataset={dataset}
          settings={costSettings}
          onChange={ws.updateSettings}
          workspaceMode={workspaceMode}
          onChangeMode={onChangeMode}
          onChangeLanguage={setLanguage}
        />
      );
    }
    return null;
  })();

  let analytics: React.ReactNode = null;
  if (!content && dataset && bounds) {
    const range = preset === 'custom' ? resolvePreset('custom', bounds.end, custom ?? { start: bounds.start, end: bounds.end }) : resolvePreset(preset, bounds.end);
    const compareMode = defaultComparisonMode(preset);
    const previousRange = comparableRange(range, compareMode);
    const platforms = platform === 'all' ? undefined : [platform];
    const available = Array.from(new Set<Platform>([...dataset.orders.map((o) => o.platform), ...dataset.dailyMetrics.map((d) => d.platform)]));
    const SELLER_VIEWS: SellerView[] = ['home', 'products', 'orders', 'adsLive', 'dolphin', 'data', 'settings'];
    const ctx = {
      lang,
      dataset,
      asOf: bounds.end,
      preset,
      range,
      compareMode,
      previousRange,
      platforms,
      stage,
      baseFilter: { range, platforms, stage },
      openEvidence: setEvidence,
      goTo: (v: WorkspaceView) => SELLER_VIEWS.includes(v as SellerView) && setView(v as SellerView),
      focus: null,
      settings: costSettings,
      updateSettings: ws.updateSettings,
    };
    analytics = (
      <SellerProvider value={ctx}>
        <div className="space-y-4">
          {ws.sourceKind === 'demo' && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-sky-200 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-3 py-2">
              <span>{vi ? 'Bạn đang xem dữ liệu demo của một shop mẫu (01/07–30/09/2025).' : 'You are viewing demo data of a sample shop (01/07–30/09/2025).'}</span>
              <button onClick={ws.exitDemo} className="font-bold underline underline-offset-2 hover:text-white">
                {ws.hasImported ? (vi ? 'Quay lại dữ liệu của tôi' : 'Back to my data') : vi ? 'Thoát demo' : 'Exit demo'}
              </button>
            </div>
          )}
          {view !== 'dolphin' && (
            <FilterBar
              lang={lang}
              preset={preset}
              onPreset={(p) => {
                setPreset(p);
                if (p === 'custom' && !custom) setCustom(range);
              }}
              custom={custom ?? range}
              onCustom={setCustom}
              bounds={bounds}
              range={range}
              previousRange={previousRange}
              platform={platform}
              onPlatform={setPlatform}
              availablePlatforms={available}
              stage={dataset.orders.length === 0 && dataset.dailyMetrics.length > 0 ? stage : undefined}
              onStage={setStage}
            />
          )}
          <ViewErrorBoundary lang={lang} key={view}>
            {view === 'home' && <HomeView />}
            {view === 'products' && <ProductsView />}
            {view === 'orders' && <OrdersView />}
            {view === 'adsLive' && <AdsLiveView />}
            {view === 'dolphin' && <DolphinView key={bounds.end} />}
          </ViewErrorBoundary>
        </div>
      </SellerProvider>
    );
  }

  return (
    <div className="pb-20 md:pb-0">
      {/* Desktop / tablet navigation */}
      <nav className="hidden md:flex gap-1 overflow-x-auto mb-4 p-1 rounded-2xl bg-white/[0.03] border border-white/10" aria-label={vi ? 'Điều hướng người bán' : 'Seller navigation'}>
        {NAV.map((n) => (
          <button
            key={n.key}
            onClick={() => setView(n.key)}
            aria-current={view === n.key ? 'page' : undefined}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${view === n.key ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-white/[0.06]'}`}
          >
            <n.icon className="w-4 h-4" aria-hidden /> {vi ? n.vi : n.en}
          </button>
        ))}
      </nav>

      {content ?? analytics}

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#070a18]/95 backdrop-blur border-t border-white/10 grid grid-cols-7" aria-label={vi ? 'Điều hướng người bán' : 'Seller navigation'}>
        {NAV.map((n) => (
          <button
            key={n.key}
            onClick={() => setView(n.key)}
            aria-current={view === n.key ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${view === n.key ? 'text-sky-300' : 'text-slate-400'}`}
          >
            <n.icon className="w-5 h-5" aria-hidden />
            <span className="truncate max-w-full px-0.5">{vi ? n.short : n.en}</span>
          </button>
        ))}
      </nav>

      {dataset && <EvidenceDrawer dataset={dataset} request={evidence} onClose={() => setEvidence(null)} lang={lang} />}
    </div>
  );
};
