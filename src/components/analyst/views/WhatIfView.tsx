import React, { useMemo, useState } from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';
import {
  fmtByUnit,
  fmtCount,
  fmtMoneyCompact,
  fmtMultiple,
  fmtRate,
  formatRangeVi,
  NO_CHANGE,
  NO_SUMMARY_CHANGE,
  summaryWhatIf,
  whatIf,
  type Span,
  type SummaryWhatIfLevers,
  type WhatIfLevers,
} from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { GhostButton, NotEnoughData, Section, tr } from '../../seller/ui';
import { SectionCard } from '../../ui/primitives';
import { TABLE } from '../../ui/data';
import { Th } from '../ui';
import { inputCls } from './ChangeImpactView';

const LEVERS: { key: keyof WhatIfLevers; vi: string; en: string; min: number; max: number; step: number; pp?: boolean; hintVi: string }[] = [
  { key: 'price', vi: 'Giá bán', en: 'Price', min: -30, max: 30, step: 1, hintVi: 'Thay đổi giá bán trung bình' },
  { key: 'volume', vi: 'Số đơn (giả định của bạn)', en: 'Volume (your assumption)', min: -50, max: 100, step: 1, hintVi: 'Không tự suy ra từ giá — bạn tự nhập' },
  { key: 'discountPp', vi: 'Voucher/giảm giá shop', en: 'Seller discount', min: -10, max: 15, step: 0.5, pp: true, hintVi: 'Điểm % trên GMV' },
  { key: 'cogs', vi: 'Giá vốn / sản phẩm', en: 'COGS per unit', min: -30, max: 30, step: 1, hintVi: 'Giá nhập thay đổi' },
  { key: 'ads', vi: 'Ngân sách Ads', en: 'Ad spend', min: -100, max: 100, step: 5, hintVi: 'Thay đổi chi phí Ads' },
  { key: 'platformFeePp', vi: 'Phí sàn', en: 'Platform fee', min: -5, max: 5, step: 0.5, pp: true, hintVi: 'Điểm % trên doanh thu thuần' },
];

/** Levers a summary report can move (10.2); the others need an order file / COGS. */
const SUMMARY_LEVERS: (keyof WhatIfLevers)[] = ['price', 'volume', 'ads'];

export const WhatIfView: React.FC = () => {
  const { dataset } = useWorkspace();
  // No order file: simulate on the summary report, no COGS needed (10.2–10.4).
  if (dataset.orders.length === 0 && dataset.dailyMetrics.length > 0) return <SummaryWhatIfView />;
  return <OrderWhatIfView />;
};

