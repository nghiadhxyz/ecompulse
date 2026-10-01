/**
 * Chart styling from the design tokens (src/styles/tokens.css). SVG accepts CSS variables in
 * fill / stroke, so light and dark switch without touching the charts.
 */
import type { SummaryChannel } from '../analytics';

const v = (name: string) => `var(--${name})`;

/** Channel colours — fixed across every chart and table. `fill` for areas and bars read at a
 * glance; `line` for thin lines, dots, outlines, and for stacked / legend-read charts. */
export const CHANNEL_COLOR: Record<SummaryChannel | 'ads', { fill: string; line: string }> = {
  product_card: { fill: v('ch-product-card'), line: v('ch-product-card-line') },
  affiliate: { fill: v('ch-affiliate'), line: v('ch-affiliate-line') },
  video: { fill: v('ch-video'), line: v('ch-video-line') },
  live: { fill: v('ch-live'), line: v('ch-live-line') },
  ads: { fill: 'none', line: v('ch-ads') },
} as Record<SummaryChannel | 'ads', { fill: string; line: string }>;

/** Multi-series palette, in order. */
export const SERIES = [v('chart-1'), v('chart-2'), v('chart-3'), v('chart-4'), v('chart-5'), v('chart-6')];

export const CHART = {
  primary: v('chart-1'),
  grid: v('chart-grid'),
  axis: v('chart-axis'),
  anomaly: v('chart-anomaly'),
  saleDay: v('chart-sale-day'),
  saleBand: v('chart-sale-band'),
  up: v('up'),
  down: v('down'),
  muted: v('text-muted'),
  /** The comparison period: same colour as the current one, dashed, 50%. */
  compareOpacity: 0.5,
  compareDash: '5 4',
};

/** Shared Recharts props: horizontal grid only, quiet axes, white tooltip, legend top-right. */
export const gridProps = { vertical: false, stroke: CHART.grid } as const;
export const axisProps = { tick: { fill: CHART.axis, fontSize: 11 }, tickLine: false, axisLine: false } as const;
export const xAxisProps = { ...axisProps, axisLine: { stroke: CHART.grid }, minTickGap: 16 } as const;
export const tooltipProps = {
  contentStyle: {
    background: v('chart-tooltip-bg'),
    border: `1px solid ${v('border')}`,
    borderRadius: 10,
    boxShadow: '0 4px 12px rgba(15,23,42,.08)',
    fontSize: 12,
    color: v('text'),
  },
  labelStyle: { color: v('text'), fontWeight: 600 },
  itemStyle: { color: v('text') },
  cursor: { stroke: CHART.grid },
} as const;
export const legendProps = { verticalAlign: 'top', align: 'right', iconSize: 10, wrapperStyle: { fontSize: 12, color: v('text-muted'), paddingBottom: 8 } } as const;
