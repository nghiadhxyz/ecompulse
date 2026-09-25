import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Home, Package, ShoppingBag, Megaphone, Bot, Database, Settings, Loader2, UploadCloud, PlayCircle, RotateCcw } from 'lucide-react';
import {
  canonicalFromParsedStoreData,
  comparableRange,
  datasetDateBounds,
  defaultComparisonMode,
  mergeIntoWorkspace,
  resolvePreset,
  withCostSettings,
  type CanonicalDataset,
  type CostSettings,
  type DateRange,
  type Lang,
  type PeriodPreset,
  type Platform,
} from '../../analytics';
import type { ParsedStoreData } from '../../types';
import { parseShopeeExcelFile } from '../../utils/excelParser';
import { buildDemoCanonicalDataset } from '../../data/demoCanonicalDataset';
import { clearWorkspace, loadCostSettings, loadWorkspace, saveCostSettings, saveWorkspace } from '../../utils/workspaceStore';
import type { WorkspaceMode } from '../../utils/workspacePreferences';
import { SellerProvider, type EvidenceRequest, type SellerView } from './SellerContext';
import { FilterBar } from './FilterBar';
import { EvidenceDrawer } from './EvidenceDrawer';
import { GhostButton, PrimaryButton } from './ui';
import { HomeView } from './views/HomeView';
import { ProductsView } from './views/ProductsView';
import { OrdersView } from './views/OrdersView';
import { AdsLiveView } from './views/AdsLiveView';
import { DolphinView } from './views/DolphinView';
import { DataView, type ImportLogEntry } from './views/DataView';
import { SettingsView } from './views/SettingsView';
import type { ImportOutcome } from './importClient';

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

class ViewErrorBoundary extends React.Component<{ lang: Lang; children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    const vi = this.props.lang === 'vi';
    return (
      <div className="glass-panel rounded-2xl p-6 text-center">
        <p className="text-sm font-bold text-white">{vi ? 'Có lỗi khi hiển thị trang này.' : 'Something went wrong rendering this page.'}</p>
        <p className="text-xs text-slate-400 mt-1 break-words">{this.state.error.message}</p>
        <GhostButton className="mt-3" onClick={() => this.setState({ error: null })}>
          <RotateCcw className="w-4 h-4" /> {vi ? 'Thử lại' : 'Retry'}
        </GhostButton>
      </div>
    );
  }
}

export const SellerWorkspace: React.FC<SellerWorkspaceProps> = ({ language: lang, setLanguage, workspaceMode, onChangeMode, legacyData, legacyPlatform, startWithDemo, onDemoStarted }) => {
  const vi = lang === 'vi';
  const [loading, setLoading] = useState(true);
  /** Imported data (persisted). Never overwritten by the demo. */
  const [imported, setImported] = useState<CanonicalDataset | null>(null);
  /** Demo view is a separate, switchable state on top of the user's data. */
  const [demo, setDemo] = useState(false);
  const [persisted, setPersisted] = useState(true);
  const [costSettings, setCostSettings] = useState<CostSettings>({});
  const [view, setView] = useState<SellerView>('home');
  const [preset, setPreset] = useState<PeriodPreset>('last30');
  const [custom, setCustom] = useState<DateRange | null>(null);
  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [evidence, setEvidence] = useState<EvidenceRequest | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadWorkspace(), loadCostSettings()]).then(([ws, settings]) => {
      if (!alive) return;
      if (ws?.kind === 'imported') setImported(ws.dataset);
      if (ws?.kind === 'demo') setDemo(true);
      setCostSettings(settings);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const loadDemo = useCallback(() => {
    setDemo(true);
    setView('home');
    setPreset('last30');
  }, []);

  // Remember "demo on" only when there is no imported data to protect.
  useEffect(() => {
    if (loading) return;
    if (demo && !imported) saveWorkspace({ kind: 'demo' });
    if (!demo && !imported) clearWorkspace();
  }, [demo, imported, loading]);

  useEffect(() => {
    if (!loading && startWithDemo) {
      loadDemo();
      onDemoStarted?.();
    }
  }, [loading, startWithDemo, loadDemo, onDemoStarted]);

  const source: { dataset: CanonicalDataset; kind: 'demo' | 'imported' | 'legacy' } | null = useMemo(() => {
    if (demo) return { dataset: buildDemoCanonicalDataset(), kind: 'demo' };
    if (imported) return { dataset: imported, kind: 'imported' };
    if (legacyData) return { dataset: canonicalFromParsedStoreData(legacyData, legacyPlatform), kind: 'legacy' };
    return null;
  }, [demo, imported, legacyData, legacyPlatform]);

  const storeImported = async (dataset: CanonicalDataset) => {
    setImported(dataset);
    setDemo(false);
    setPersisted(await saveWorkspace({ kind: 'imported', dataset }));
  };

  const dataset = useMemo(() => (source ? withCostSettings(source.dataset, costSettings) : null), [source, costSettings]);
  const bounds = useMemo(() => (dataset ? datasetDateBounds(dataset) : null), [dataset]);

  const updateSettings = (next: CostSettings) => {
    setCostSettings(next);
    saveCostSettings(next);
  };

  const onOutcome = async (file: File, outcome: ImportOutcome): Promise<ImportLogEntry['outcome']> => {
    if (outcome.type === 'orders') {
      await storeImported(mergeIntoWorkspace(imported, outcome.result.dataset));
      return outcome;
    }
    if (outcome.type === 'cogs') {
      updateSettings({ ...costSettings, skuCogs: { ...(costSettings.skuCogs || {}), ...outcome.result.skuCogs } });
      return outcome;
    }
    if (outcome.type === 'shopee_summary') {
      try {
        // The classic parser handles Shopee's 21-sheet summary layout.
        const parsed = await parseShopeeExcelFile(file);
        await storeImported(mergeIntoWorkspace(imported, canonicalFromParsedStoreData(parsed, 'shopee')));
        return { type: 'legacy_summary', ok: true };
      } catch (e) {
        return { type: 'legacy_summary', ok: false, message: e instanceof Error ? e.message : String(e) };
      }
    }
    return outcome;
  };

  const clear = async () => {
    await clearWorkspace();
    setImported(null);
    setDemo(false);
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
      return <DataView lang={lang} dataset={dataset} sourceKind={source?.kind ?? null} onOutcome={onOutcome} onLoadDemo={loadDemo} onClear={clear} persisted={persisted} />;
    }
    if (view === 'settings') {
      return (
        <SettingsView
          lang={lang}
          dataset={dataset}
          settings={costSettings}
          onChange={updateSettings}
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
    const ctx = { lang, dataset, asOf: bounds.end, preset, range, compareMode, previousRange, platforms, openEvidence: setEvidence, goTo: setView };
    analytics = (
      <SellerProvider value={ctx}>
        <div className="space-y-4">
          {source?.kind === 'demo' && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-sky-200 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-3 py-2">
              <span>{vi ? 'Bạn đang xem dữ liệu demo của một shop mẫu (01/07–30/09/2025).' : 'You are viewing demo data of a sample shop (01/07–30/09/2025).'}</span>
              <button onClick={() => setDemo(false)} className="font-bold underline underline-offset-2 hover:text-white">
                {imported ? (vi ? 'Quay lại dữ liệu của tôi' : 'Back to my data') : vi ? 'Thoát demo' : 'Exit demo'}
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