const SummaryWhatIfView: React.FC = () => {
  const { lang, dataset, baseFilter, range, goTo } = useWorkspace();
  const vi = lang === 'vi';
  const [lv, setLv] = useState<SummaryWhatIfLevers>(NO_SUMMARY_CHANGE);
  const r = useMemo(() => summaryWhatIf(dataset, baseFilter, lv), [dataset, baseFilter, lv]);
  const changed = (Object.keys(lv) as (keyof SummaryWhatIfLevers)[]).some((k) => lv[k] !== 0);
  const span = (s: Span | null, fmt: (x: number) => string) => (s === null ? '—' : Math.abs(s[1] - s[0]) < 0.5 ? fmt(s[0]) : `${fmt(s[0])} – ${fmt(s[1])}`);
  const money = (x: number) => fmtMoneyCompact(x, lang);
  const signedMoney = (x: number) => `${x >= 0 ? '+' : '−'}${fmtMoneyCompact(Math.abs(x), lang)}`;
  const cancelNow = r.base.cancelValueRate;

  const sliders: { key: keyof SummaryWhatIfLevers | keyof WhatIfLevers; vi: string; en: string; min: number; max: number; step: number; hint: string; enabled: boolean; value: number; show: string }[] = [
    ...LEVERS.map((l) => {
      const enabled = SUMMARY_LEVERS.includes(l.key) && (l.key !== 'ads' || r.base.adSpend !== null);
      const v = enabled ? (lv[l.key as keyof SummaryWhatIfLevers] ?? 0) * 100 : 0;
      return {
        key: l.key,
        vi: l.vi,
        en: l.en,
        min: l.min,
        max: l.max,
        step: l.step,
        hint: enabled ? l.hintVi : l.key === 'ads' ? 'Chưa có số liệu Ads trong khoảng này' : 'Báo cáo tổng hợp không có số này — cần file đơn hàng và giá vốn',
        enabled,
        value: v,
        show: `${v > 0 ? '+' : ''}${v.toFixed(l.step < 1 ? 1 : 0).replace('.', vi ? ',' : '.')}${l.pp ? 'pp' : '%'}`,
      };
    }),
    {
      key: 'cancelPp',
      vi: 'Tỷ lệ hủy (theo giá trị)',
      en: 'Cancel rate (by value)',
      min: -20,
      max: 10,
      step: 0.5,
      hint: cancelNow === null ? 'Không có doanh số hủy' : `Mốc hiện tại ${fmtRate(cancelNow, lang)} theo giá trị`,
      enabled: cancelNow !== null,
      value: lv.cancelPp * 100,
      show: cancelNow === null ? '—' : `${fmtRate(cancelNow, lang)} → ${fmtRate(Math.max(0, cancelNow + lv.cancelPp), lang)}`,
    },
  ];

  return (
    <div className="space-y-4">
      <Section
        title={vi ? 'What-If · Mô phỏng / Ước tính' : 'What-If · Simulation / Estimate'}
        subtitle={
          vi
            ? `Dựa trên báo cáo tổng hợp ${formatRangeVi(range)} (đơn đặt), không cần giá vốn — mô phỏng, không phải dự báo.`
            : `Built on the summary report of ${formatRangeVi(range)} (placed orders) — a simulation, not a forecast.`
        }
        right={
          <label className="flex items-center gap-2 text-sm text-muted" title={vi ? 'Mô phỏng theo sản phẩm cần file đơn hàng' : 'Per-product needs an order file'}>
            {vi ? 'Phạm vi' : 'Scope'}
            <select aria-label={vi ? 'Phạm vi' : 'Scope'} value="" disabled className={inputCls}>
              <option value="">{vi ? 'Toàn shop' : 'Whole shop'}</option>
            </select>
          </label>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {sliders.map((l) => (
            <label key={l.key} className={`block rounded-control border border-line bg-surface-2 p-3 ${l.enabled ? '' : 'opacity-50'}`} title={l.enabled ? undefined : l.hint}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-fg">{vi ? l.vi : l.en}</span>
                <span className={`font-semibold tabular ${l.value === 0 ? 'text-muted' : 'text-primary'}`}>{l.enabled ? l.show : '—'}</span>
              </div>
              <input
                type="range"
                min={l.min}
                max={l.max}
                step={l.step}
                value={l.value}
                disabled={!l.enabled}
                onChange={(e) => setLv({ ...lv, [l.key]: Number(e.target.value) / 100 })}
                className="mt-2 w-full accent-primary disabled:cursor-not-allowed"
                aria-label={vi ? l.vi : l.en}
              />
              <div className="text-small text-muted">{l.hint}</div>
            </label>
          ))}
        </div>
        <div className="mt-3">
          <GhostButton onClick={() => setLv(NO_SUMMARY_CHANGE)} disabled={!changed}>
            <RotateCcw className="w-4 h-4" aria-hidden /> {vi ? 'Đặt lại' : 'Reset'}
          </GhostButton>
        </div>
      </Section>

      {!r.available ? (
        <NotEnoughData lang={lang} reason={tr(lang, r.unavailable!)} />
      ) : (
        <SectionCard
          title={vi ? `Kết quả mô phỏng · Mức ${r.level}` : `Simulated result · Level ${r.level}`}
          description={r.level === 1 ? (vi ? 'Doanh số, đơn, Ads, ROAS — không cần giá vốn' : 'Sales, orders, Ads, ROAS') : vi ? 'Thêm lợi nhuận ước tính theo số bạn nhập' : 'Plus an estimated profit'}
          notesLabel={vi ? 'Ghi chú' : 'Notes'}
          notes={r.notes.map((n) => tr(lang, n))}
        >
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { l: vi ? 'Doanh số (đặt)' : 'Sales (placed)', a: money(r.base.gmv), b: span(r.scenario.gmv, money) },
              { l: vi ? 'Số đơn' : 'Orders', a: fmtCount(r.base.orders, lang), b: span(r.scenario.orders, (x) => fmtCount(Math.round(x), lang)) },
              { l: vi ? 'Chi phí Ads' : 'Ad spend', a: fmtMoneyCompact(r.base.adSpend, lang), b: fmtMoneyCompact(r.scenario.adSpend, lang) },
              { l: vi ? 'ROAS (thanh toán – đặt, mức trần)' : 'ROAS (paid – placed, ceiling)', a: fmtMultiple(r.base.roas, lang), b: span(r.scenario.roas, (x) => fmtMultiple(x, lang)) },
              { l: vi ? 'Doanh số giữ lại' : 'Sales kept', a: fmtMoneyCompact(r.base.keptSales, lang), b: span(r.scenario.keptSales, money) },
              ...(r.level === 2 ? [{ l: vi ? 'Lợi nhuận (ước tính theo số bạn nhập)' : 'Profit (estimate)', a: fmtMoneyCompact(r.base.profit, lang), b: span(r.scenario.profit, money) }] : []),
            ].map((x) => (
              <div key={x.l} className="min-w-0 rounded-control border border-line bg-surface-2 p-3">
                <div className="flex items-center gap-1 text-small text-muted">
                  <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden /> {x.l}
                </div>
                <div className="mt-0.5 text-small tabular text-muted">{x.a} →</div>
                <div className={`text-lg font-bold tabular ${changed ? 'text-primary' : 'text-fg'}`}>{x.b}</div>
              </div>
            ))}
          </div>
          {r.adsEffect && (
            <p className="mt-4 text-sm text-fg">
              {vi
                ? `Ads ${signedMoney(r.adsEffect.spend)} → doanh số ${signedMoney(r.adsEffect.sales[0])} đến ${signedMoney(r.adsEffect.sales[1])} (mức trần).`
                : `Ads ${signedMoney(r.adsEffect.spend)} → sales ${signedMoney(r.adsEffect.sales[0])} to ${signedMoney(r.adsEffect.sales[1])} (ceiling).`}
            </p>
          )}
          {r.cancelEffect !== null && (
            <p className="mt-1 text-sm text-fg">
              {vi ? `Đổi tỷ lệ hủy: ${r.cancelEffect >= 0 ? 'giữ thêm' : 'mất thêm'} khoảng ${fmtMoneyCompact(Math.abs(r.cancelEffect), lang)} doanh số.` : `Cancel-rate change: ${signedMoney(r.cancelEffect)} sales kept.`}
            </p>
          )}
          {r.level === 1 && (
            <p className="mt-3 flex flex-wrap items-center gap-1 text-small text-muted">
              {vi ? 'Muốn xem lợi nhuận ước tính: nhập Biên lợi nhuận gộp và Phí sàn ở' : 'For an estimated profit, enter a margin and fees in'}
              <button type="button" onClick={() => goTo('settings')} className="inline-flex min-h-10 items-center font-semibold text-primary hover:underline">
                {vi ? 'Cài đặt' : 'Settings'}
              </button>
            </p>
          )}
        </SectionCard>
      )}
    </div>
  );
};

