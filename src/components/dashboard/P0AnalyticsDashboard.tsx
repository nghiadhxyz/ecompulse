import React, { useState } from 'react';
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
import {
  TrendingDown,
  ArrowDownRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  ArrowUpDown,
  Flame,
} from 'lucide-react';
import { ParsedStoreData, ChannelMetric } from '../../types';
import { formatVND, formatCompactVND, formatNumber } from '../../utils/formatters';
import { RevenueLeakagePieCard } from './RevenueLeakagePieCard';
import { ConversionFunnelChart } from './ConversionFunnelChart';

interface P0AnalyticsDashboardProps {
  data: ParsedStoreData;
  onNavigateToAiTab?: () => void;
  language?: 'vi' | 'en';
}

export const P0AnalyticsDashboard: React.FC<P0AnalyticsDashboardProps> = ({
  data,
  onNavigateToAiTab,
  language,
}) => {
  const [channelSortBy, setChannelSortBy] = useState<
    'alphabetical' | 'alphabeticalDesc' | 'paidRevenue' | 'retentionRate' | 'retentionRateDesc' | 'leakageAmount' | 'placedRevenue' | 'aov'
  >('alphabetical');

  // 1. Funnel Calculations - Purely from data.kpis
  const placedRev = data.kpis?.placedRevenue || 0;
  const confirmedRev = data.kpis?.confirmedRevenue || 0;
  const paidRev = data.kpis?.paidRevenue || 0;

  const placedOrders = data.kpis?.placedOrders || 0;
  const confirmedOrders = data.kpis?.confirmedOrders || 0;
  const paidOrders = data.kpis?.paidOrders || 0;

  // 2. Traffic Channels Calculations (Dynamic directly from parsed store data)
  const activeChannels = data.channels || [];

  const allChannelsList: {
    name: string;
    shortName: string;
    placedRev: number;
    paidRev: number;
    retentionRate: number;
    color: string;
  }[] = activeChannels.map((c, idx) => {
    const lower = c.channelName.toLowerCase();
    let shortName = c.channelName;
    let color = '#38bdf8';
    if (lower.includes('đề xuất')) { shortName = 'Đề xuất'; color = '#38bdf8'; }
    else if (lower.includes('tiếp thị') || lower.includes('affiliate')) { shortName = 'Affiliate'; color = '#c084fc'; }
    else if (lower.includes('tìm kiếm')) { shortName = 'Tìm kiếm'; color = '#f43f5e'; }
    else if (lower.includes('khác')) { shortName = 'Khác'; color = '#94a3b8'; }
    else if (lower.includes('cửa hàng')) { shortName = 'Cửa hàng'; color = '#34d399'; }
    else if (lower.includes('video')) { shortName = 'Video'; color = '#fbbf24'; }
    else if (lower.includes('live')) { shortName = 'Live'; color = '#f472b6'; }
    else {
      const palette = ['#38bdf8', '#c084fc', '#f43f5e', '#94a3b8', '#34d399', '#fbbf24', '#f472b6'];
      color = palette[idx % palette.length];
    }

    const retention = c.retentionRate ?? (c.placedRevenue > 0 ? Math.round((c.paidRevenue / c.placedRevenue) * 100) : 0);

    return {
      name: c.channelName,
      shortName,
      placedRev: c.placedRevenue,
      paidRev: c.paidRevenue,
      retentionRate: retention,
      color,
    };
  });

  // Top 5 traffic channels for Column 2 sorted by placed revenue
  const top5TrafficChannels = [...allChannelsList].sort((a, b) => b.placedRev - a.placedRev).slice(0, 5);

  const totalChannelPlacedRev = activeChannels.reduce((sum, c) => sum + c.placedRevenue, 0);
  const cardOnlyRev = activeChannels
    .filter((c) => {
      const l = c.channelName.toLowerCase();
      return l.includes('thẻ') || l.includes('tìm kiếm') || l.includes('đề xuất') || l.includes('cửa hàng');
    })
    .reduce((sum, c) => sum + c.placedRevenue, 0);
  const cardSharePercent = totalChannelPlacedRev > 0
    ? ((cardOnlyRev / totalChannelPlacedRev) * 100).toFixed(1)
    : '0.0';

  // 3. Top 5 Hero Products calculations - Purely from file data
  const resolveProductName = (name: string, id?: string) => {
    if (/^\d{6,}$/.test(name) || !name) {
      const match = data.abcProducts?.find((p) => p.id === name || p.sku === name || p.id === id);
      if (match && match.name) return match.name;
    }
    return name || id || 'Sản phẩm';
  };

  const getProductShortName = (name: string, idx: number) => {
    const words = name.split(' ');
    return words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
  };

  const topProducts = (() => {
    if (data.productCardTopProducts && data.productCardTopProducts.length > 0) {
      const topItems = data.productCardTopProducts.slice(0, 5);
      const cardChannel = data.channels.find(
        (c) => c.channelName.toLowerCase().includes('thẻ') || c.channel.toLowerCase().includes('product')
      );
      const channelTotalRev = cardChannel?.placedRevenue || topItems.reduce((sum, p) => sum + p.revenue, 0) || 1;

      return topItems.map((p, idx) => {
        let rev = p.revenue;
        let share = p.revenueShare;

        if (share <= 0 && channelTotalRev > 0) {
          share = parseFloat(((rev / channelTotalRev) * 100).toFixed(2));
        }

        const fullName = resolveProductName(p.name, p.id);
        return {
          name: fullName,
          shortName: getProductShortName(fullName, idx),
          revenue: rev,
          share: share > 0 ? share : parseFloat(((rev / channelTotalRev) * 100).toFixed(2)),
          color: idx === 0 ? '#fbbf24' : '#38bdf8',
        };
      });
    }

    if (data.channelProducts && data.channelProducts.length > 0) {
      const cardProducts = data.channelProducts
        .filter((p) => (p.channel.toLowerCase().includes('thẻ') || p.channel.toLowerCase().includes('sản phẩm')) && p.stage === 'placed')
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      if (cardProducts.length > 0) {
        const totalChannelRev =
          data.channels.find((c) => c.channelName.toLowerCase().includes('thẻ'))?.placedRevenue ||
          cardProducts.reduce((sum, p) => sum + p.revenue, 0) ||
          1;

        return cardProducts.map((p, idx) => {
          const fullName = resolveProductName(p.name, p.id);
          return {
            name: fullName,
            shortName: getProductShortName(fullName, idx),
            revenue: p.revenue,
            share: p.revenueShare > 0 ? p.revenueShare : parseFloat(((p.revenue / totalChannelRev) * 100).toFixed(2)),
            color: idx === 0 ? '#fbbf24' : '#38bdf8',
          };
        });
      }
    }

    if (data.abcProducts && data.abcProducts.length > 0) {
      const topAbc = data.abcProducts.slice(0, 5);
      const totalRev = data.abcProducts.reduce((sum, p) => sum + p.revenue, 0) || 1;
      return topAbc.map((p, idx) => ({
        name: p.name,
        shortName: getProductShortName(p.name, idx),
        revenue: p.revenue,
        share: +((p.revenue / totalRev) * 100).toFixed(2),
        color: idx === 0 ? '#fbbf24' : '#38bdf8',
      }));
    }

    return [];
  })();

  // 4. Raw Channel Matrix for Table in Row 2
  const sortedTableChannels = [...activeChannels].sort((a, b) => {
    const aRetention = a.retentionRate ?? (a.placedRevenue > 0 ? (a.paidRevenue / a.placedRevenue) * 100 : 0);
    const bRetention = b.retentionRate ?? (b.placedRevenue > 0 ? (b.paidRevenue / b.placedRevenue) * 100 : 0);
    const aLeakage = a.leakageAmount || Math.max(0, a.placedRevenue - a.paidRevenue);
    const bLeakage = b.leakageAmount || Math.max(0, b.placedRevenue - b.paidRevenue);
    const aAov = a.aov || (a.paidOrders > 0 ? Math.round(a.paidRevenue / a.paidOrders) : 0);
    const bAov = b.aov || (b.paidOrders > 0 ? Math.round(b.paidRevenue / b.paidOrders) : 0);

    if (channelSortBy === 'alphabetical') {
      return a.channelName.localeCompare(b.channelName, 'vi', { sensitivity: 'base' });
    }
    if (channelSortBy === 'alphabeticalDesc') {
      return b.channelName.localeCompare(a.channelName, 'vi', { sensitivity: 'base' });
    }
    if (channelSortBy === 'retentionRate') return aRetention - bRetention;
    if (channelSortBy === 'retentionRateDesc') return bRetention - aRetention;
    if (channelSortBy === 'leakageAmount') return bLeakage - aLeakage;
    if (channelSortBy === 'placedRevenue') return (b.placedRevenue || 0) - (a.placedRevenue || 0);
    if (channelSortBy === 'aov') return bAov - aAov;
    return (b.paidRevenue || 0) - (a.paidRevenue || 0);
  });

  const getStatusBadge = (ch: ChannelMetric) => {
    const rate = ch.retentionRate ?? (ch.placedRevenue > 0 ? Math.round((ch.paidRevenue / ch.placedRevenue) * 100) : 0);
    const statusText = ch.status || (
      rate >= 80 ? 'TỐT' : rate >= 70 ? 'TRUNG BÌNH' : rate >= 60 ? 'CẦN TỐI ƯU' : 'RÒ RỈ CAO'
    );
    let style = 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';
    if (statusText === 'RÒ RỈ CAO') {
      style = 'bg-rose-500/20 text-rose-300 border-rose-400/30';
    } else if (statusText === 'CẦN TỐI ƯU') {
      style = 'bg-amber-500/20 text-amber-300 border-amber-400/30';
    } else if (statusText === 'TRUNG BÌNH') {
      style = 'bg-sky-500/20 text-sky-300 border-sky-400/30';
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border backdrop-blur-md ${style}`}>
        {statusText}
      </span>
    );
  };

  return (
    <div className="space-y-6 my-2">
      {/* =========================================================================
          ROW 1: POWER BI HORIZONTAL GRID (3 COMPACT VISUAL WIDGETS ON 1 ROW)
          Tailwind Grid: grid-cols-1 lg:grid-cols-3 gap-4
          Height: 240px - 280px per visual widget
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ----------------- COL 1: FUNNEL CARD (Phễu chuyển đổi 3 bước) ----------------- */}
        <ConversionFunnelChart
          placedRevenue={placedRev}
          confirmedRevenue={confirmedRev}
          paidRevenue={paidRev}
          placedOrders={placedOrders}
          confirmedOrders={confirmedOrders}
          paidOrders={paidOrders}
          onNavigateToAiTab={onNavigateToAiTab}
          language={language}
        />

        {/* ----------------- COL 2: TRAFFIC CHANNELS CARD (Top 5 Nguồn Traffic & Giữ Chân) ----------------- */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/[0.12] shadow-xl flex flex-col justify-between h-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div>
              <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                Top 5 Kênh Traffic & Giữ Chân
              </h4>
              <p className="text-[11px] text-slate-400">Doanh số đặt & Tỷ lệ hoàn tất %</p>
            </div>
            <span className="text-[10px] font-bold text-sky-300 bg-sky-500/20 border border-sky-400/30 px-2 py-0.5 rounded-full">
              Thẻ SP {cardSharePercent}%
            </span>
          </div>

          {/* Recharts Horizontal Bar Chart for Channels */}
          <div className="w-full flex-1 relative min-h-[190px]">
            <ResponsiveContainer width="100%" height={195}>
              <BarChart
                data={top5TrafficChannels}
                layout="vertical"
                margin={{ top: 5, right: 35, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(val) => `${(val / 1e6).toFixed(0)}M`}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#e2e8f0', fontSize: 10.5, fontWeight: 600 }}
                  width={68}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 border border-white/20 rounded-xl p-2.5 shadow-2xl backdrop-blur-xl text-xs z-50">
                          <p className="font-bold text-white mb-1">{d.name}</p>
                          <p className="text-sky-300 font-semibold">Đã đặt: {formatVND(d.placedRev)}</p>
                          <p className="text-emerald-300 font-semibold">Thanh toán: {formatVND(d.paidRev)}</p>
                          <p className="text-amber-300 font-bold mt-0.5">Tỷ lệ giữ chân: {d.retentionRate}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="placedRev"
                  radius={[0, 4, 4, 0]}
                  barSize={14}
                >
                  <LabelList
                    dataKey="retentionRate"
                    position="right"
                    fill="#38bdf8"
                    fontSize={10}
                    fontWeight={700}
                    formatter={(val) => `${val ?? 0}%`}
                  />
                  {top5TrafficChannels.map((entry, index) => (
                    <Cell key={`traffic-cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ----------------- COL 3: HERO PRODUCTS CARD (Top 5 Sản phẩm gánh doanh thu) ----------------- */}
        <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/[0.12] shadow-xl flex flex-col justify-between h-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div>
              <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Top 5 Sản Phẩm Doanh Thu
              </h4>
              <p className="text-[11px] text-slate-400">Kênh Thẻ sản phẩm (Chiếm {cardSharePercent}%)</p>
            </div>
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 rounded-full">
              Top 1: {topProducts[0]?.share ? `${topProducts[0].share}%` : '0%'}
            </span>
          </div>

          {/* Recharts Horizontal Bar Chart for Products */}
          <div className="w-full flex-1 relative min-h-[190px]">
            <ResponsiveContainer width="100%" height={195}>
              <BarChart
                data={topProducts}
                layout="vertical"
                margin={{ top: 5, right: 35, left: 15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(val) => `${(val / 1e6).toFixed(1)}M`}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#e2e8f0', fontSize: 10.5, fontWeight: 600 }}
                  width={80}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 border border-white/20 rounded-xl p-2.5 shadow-2xl backdrop-blur-xl text-xs max-w-[260px] z-50">
                          <p className="font-bold text-white mb-1 leading-snug">{d.name}</p>
                          <p className="text-amber-300 font-bold">Doanh số: {formatVND(d.revenue)}</p>
                          <p className="text-sky-300 font-semibold">Tỷ trọng kênh: {d.share}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="revenue"
                  radius={[0, 4, 4, 0]}
                  barSize={14}
                >
                  <LabelList
                    dataKey="share"
                    position="right"
                    fill="#fde047"
                    fontSize={10}
                    fontWeight={700}
                    formatter={(val) => `${val ?? 0}%`}
                  />
                  {topProducts.map((entry, index) => (
                    <Cell key={`prod-cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 2: REVENUE LEAKAGE PIE & DIAGNOSTIC CARD (12 COLS)
      ========================================================================= */}
      <RevenueLeakagePieCard
        data={data}
        onNavigateToAiTab={onNavigateToAiTab}
        language={language}
      />

      {/* =========================================================================
          ROW 3: COMPREHENSIVE CHANNEL RETENTION MATRIX TABLE
      ========================================================================= */}
      <div className="glass-panel rounded-2xl p-5 border border-white/[0.12] shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
          <div>
            <h4 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              Bảng Ma Trận Đầy Đủ & Tỷ Lệ Giữ Chân Theo Từng Kênh
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              So sánh Doanh thu Placed, Doanh thu Paid, Tỷ lệ giữ chân, Thất thoát và AOV của từng kênh lưu lượng
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Sắp xếp:</span>
            <select
              id="select-channel-sort"
              value={channelSortBy}
              onChange={(e) => setChannelSortBy(e.target.value as any)}
              className="bg-slate-900 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-sky-400 cursor-pointer"
            >
              <option value="alphabetical">Tên kênh (A → Z) [Mặc định]</option>
              <option value="alphabeticalDesc">Tên kênh (Z → A)</option>
              <option value="paidRevenue">Doanh thu Paid (Cao → Thấp)</option>
              <option value="placedRevenue">Doanh thu Placed (Lớn nhất)</option>
              <option value="retentionRate">Tỷ lệ giữ chân (Thấp nhất - Rò rỉ)</option>
              <option value="retentionRateDesc">Tỷ lệ giữ chân (Cao nhất)</option>
              <option value="leakageAmount">Thất thoát VND (Lớn nhất)</option>
              <option value="aov">AOV Kênh (Cao → Thấp)</option>
            </select>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.1] text-slate-300 uppercase tracking-wider font-semibold select-none">
                <th
                  onClick={() => setChannelSortBy(channelSortBy === 'alphabetical' ? 'alphabeticalDesc' : 'alphabetical')}
                  className="py-3 px-3.5 cursor-pointer hover:text-sky-300 transition-colors"
                  title="Nhấn để sắp xếp A-Z hoặc Z-A"
                >
                  <div className="flex items-center gap-1">
                    <span>Kênh Lưu Lượng</span>
                    {channelSortBy === 'alphabetical' && <span className="text-sky-400 font-bold text-[10px] bg-sky-500/20 px-1 rounded">A→Z</span>}
                    {channelSortBy === 'alphabeticalDesc' && <span className="text-sky-400 font-bold text-[10px] bg-sky-500/20 px-1 rounded">Z→A</span>}
                  </div>
                </th>
                <th
                  onClick={() => setChannelSortBy('placedRevenue')}
                  className="py-3 px-3.5 text-right cursor-pointer hover:text-sky-300 transition-colors"
                  title="Nhấn để sắp xếp theo Doanh thu Placed"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Doanh Thu Placed</span>
                    {channelSortBy === 'placedRevenue' && <span className="text-sky-400 font-bold text-[10px]">▼</span>}
                  </div>
                </th>
                <th
                  onClick={() => setChannelSortBy('paidRevenue')}
                  className="py-3 px-3.5 text-right cursor-pointer hover:text-sky-300 transition-colors"
                  title="Nhấn để sắp xếp theo Doanh thu Paid"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Doanh Thu Paid</span>
                    {channelSortBy === 'paidRevenue' && <span className="text-sky-400 font-bold text-[10px]">▼</span>}
                  </div>
                </th>
                <th
                  onClick={() => setChannelSortBy(channelSortBy === 'retentionRate' ? 'retentionRateDesc' : 'retentionRate')}
                  className="py-3 px-3.5 text-center min-w-[140px] cursor-pointer hover:text-sky-300 transition-colors"
                  title="Nhấn để sắp xếp theo Tỷ lệ giữ chân"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Tỷ Lệ Giữ Chân</span>
                    {channelSortBy === 'retentionRate' && <span className="text-rose-400 font-bold text-[10px]">▲ Rò rỉ</span>}
                    {channelSortBy === 'retentionRateDesc' && <span className="text-emerald-400 font-bold text-[10px]">▼ Cao nhất</span>}
                  </div>
                </th>
                <th
                  onClick={() => setChannelSortBy('leakageAmount')}
                  className="py-3 px-3.5 text-right cursor-pointer hover:text-sky-300 transition-colors"
                  title="Nhấn để sắp xếp theo Thất thoát VND"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Thất Thoát (Leakage)</span>
                    {channelSortBy === 'leakageAmount' && <span className="text-rose-400 font-bold text-[10px]">▼</span>}
                  </div>
                </th>
                <th
                  onClick={() => setChannelSortBy('aov')}
                  className="py-3 px-3.5 text-right cursor-pointer hover:text-sky-300 transition-colors"
                  title="Nhấn để sắp xếp theo AOV"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>AOV Kênh</span>
                    {channelSortBy === 'aov' && <span className="text-sky-400 font-bold text-[10px]">▼</span>}
                  </div>
                </th>
                <th className="py-3 px-3.5 text-center">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {sortedTableChannels.map((ch) => {
                const rRate = ch.retentionRate ?? (ch.placedRevenue > 0 ? Math.round((ch.paidRevenue / ch.placedRevenue) * 100) : 0);
                return (
                  <tr
                    key={ch.channel}
                    className="hover:bg-white/[0.04] transition-colors"
                  >
                    <td className="py-3.5 px-3.5">
                      <div className="font-bold text-white text-sm">
                        {ch.channelName}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {ch.paidOrders} / {ch.placedOrders} đơn hoàn tất
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5 text-right text-slate-200 font-medium">
                      {formatVND(ch.placedRevenue)}
                    </td>
                    <td className="py-3.5 px-3.5 text-right font-bold text-emerald-400">
                      {formatVND(ch.paidRevenue)}
                    </td>
                    <td className="py-3.5 px-3.5">
                      <div className="flex flex-col items-center">
                        <span className={`font-bold text-xs ${rRate < 60 ? 'text-rose-400' : 'text-slate-100'}`}>
                          {rRate}%
                        </span>
                        <div className="w-28 bg-black/40 rounded-full h-2 mt-1.5 overflow-hidden border border-white/[0.08]">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              rRate >= 80
                                ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                                : rRate >= 65
                                ? 'bg-sky-400 shadow-sm shadow-sky-400/50'
                                : 'bg-rose-500 shadow-sm shadow-rose-500/50'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, rRate))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5 text-right font-bold text-rose-400">
                      -{formatVND(ch.leakageAmount || Math.max(0, ch.placedRevenue - ch.paidRevenue))}
                    </td>
                    <td className="py-3.5 px-3.5 text-right text-slate-200 font-medium">
                      {formatVND(ch.aov || (ch.paidOrders > 0 ? Math.round(ch.paidRevenue / ch.paidOrders) : 0))}
                    </td>
                    <td className="py-3.5 px-3.5 text-center">
                      {getStatusBadge(ch)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
