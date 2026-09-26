/**
 * App-wide order stage picker (summary reports only): placed orders by default, paid orders
 * ("tiền về") on request. See analytics/orderStage.ts for the rule.
 */
import React from 'react';
import { PLACED_ONLY_NOTE, STAGE_BASIS, type Lang, type SummaryStage } from '../../analytics';

const OPTIONS: SummaryStage[] = ['placed', 'paid'];

export const OrderStagePicker: React.FC<{ stage: SummaryStage; onChange: (s: SummaryStage) => void; lang: Lang; compact?: boolean }> = ({ stage, onChange, lang, compact }) => {
  const vi = lang === 'vi';
  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="group"
      aria-label={vi ? 'Mức đơn' : 'Order stage'}
      title={vi ? 'Đơn đặt: tính theo ngày khách đặt. Đơn đã thanh toán: tính theo ngày tiền về.' : 'Placed: by order day. Paid: by payment day.'}
    >
      <span className={`${compact ? 'text-[11px]' : 'text-xs'} text-slate-500 mr-1`}>{vi ? 'Mức đơn' : 'Orders'}</span>
      {OPTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          aria-pressed={stage === s}
          className={`${compact ? 'px-2 py-0.5 rounded-md text-[11px]' : 'px-2.5 py-1 rounded-lg text-xs'} font-semibold border ${stage === s ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-slate-400 hover:text-white'}`}
        >
          {s === 'placed' ? (vi ? 'Đặt' : 'Placed') : vi ? 'Thanh toán' : 'Paid'}
        </button>
      ))}
    </div>
  );
};

/** Shown on pages that ignore the picker and always count placed orders. */
export const PlacedOnlyNote: React.FC<{ lang: Lang; show: boolean }> = ({ lang, show }) =>
  show ? (
    <p className="text-[11px] text-slate-400">
      {STAGE_BASIS.placed[lang]} · {PLACED_ONLY_NOTE[lang]}
    </p>
  ) : null;