const OrderWhatIfView: React.FC = () => {
  const { lang, dataset, baseFilter, range } = useWorkspace();
  const vi = lang === 'vi';
  const [sku, setSku] = useState('');
  const [lv, setLv] = useState<WhatIfLevers>(NO_CHANGE);
  const filter = useMemo(() => ({ ...baseFilter, skus: sku ? [sku] : baseFilter.skus }), [baseFilter, sku]);
  const r = useMemo(() => whatIf(dataset, filter, lv), [dataset, filter, lv]);
  const changed = (Object.keys(lv) as (keyof WhatIfLevers)[]).some((k) => lv[k] !== 0);

  const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : b - a);
  const tone = (d: number | null) => (d === null || Math.abs(d) < 1 ? 'text-muted' : d > 0 ? 'text-up' : 'text-down');

  return (
    <div className="space-y-4">
      <Section
        title={vi ? 'What-If · Mô phỏng / Ước tính' : 'What-If · Simulation / Estimate'}
        subtitle={vi ? `Dựa trên chi phí thực tế ${formatRangeVi(range)} — kết quả là mô phỏng, không phải dự báo.` : `Built on actual costs of ${formatRangeVi(range)} — a simulation, not a forecast.`}
        right={
          <label className="flex items-center gap-2 text-sm text-muted">
            {vi ? 'Phạm vi' : 'Scope'}
            <select aria-label={vi ? 'Phạm vi' : 'Scope'} value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls}>
              <option value="">{vi ? 'Toàn shop (theo bộ lọc)' : 'Whole shop (filtered)'}</option>
              {dataset.products.map((p) => (
                <option key={p.sku} value={p.sku}>{p.name}</option>
              ))}
            </select>
          </label>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {LEVERS.map((l) => {
            const v = lv[l.key] * 100;
            return (
              <label key={l.key} className="block rounded-control border border-line bg-surface-2 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-fg">{vi ? l.vi : l.en}</span>
                  <span className={`font-semibold tabular ${v === 0 ? 'text-muted' : 'text-primary'}`}>
                    {v > 0 ? '+' : ''}
                    {v.toFixed(l.step < 1 ? 1 : 0).replace('.', vi ? ',' : '.')}
                    {l.pp ? 'pp' : '%'}
                  </span>
                </div>
                <input type="range" min={l.min} max={l.max} step={l.step} value={v} onChange={(e) => setLv({ ...lv, [l.key]: Number(e.target.value) / 100 })} className="mt-2 w-full accent-primary" aria-label={vi ? l.vi : l.en} />
                <div className="text-small text-muted">{l.hintVi}</div>
              </label>
            );
          })}
        </div>
        <div className="mt-3">
          <GhostButton onClick={() => setLv(NO_CHANGE)} disabled={!changed}>
            <RotateCcw className="w-4 h-4" aria-hidden /> {vi ? 'Đặt lại' : 'Reset'}
          </GhostButton>
        </div>
      </Section>

      {!r.available ? (
        <NotEnoughData lang={lang} reason={tr(lang, r.unavailable!)} />
      ) : (
        <SectionCard title={vi ? 'Kết quả mô phỏng' : 'Simulated result'} description={vi ? 'Thực tế → Mô phỏng' : 'Actual → Simulated'} notesLabel={vi ? 'Ghi chú' : 'Notes'} notes={r.notes.map((n) => tr(lang, n))}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { l: 'GMV', a: r.base.gmv, b: r.scenario.gmv, f: (x: number | null) => fmtMoneyCompact(x, lang) },
              { l: vi ? 'Lợi nhuận' : 'Profit', a: r.base.profit, b: r.scenario.profit, f: (x: number | null) => fmtMoneyCompact(x, lang) },
              { l: 'Margin', a: r.base.margin, b: r.scenario.margin, f: (x: number | null) => fmtRate(x, lang) },
              { l: vi ? 'ROAS hòa vốn' : 'Break-even ROAS', a: r.base.breakEvenRoas, b: r.scenario.breakEvenRoas, f: (x: number | null) => fmtMultiple(x, lang), inverse: true },
            ].map((x) => {
              const d = delta(x.a, x.b);
              return (
                <div key={x.l} className="min-w-0 rounded-control border border-line bg-surface-2 p-3">
                  <div className="flex items-center gap-1 text-small text-muted">
                    <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden /> {x.l}
                  </div>
                  <div className="mt-0.5 text-small tabular text-muted">{x.f(x.a)} →</div>
                  <div className={`text-xl font-bold tabular ${changed ? (x.inverse ? tone(d === null ? null : -d) : tone(d)) : 'text-fg'}`}>{x.f(x.b)}</div>
                </div>
              );
            })}
          </div>
          {changed && r.volumeToKeepProfit !== null && r.volumeToKeepProfit > -1 && (r.base.profit ?? 0) > 0 && lv.volume === 0 && (
            <p className="mt-4 text-sm text-fg">
              {vi
                ? r.volumeToKeepProfit >= 0
                  ? `Với các thay đổi trên, số đơn cần tăng ${fmtRate(r.volumeToKeepProfit, lang)} để giữ nguyên lợi nhuận hiện tại.`
                  : `Với các thay đổi trên, số đơn có thể giảm tới ${fmtRate(-r.volumeToKeepProfit, lang)} mà lợi nhuận vẫn bằng hiện tại.`
                : `Volume would need to change ${fmtRate(r.volumeToKeepProfit, lang)} to keep today's profit.`}
            </p>
          )}
          <div className={`mt-4 ${TABLE.frame}`}>
            <table className={TABLE.table}>
              <thead className={TABLE.thead}>
                <tr>
                  <Th left>{vi ? 'Dòng' : 'Line'}</Th>
                  <Th>{vi ? 'Thực tế' : 'Actual'}</Th>
                  <Th>{vi ? 'Mô phỏng' : 'Simulated'}</Th>
                  <Th>{vi ? 'Chênh lệch' : 'Difference'}</Th>
                </tr>
              </thead>
              <tbody>
                {r.lines.map((l) => {
                  const d = delta(l.base, l.scenario);
                  const isCost = !['gmv', 'netRevenue', 'profit'].includes(l.key);
                  return (
                    <tr key={l.key} className={`${TABLE.tr} text-fg ${l.key === 'profit' || l.key === 'netRevenue' ? 'bg-surface-2 font-semibold' : ''}`}>
                      <td className={TABLE.td}>{tr(lang, l.label)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtByUnit(l.base, 'vnd', lang, false)}</td>
                      <td className={`${TABLE.td} text-right`}>{fmtByUnit(l.scenario, 'vnd', lang, false)}</td>
                      <td className={`${TABLE.td} text-right font-medium ${tone(d === null ? null : isCost ? -d : d)}`}>{d === null ? '—' : `${d > 0 ? '+' : ''}${fmtByUnit(d, 'vnd', lang, false)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
};
