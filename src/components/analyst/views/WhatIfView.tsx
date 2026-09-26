import React, { useMemo, useState } from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { fmtByUnit, fmtMoneyCompact, fmtMultiple, fmtRate, formatRangeVi, NO_CHANGE, whatIf, type WhatIfLevers } from '../../../analytics';
import { useWorkspace } from '../../seller/SellerContext';
import { GhostButton, NotEnoughData, Section, tr } from '../../seller/ui';
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

export const WhatIfView: React.FC = () => {
  const { lang, dataset, baseFilter, range } = useWorkspace();
  const vi = lang === 'vi';
  const [sku, setSku] = useState('');
  const [lv, setLv] = useState<WhatIfLevers>(NO_CHANGE);
  const filter = useMemo(() => ({ ...baseFilter, skus: sku ? [sku] : baseFilter.skus }), [baseFilter, sku]);
  const r = useMemo(() => whatIf(dataset, filter, lv), [dataset, filter, lv]);
  const changed = (Object.keys(lv) as (keyof WhatIfLevers)[]).some((k) => lv[k] !== 0);

  const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : b - a);
  const tone = (d: number | null) => (d === null || Math.abs(d) < 1 ? 'text-slate-400' : d > 0 ? 'text-[#4ade80]' : 'text-[#f87171]');

  return (
    <div className="space-y-4">
      <Section
        title={vi ? 'What-If · Mô phỏng / Ước tính' : 'What-If · Simulation / Estimate'}
        subtitle={vi ? `Dựa trên chi phí thực tế ${formatRangeVi(range)} — kết quả là mô phỏng, không phải dự báo.` : `Built on actual costs of ${formatRangeVi(range)} — a simulation, not a forecast.`}
        right={
          <label className="text-xs text-slate-300 flex items-center gap-1.5">
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
              <label key={l.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 block">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{vi ? l.vi : l.en}</span>
                  <span className={`font-bold ${v === 0 ? 'text-slate-400' : 'text-sky-300'}`}>
                    {v > 0 ? '+' : ''}
                    {v.toFixed(l.step < 1 ? 1 : 0).replace('.', vi ? ',' : '.')}
                    {l.pp ? 'pp' : '%'}
                  </span>
                </div>
                <input type="range" min={l.min} max={l.max} step={l.step} value={v} onChange={(e) => setLv({ ...lv, [l.key]: Number(e.target.value) / 100 })} className="w-full mt-2 accent-sky-500" aria-label={vi ? l.vi : l.en} />
                <div className="text-[10px] text-slate-500">{l.hintVi}</div>
              </label>
            );
          })}
        </div>
        <div className="mt-2">
          <GhostButton onClick={() => setLv(NO_CHANGE)} disabled={!changed}>
            <RotateCcw className="w-4 h-4" aria-hidden /> {vi ? 'Đặt lại' : 'Reset'}
          </GhostButton>
        </div>
      </Section>

      {!r.available ? (
        <NotEnoughData lang={lang} reason={tr(lang, r.unavailable!)} />
      ) : (
        <Section title={vi ? 'Kết quả mô phỏng' : 'Simulated result'} subtitle={vi ? 'Thực tế → Mô phỏng' : 'Actual → Simulated'}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {[
              { l: 'GMV', a: r.base.gmv, b: r.scenario.gmv, f: (x: number | null) => fmtMoneyCompact(x, lang) },
              { l: vi ? 'Lợi nhuận' : 'Profit', a: r.base.profit, b: r.scenario.profit, f: (x: number | null) => fmtMoneyCompact(x, lang) },
              { l: 'Margin', a: r.base.margin, b: r.scenario.margin, f: (x: number | null) => fmtRate(x, lang) },
              { l: vi ? 'ROAS hòa vốn' : 'Break-even ROAS', a: r.base.breakEvenRoas, b: r.scenario.breakEvenRoas, f: (x: number | null) => fmtMultiple(x, lang), inverse: true },
            ].map((x) => {
              const d = delta(x.a, x.b);
              return (
                <div key={x.l} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1"><FlaskConical className="w-3 h-3" aria-hidden /> {x.l}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{x.f(x.a)} →</div>
                  <div className={`text-lg font-black ${changed ? (x.inverse ? tone(d === null ? null : -d) : tone(d)) : 'text-white'}`}>{x.f(x.b)}</div>
                </div>
              );
            })}
          </div>
          {changed && r.volumeToKeepProfit !== null && r.volumeToKeepProfit > -1 && (r.base.profit ?? 0) > 0 && lv.volume === 0 && (
            <p className="text-sm text-slate-200 mt-3">
              {vi
                ? r.volumeToKeepProfit >= 0
                  ? `Với các thay đổi trên, số đơn cần tăng ${fmtRate(r.volumeToKeepProfit, lang)} để giữ nguyên lợi nhuận hiện tại.`
                  : `Với các thay đổi trên, số đơn có thể giảm tới ${fmtRate(-r.volumeToKeepProfit, lang)} mà lợi nhuận vẫn bằng hiện tại.`
                : `Volume would need to change ${fmtRate(r.volumeToKeepProfit, lang)} to keep today's profit.`}
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-white/10 mt-3">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.04] text-slate-400">
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
                    <tr key={l.key} className={`border-t border-white/5 ${l.key === 'profit' || l.key === 'netRevenue' ? 'font-bold text-white' : 'text-slate-200'}`}>
                      <td className="px-2.5 py-1.5">{tr(lang, l.label)}</td>
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtByUnit(l.base, 'vnd', lang, false)}</td>
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap">{fmtByUnit(l.scenario, 'vnd', lang, false)}</td>
                      <td className={`px-2.5 py-1.5 text-right whitespace-nowrap ${tone(d === null ? null : isCost ? -d : d)}`}>{d === null ? '—' : `${d > 0 ? '+' : ''}${fmtByUnit(d, 'vnd', lang, false)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 space-y-1">
            {r.notes.map((n, i) => (
              <li key={i} className="text-xs text-slate-400">• {tr(lang, n)}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
};
