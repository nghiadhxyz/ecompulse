import React, { useState } from 'react';
import {
  TrendingDown,
  Info,
  ChevronDown,
  BarChart2,
  Filter,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  LabelList,
} from 'recharts';
import { formatVND, formatCompactVND, formatNumber } from '../../utils/formatters';

interface ConversionFunnelChartProps {
  placedRevenue: number;
  confirmedRevenue: number;
  paidRevenue: number;
  placedOrders?: number;
  confirmedOrders?: number;
  paidOrders?: number;
  onNavigateToAiTab?: () => void;
  language?: 'vi' | 'en';
}

export const ConversionFunnelChart: React.FC<ConversionFunnelChartProps> = ({
  placedRevenue,
  confirmedRevenue,
  paidRevenue,
  placedOrders = 0,
  confirmedOrders = 0,
  paidOrders = 0,
  onNavigateToAiTab,
  language = 'vi',
}) => {
  const [viewMode, setViewMode] = useState<'funnel' | 'bar'>('funnel');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Calculations
  const drop1Percent = placedRevenue > 0 ? ((placedRevenue - confirmedRevenue) / placedRevenue) * 100 : 0;
  const drop1Amount = Math.max(0, placedRevenue - confirmedRevenue);
  const drop2Percent = confirmedRevenue > 0 ? ((confirmedRevenue - paidRevenue) / confirmedRevenue) * 100 : 0;
  const drop2Amount = Math.max(0, confirmedRevenue - paidRevenue);
  const totalLeakage = Math.max(0, placedRevenue - paidRevenue);
  const totalRetentionRate = placedRevenue > 0 ? ((paidRevenue / placedRevenue) * 100).toFixed(1) : '0.0';
  const confirmedRate = placedRevenue > 0 ? ((confirmedRevenue / placedRevenue) * 100).toFixed(1) : '0.0';

  // Stages data
  const stages = [
    {
      id: 0,
      name: '1. Đã đặt (Placed)',
      shortName: '1. Đã đặt',
      revenue: placedRevenue,
      orders: placedOrders,
      conversion: 100,
      dropRate: 0,
      dropAmount: 0,
      color: '#38bdf8', // Sky 400
      gradientFrom: '#38bdf8',
      gradientTo: '#0284c7',
      glowColor: 'rgba(56, 189, 248, 0.4)',
      bgSoft: 'bg-sky-500/10 border-sky-400/30 text-sky-300',
      description: 'Tổng đơn khách đặt thành công trên sàn (chưa trừ hủy & hoàn).',
    },
    {
      id: 1,
      name: '2. Đã xác nhận (Confirmed)',
      shortName: '2. Xác nhận',
      revenue: confirmedRevenue,
      orders: confirmedOrders,
      conversion: parseFloat(confirmedRate),
      dropRate: drop1Percent,
      dropAmount: drop1Amount,
      color: '#818cf8', // Indigo 400
      gradientFrom: '#818cf8',
      gradientTo: '#6366f1',
      glowColor: 'rgba(129, 140, 248, 0.4)',
      bgSoft: 'bg-indigo-500/10 border-indigo-400/30 text-indigo-300',
      description: 'Đơn Shop đã đóng gói và bàn giao cho ĐVVC.',
    },
    {
      id: 2,
      name: '3. Đã thanh toán (Paid Net)',
      shortName: '3. Thanh toán',
      revenue: paidRevenue,
      orders: paidOrders,
      conversion: parseFloat(totalRetentionRate),
      dropRate: drop2Percent,
      dropAmount: drop2Amount,
      color: '#34d399', // Emerald 400
      gradientFrom: '#34d399',
      gradientTo: '#059669',
      glowColor: 'rgba(52, 211, 153, 0.4)',
      bgSoft: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300',
      description: 'Tiền thực tế đã về ví sau khi giao thành công (loại trừ Boom COD & trả hàng).',
    },
  ];

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/[0.12] shadow-xl flex flex-col justify-between h-[280px] relative overflow-hidden group">
      {/* Background subtle neon glow */}
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Drop-off pill + View Toggle */}
      <div className="flex items-center justify-between gap-2 mb-1 z-10">
        <div>
          <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
            Phễu Chuyển Đổi Đơn Hàng
          </h4>
          <p className="text-[11px] text-slate-400">3 bước: Đặt → Xác nhận → Thanh toán</p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Drop-off pill */}
          <span
            className="text-[10px] font-bold text-rose-300 bg-rose-500/20 border border-rose-400/30 px-2 py-0.5 rounded-full cursor-help"
            title={`Rơi rụng từ Đặt sang Xác nhận: -${drop1Percent.toFixed(1)}% (${formatCompactVND(drop1Amount)})`}
          >
            -{drop1Percent.toFixed(1)}% drop
          </span>

          {/* Toggle Funnel/Bar View */}
          <button
            onClick={() => setViewMode(viewMode === 'funnel' ? 'bar' : 'funnel')}
            className="p-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/10 transition-all text-xs flex items-center gap-1"
            title={viewMode === 'funnel' ? 'Chuyển sang biểu đồ cột' : 'Chuyển sang biểu đồ phễu'}
          >
            {viewMode === 'funnel' ? (
              <BarChart2 className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <Filter className="w-3.5 h-3.5 text-sky-400" />
            )}
          </button>
        </div>
      </div>

      {/* CHART CONTAINER */}
      <div className="w-full flex-1 relative min-h-[190px] flex items-center justify-center">
        {viewMode === 'funnel' ? (
          /* =========================================================================
             GENUINE SVG TRAPEZOID FUNNEL CHART WITH GRADIENTS & GLOWING LAYERS
             ========================================================================= */
          <div className="w-full h-full flex flex-col justify-between py-1 relative">
            <svg
              viewBox="0 0 340 176"
              className="w-full h-full overflow-visible"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}
            >
              <defs>
                {/* Stage 1 Gradient */}
                <linearGradient id="funnelSky" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.95" />
                </linearGradient>
                {/* Stage 2 Gradient */}
                <linearGradient id="funnelIndigo" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.95" />
                </linearGradient>
                {/* Stage 3 Gradient */}
                <linearGradient id="funnelEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.95" />
                </linearGradient>

                {/* Glow Filter */}
                <filter id="funnelGlow" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* -------------------------------------------------------------------
                  STAGE 1: ĐÃ ĐẶT (Top Trapezoid)
                  Coordinates: Top width 320 (10 -> 330), Bottom width 252 (44 -> 296), Y: 4 -> 50
                  ------------------------------------------------------------------- */}
              <g
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredIndex(0)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <polygon
                  points="10,4 330,4 296,50 44,50"
                  fill="url(#funnelSky)"
                  stroke={hoveredIndex === 0 ? '#bae6fd' : 'rgba(255,255,255,0.25)'}
                  strokeWidth={hoveredIndex === 0 ? '2' : '1'}
                  className="transition-all duration-200"
                  style={{
                    filter: hoveredIndex === 0 ? 'url(#funnelGlow)' : 'none',
                    transform: hoveredIndex === 0 ? 'scale(1.01)' : 'none',
                    transformOrigin: '170px 27px',
                  }}
                />
                {/* Inner highlight line */}
                <line x1="16" y1="7" x2="324" y2="7" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                
                {/* Left: Step label */}
                <text x="56" y="24" fill="#ffffff" fontSize="10.5" fontWeight="700" letterSpacing="0.3">
                  1. ĐÃ ĐẶT
                </text>
                <text x="56" y="40" fill="#e0f2fe" fontSize="9.5" fontWeight="500">
                  {formatNumber(placedOrders)} đơn • 100%
                </text>

                {/* Right: Revenue Value */}
                <text x="282" y="32" fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="end">
                  {formatCompactVND(placedRevenue)}
                </text>
              </g>

              {/* Drop-off 1 Connector badge (Placed -> Confirmed) */}
              <g transform="translate(170, 56)">
                <rect
                  x="-42"
                  y="-7"
                  width="84"
                  height="14"
                  rx="7"
                  fill="#881337"
                  stroke="#fb7185"
                  strokeWidth="0.8"
                  opacity="0.9"
                />
                <text
                  x="0"
                  y="3.5"
                  fill="#fecdd3"
                  fontSize="8.5"
                  fontWeight="800"
                  textAnchor="middle"
                >
                  ▼ -{drop1Percent.toFixed(1)}% rơi rụng
                </text>
              </g>

              {/* -------------------------------------------------------------------
                  STAGE 2: XÁC NHẬN (Middle Trapezoid)
                  Coordinates: Top width 246 (47 -> 293), Bottom width 180 (80 -> 260), Y: 64 -> 110
                  ------------------------------------------------------------------- */}
              <g
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredIndex(1)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <polygon
                  points="47,64 293,64 260,110 80,110"
                  fill="url(#funnelIndigo)"
                  stroke={hoveredIndex === 1 ? '#c7d2fe' : 'rgba(255,255,255,0.25)'}
                  strokeWidth={hoveredIndex === 1 ? '2' : '1'}
                  className="transition-all duration-200"
                  style={{
                    filter: hoveredIndex === 1 ? 'url(#funnelGlow)' : 'none',
                    transform: hoveredIndex === 1 ? 'scale(1.01)' : 'none',
                    transformOrigin: '170px 87px',
                  }}
                />
                {/* Inner highlight line */}
                <line x1="52" y1="67" x2="288" y2="67" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />

                {/* Left: Step label */}
                <text x="88" y="84" fill="#ffffff" fontSize="10.5" fontWeight="700" letterSpacing="0.3">
                  2. XÁC NHẬN
                </text>
                <text x="88" y="100" fill="#e0e7ff" fontSize="9.5" fontWeight="500">
                  {formatNumber(confirmedOrders)} đơn • {confirmedRate}%
                </text>

                {/* Right: Revenue Value */}
                <text x="250" y="92" fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="end">
                  {formatCompactVND(confirmedRevenue)}
                </text>
              </g>

              {/* Drop-off 2 Connector badge (Confirmed -> Paid) */}
              <g transform="translate(170, 116)">
                <rect
                  x="-42"
                  y="-7"
                  width="84"
                  height="14"
                  rx="7"
                  fill="#701a75"
                  stroke="#e879f9"
                  strokeWidth="0.8"
                  opacity="0.9"
                />
                <text
                  x="0"
                  y="3.5"
                  fill="#f5d0fe"
                  fontSize="8.5"
                  fontWeight="800"
                  textAnchor="middle"
                >
                  ▼ -{drop2Percent.toFixed(1)}% hoàn/COD
                </text>
              </g>

              {/* -------------------------------------------------------------------
                  STAGE 3: THANH TOÁN (Bottom Trapezoid)
                  Coordinates: Top width 174 (83 -> 257), Bottom width 126 (107 -> 233), Y: 124 -> 170
                  ------------------------------------------------------------------- */}
              <g
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredIndex(2)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <polygon
                  points="83,124 257,124 233,170 107,170"
                  fill="url(#funnelEmerald)"
                  stroke={hoveredIndex === 2 ? '#a7f3d0' : 'rgba(255,255,255,0.25)'}
                  strokeWidth={hoveredIndex === 2 ? '2' : '1'}
                  className="transition-all duration-200"
                  style={{
                    filter: hoveredIndex === 2 ? 'url(#funnelGlow)' : 'none',
                    transform: hoveredIndex === 2 ? 'scale(1.01)' : 'none',
                    transformOrigin: '170px 147px',
                  }}
                />
                {/* Inner highlight line */}
                <line x1="88" y1="127" x2="252" y2="127" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />

                {/* Left/Center: Step label */}
                <text x="114" y="144" fill="#ffffff" fontSize="10.5" fontWeight="700" letterSpacing="0.3">
                  3. THANH TOÁN
                </text>
                <text x="114" y="160" fill="#d1fae5" fontSize="9.5" fontWeight="500">
                  {formatNumber(paidOrders)} đơn • {totalRetentionRate}%
                </text>

                {/* Right: Revenue Value */}
                <text x="224" y="152" fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="end">
                  {formatCompactVND(paidRevenue)}
                </text>
              </g>
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredIndex !== null && (
              <div className="absolute inset-x-2 bottom-1 bg-slate-900/95 border border-sky-400/40 rounded-xl p-2.5 shadow-2xl backdrop-blur-xl text-xs z-50 animate-in fade-in zoom-in-95 duration-150 flex items-center justify-between pointer-events-none">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: stages[hoveredIndex].color }}
                    />
                    <p className="font-bold text-white text-xs">{stages[hoveredIndex].name}</p>
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-1">{stages[hoveredIndex].description}</p>
                </div>
                <div className="text-right shrink-0 pl-3">
                  <p className="text-white font-extrabold text-xs">{formatVND(stages[hoveredIndex].revenue)}</p>
                  <p className="text-emerald-400 text-[10px] font-bold">
                    Giữ chân: {stages[hoveredIndex].conversion}%
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* =========================================================================
             FALLBACK / ALTERNATIVE RECHARTS BAR CHART
             ========================================================================= */
          <ResponsiveContainer width="100%" height={195}>
            <BarChart
              data={stages}
              margin={{ top: 18, right: 10, left: -25, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
              <XAxis
                dataKey="shortName"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#cbd5e1', fontSize: 10.5, fontWeight: 600 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(val) => `${(val / 1e6).toFixed(0)}M`}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-900/95 border border-white/20 rounded-xl p-2.5 shadow-2xl backdrop-blur-xl text-xs z-50">
                        <p className="font-bold text-white mb-1">{d.name}</p>
                        <p className="text-sky-300 font-bold">Doanh số: {formatVND(d.revenue)}</p>
                        <p className="text-slate-300">Số lượng: {formatNumber(d.orders)} đơn</p>
                        <p className="text-emerald-400 font-semibold mt-0.5">Tỷ lệ giữ: {d.conversion}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={48}>
                <LabelList
                  dataKey="revenue"
                  position="top"
                  fill="#f1f5f9"
                  fontSize={10}
                  fontWeight={700}
                  formatter={(val: any) => formatCompactVND(Number(val) || 0)}
                />
                {stages.map((entry, index) => (
                  <Cell key={`funnel-bar-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-white/[0.06] pt-1.5 mt-0.5">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-sky-400" />
          Giữ chân thực thu: <strong className="text-emerald-400">{totalRetentionRate}%</strong>
        </span>
        <span className="text-rose-300">
          Hao hụt rò rỉ: <strong>{formatCompactVND(totalLeakage)}</strong>
        </span>
      </div>
    </div>
  );
};
