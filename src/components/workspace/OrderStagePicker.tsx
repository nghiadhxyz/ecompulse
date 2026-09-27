/**
 * App-wide order stage picker (summary reports only): placed orders by default, paid orders
 * ("tiền về") on request. See analytics/orderStage.ts for the rule.
 */
import React from 'react';
import { PLACED_ONLY_NOTE, STAGE_BASIS, type Lang, type SummaryStage } from '../../analytics';
import { Tabs } from '../ui/primitives';

const OPTIONS: SummaryStage[] = ['placed', 'paid'];

export const OrderStagePicker: React.FC<{ stage: SummaryStage; onChange: (s: SummaryStage) => void; lang: Lang; compact?: boolean }> = ({ stage, onChange, lang, compact }) => {
  const vi = lang === 'vi';
  return (
    <div className="flex items-center gap-1" title={vi ? 'Đơn đặt: tính theo ngày khách đặt. Đơn đã thanh toán: tính theo ngày tiền về.' : 'Placed: by order day. Paid: by payment day.'}>
      <span className="text-small text-muted">{vi ? 'Mức đơn' : 'Orders'}</span>
      <Tabs
        label={vi ? 'Mức đơn' : 'Order stage'}
        value={stage}
        onChange={onChange}
        size={compact ? 'sm' : 'md'}
        options={OPTIONS.map((s) => ({ key: s, label: s === 'placed' ? (vi ? 'Đặt' : 'Placed') : vi ? 'Thanh toán' : 'Paid' }))}
      />
    </div>
  );
};

/** Shown on pages that ignore the picker and always count placed orders. */
export const PlacedOnlyNote: React.FC<{ lang: Lang; show: boolean }> = ({ lang, show }) =>
  show ? (
    <p className="inline-flex rounded-control bg-info-soft px-2.5 py-1 text-small text-info">
      {STAGE_BASIS.placed[lang]} · {PLACED_ONLY_NOTE[lang]}
    </p>
  ) : null;
