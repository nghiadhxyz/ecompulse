import React, { useState } from 'react';
import {
  Calendar,
  Layers,
  Users,
  Target,
  Flame,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Search,
  Eye,
  ShoppingBag,
  Percent,
  CheckCircle2,
  DollarSign,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ParsedStoreData, AbcProduct } from '../types';
import { formatVND, formatCompactVND, formatNumber, formatPercent } from '../utils/formatters';

interface DeepAnalyticsTabProps {
  data: ParsedStoreData;
  language: 'vi' | 'en';
}

const ABC_COLORS = {
  A: '#10b981', // emerald
  B: '#f59e0b', // amber
  C: '#64748b', // slate
};

const KNOWN_VIDEOS: Record<string, string> = {
  '2360369935615123': 'Bấm vào giỏ hàng để mua 👆',
  '1809874956026159': '#dacsanthanhhoa #nuocnamngon #balangth',
  '2160652184126021': 'Mừng Ngày Đôi 6/6 - Ba Làng TH D',
  '2127797135000196': 'Chất Lượng Xứng Danh, Mắm Ngon',
  '1693632721061510': '#Balangth #NuocmamBalangTH #Nuocmam',
};

const getVideoDisplayName = (title: string, id: string, index: number) => {
  if (title && title !== 'psd_label_video_id' && !/^\d{6,}$/.test(title)) {
    return title;
  }
  if (KNOWN_VIDEOS[id]) return KNOWN_VIDEOS[id];
  if (KNOWN_VIDEOS[title]) return KNOWN_VIDEOS[title];
  return `Review & Giới thiệu Video #${index + 1}`;
};

export const DeepAnalyticsTab: React.FC<DeepAnalyticsTabProps> = ({
  data,
  language,
}) => {
  const [productFilter, setProductFilter] = useState<'all' | 'A' | 'B' | 'C' | 'zombie'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = data.abcProducts.filter((p) => {
    if (productFilter === 'zombie') return p.isZombie;
    if (productFilter !== 'all' && p.classification !== productFilter) return false;
    if (searchQuery) {
      return (
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
  });

  // ABC Pie Data
  const abcPieData = [
    { name: `Nhóm A (${data.abcSummary.classACount} SKU)`, value: data.abcSummary.classAShare, color: '#10b981' },
    { name: `Nhóm B (${data.abcSummary.classBCount} SKU)`, value: data.abcSummary.classBShare, color: '#f59e0b' },
    { name: `Nhóm C (${data.abcSummary.classCCount} SKU)`, value: data.abcSummary.classCShare, color: '#64748b' },
  ];

  // Retention Pie Data
  const retentionPieData = [
    { name: 'Khách hàng mới', value: data.retention.newBuyers, color: '#3b82f6' },
    { name: 'Khách hàng cũ quay lại', value: data.retention.returningBuyers, color: '#10b981' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Time-Series & Campaign Detection */}
      <div className="glass-panel rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-bold text-white">
                Dòng Thời Gian Doanh Thu & Nhận Diện Ngày Sale Đôi (Campaign Detection)
              </h3>
            </div>
            <p className="text-xs text-slate-300/80 mt-0.5">
              Tự động phát hiện ngày siêu sale (8.8, 9.9, 15 Lương về, 25 Giữa tháng) và đo lường tỷ lệ phụ thuộc chiến dịch
            </p>
          </div>

          {/* Campaign Dependency Rate Badge */}
          <div className="flex items-center space-x-2 bg-white/[0.05] px-3.5 py-1.5 rounded-xl border border-white/[0.1] backdrop-blur-md">
            <span className="text-xs text-slate-300">Tỷ lệ phụ thuộc Campaign:</span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full backdrop-blur-md ${
                data.campaignStats.campaignSharePercent > 50
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
              }`}
            >
              {data.campaignStats.campaignSharePercent}%
            </span>
          </div>
        </div>

        {/* Campaign Metrics Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          <div className="glass-panel-subtle p-4 rounded-2xl shadow-md">
            <span className="text-xs text-slate-300 font-medium">Doanh thu ngày Campaign (3 ngày)</span>
            <div className="text-xl font-black text-blue-300 mt-1">
              {formatVND(data.campaignStats.campaignRevenue)}
            </div>
            <span className="text-[11px] text-slate-400">
              Chiếm {data.campaignStats.campaignSharePercent}% tổng doanh thu
            </span>
          </div>

          <div className="glass-panel-subtle p-4 rounded-2xl shadow-md">
            <span className="text-xs text-slate-300 font-medium">Doanh thu ngày Thường (28 ngày)</span>
            <div className="text-xl font-black text-slate-100 mt-1">
              {formatVND(data.campaignStats.normalRevenue)}
            </div>
            <span className="text-[11px] text-slate-400">
              Trung bình: {formatVND(data.campaignStats.normalRevenue / 28)}/ngày
            </span>
          </div>

          <div className="glass-panel-subtle p-4 rounded-2xl shadow-md">
            <span className="text-xs text-slate-300 font-medium">Hệ số bùng nổ (Spike Ratio)</span>
            <div className="text-xl font-black text-emerald-400 mt-1">
              {(data.campaignStats.campaignRevenue / (data.campaignStats.normalRevenue || 1) * (28 / 3)).toFixed(1)}x
            </div>
            <span className="text-[11px] text-slate-400">
              Doanh thu ngày sale cao gấp {(data.campaignStats.campaignRevenue / (data.campaignStats.normalRevenue || 1) * (28 / 3)).toFixed(1)} lần ngày thường
            </span>
          </div>
        </div>

        {/* Daily Timeline Chart */}
        {data.dailyTimeline.length > 0 ? (
          <div className="h-72 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dailyTimeline} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="displayDate"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(v) => formatCompactVND(v)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="glass-panel p-3.5 rounded-xl text-xs shadow-2xl backdrop-blur-2xl border border-white/20 bg-slate-950/80">
                          <div className="font-bold text-white flex items-center justify-between gap-2">
                            <span>Ngày {d.date}</span>
                            {d.campaignLabel && (
                              <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                {d.campaignLabel}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 text-emerald-400 font-bold text-sm">
                            Doanh thu thực: {formatVND(d.revenue)}
                          </div>
                          <div className="text-slate-300 mt-0.5">
                            Đơn hàng: {d.orders} đơn
                          </div>
                          <div className="text-slate-400">
                            Doanh thu đặt: {formatVND(d.placedRevenue)}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="revenue"
                  radius={[4, 4, 0, 0]}
                  fill="#3b82f6"
                  // Highlight campaign bars with brighter color
                  shape={(props: any) => {
                    const { fill, x, y, width, height, payload } = props;
                    const isCampaign = payload.isDoubleDigitCampaign;
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={isCampaign ? '#f43f5e' : '#3b82f6'}
                        rx={3}
                        ry={3}
                      />
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center space-x-6 text-xs text-slate-300 mt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block shadow-sm shadow-blue-500/50"></span>
                Ngày thường
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block shadow-sm shadow-rose-500/50"></span>
                Ngày Sale Đôi / Lương Về / Giữa Tháng
              </span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 text-xs">
            Dữ liệu dòng thời gian tự động trích xuất từ cột Ngày Đặt Hàng.
          </div>
        )}
      </div>

      {/* 2. Product Intelligence & Concentration (ABC Analysis & Zombie Detection) */}
      <div className="glass-panel rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">
                Phân Tích Sản Phẩm ABC & Phát Hiện Sản Phẩm "Zombie" (Product Intelligence)
              </h3>
            </div>
            <p className="text-xs text-slate-300/80 mt-0.5">
              Phân loại 80/15/5 Pareto: Nhóm A (Gánh 80% doanh thu), Nhóm B (15%), Nhóm C (5%) và phát hiện sản phẩm có view nhưng 0 sales
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto">
            <button
              onClick={() => setProductFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold backdrop-blur-md transition-all ${
                productFilter === 'all'
                  ? 'bg-white/20 text-white border border-white/30 shadow-sm'
                  : 'bg-white/[0.05] text-slate-300 hover:text-white border border-white/[0.08]'
              }`}
            >
              Tất cả ({data.abcProducts.length})
            </button>
            <button
              onClick={() => setProductFilter('A')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold backdrop-blur-md transition-all ${
                productFilter === 'A'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 shadow-sm'
                  : 'bg-white/[0.05] text-slate-300 hover:text-white border border-white/[0.08]'
              }`}
            >
              Nhóm A ({data.abcSummary.classACount})
            </button>
            <button
              onClick={() => setProductFilter('B')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold backdrop-blur-md transition-all ${
                productFilter === 'B'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40 shadow-sm'
                  : 'bg-white/[0.05] text-slate-300 hover:text-white border border-white/[0.08]'
              }`}
            >
              Nhóm B ({data.abcSummary.classBCount})
            </button>
            <button
              onClick={() => setProductFilter('C')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold backdrop-blur-md transition-all ${
                productFilter === 'C'
                  ? 'bg-white/20 text-slate-200 border border-white/30'
                  : 'bg-white/[0.05] text-slate-300 hover:text-white border border-white/[0.08]'
              }`}
            >
              Nhóm C ({data.abcSummary.classCCount})
            </button>
            <button
              onClick={() => setProductFilter('zombie')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold backdrop-blur-md transition-all ${
                productFilter === 'zombie'
                  ? 'bg-rose-500/25 text-rose-300 border border-rose-400/40 shadow-sm'
                  : 'bg-white/[0.05] text-slate-300 hover:text-white border border-white/[0.08]'
              }`}
            >
              ⚠️ Zombie ({data.abcSummary.zombieCount})
            </button>
          </div>
        </div>

        {/* ABC Ratio Visual Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4">
          <div className="glass-panel-subtle border-emerald-500/30 p-4 rounded-2xl shadow-lg bg-emerald-950/15">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Nhóm A (Sản Phẩm Chủ Lực)
              </span>
              <span className="text-xs font-black bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/30 backdrop-blur-md">
                {data.abcSummary.classAShare}% DT
              </span>
            </div>
            <p className="text-xs text-slate-200 mt-2">
              Chỉ {data.abcSummary.classACount} SKU gánh {data.abcSummary.classAShare}% toàn bộ doanh thu shop.
            </p>
            <span className="text-[11px] text-emerald-300 font-medium block mt-2.5">
              👉 Ưu tiên: Luôn đảm bảo đủ tồn kho, chạy quảng cáo bảo vệ vị trí Top 1.
            </span>
          </div>

          <div className="glass-panel-subtle border-amber-500/30 p-4 rounded-2xl shadow-lg bg-amber-950/15">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Nhóm B (Tiềm Năng)
              </span>
              <span className="text-xs font-black bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/30 backdrop-blur-md">
                {data.abcSummary.classBShare}% DT
              </span>
            </div>
            <p className="text-xs text-slate-200 mt-2">
              Gồm {data.abcSummary.classBCount} SKU đóng góp {data.abcSummary.classBShare}% doanh thu.
            </p>
            <span className="text-[11px] text-amber-300 font-medium block mt-2.5">
              👉 Ưu tiên: Bán kèm theo Deal sốc (Cross-sell) với Nhóm A để kéo lên Nhóm A.
            </span>
          </div>

          <div className="glass-panel-subtle p-4 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Nhóm C & Zombie
              </span>
              <span className="text-xs font-black bg-white/10 text-slate-200 px-2.5 py-0.5 rounded-full border border-white/20 backdrop-blur-md">
                {data.abcSummary.classCShare}% DT
              </span>
            </div>
            <p className="text-xs text-slate-200 mt-2">
              Gồm {data.abcSummary.classCCount} SKU (trong đó {data.abcSummary.zombieCount} sản phẩm Zombie nhiều view nhưng 0 sales).
            </p>
            <span className="text-[11px] text-rose-300 font-medium block mt-2.5">
              👉 Ưu tiên: Xả tồn kho, đổi thumbnail hoặc đóng làm quà tặng kèm (GWP).
            </span>
          </div>
        </div>

        {/* Product Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.1] text-slate-300 uppercase tracking-wider font-semibold">
                <th className="py-3 px-3">Phân loại</th>
                <th className="py-3 px-3">Tên Sản Phẩm / SKU</th>
                <th className="py-3 px-3 text-right">Doanh Thu Paid</th>
                <th className="py-3 px-3 text-right">Lũy Kế %</th>
                <th className="py-3 px-3 text-right">Đơn Bán</th>
                <th className="py-3 px-3 text-right">Lượt Xem (Views)</th>
                <th className="py-3 px-3 text-right">Tỷ Lệ Mua (CR)</th>
                <th className="py-3 px-3 text-center">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredProducts.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-white/[0.04] transition-colors"
                >
                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black backdrop-blur-md ${
                        p.classification === 'A'
                          ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-400/40 shadow-sm shadow-emerald-500/20'
                          : p.classification === 'B'
                          ? 'bg-amber-500/25 text-amber-400 border border-amber-400/40 shadow-sm shadow-amber-500/20'
                          : 'bg-white/10 text-slate-300 border border-white/20'
                      }`}
                    >
                      {p.classification}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-white text-sm">
                      {p.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {p.sku}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right font-bold text-emerald-400">
                    {formatVND(p.revenue)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-200 font-semibold">
                    {p.cumulativePercentage}%
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-200 font-medium">
                    {formatNumber(p.orders)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-400">
                    {formatNumber(p.views)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-semibold text-slate-100">
                    {p.conversionRate}%
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    {p.isZombie ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-400/30 backdrop-blur-md">
                        ⚠️ Zombie Product
                      </span>
                    ) : p.classification === 'A' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 backdrop-blur-md">
                        Chủ lực (Top)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium text-slate-300 bg-white/[0.06] border border-white/[0.08]">
                        Bình thường
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Customer Retention & 4. Ad Performance Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Retention */}
        <div className="glass-panel rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  Khách Hàng Mới vs. Khách Cũ (Retention Snapshot)
                </h3>
              </div>
              <span className="text-xs text-slate-300 font-medium">
                Tổng: {formatNumber((data.retention.newBuyers || 0) + (data.retention.returningBuyers || 0))} khách
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="glass-panel-subtle p-3.5 rounded-2xl shadow-md border-l-2 border-l-sky-400">
                <span className="text-xs text-slate-300 font-medium">Khách hàng mới</span>
                <div className="text-lg font-black text-sky-400 mt-1">
                  {formatNumber(data.retention.newBuyers)} người
                </div>
                <div className="text-xs text-slate-300/90 mt-1">
                  AOV: {formatVND(data.retention.newBuyerAov)}
                </div>
              </div>

              <div className="glass-panel-subtle p-3.5 rounded-2xl shadow-md border-l-2 border-l-emerald-400">
                <span className="text-xs text-slate-300 font-medium">Khách cũ quay lại</span>
                <div className="text-lg font-black text-emerald-400 mt-1">
                  {formatNumber(data.retention.returningBuyers)} người
                </div>
                <div className="text-xs text-slate-300/90 mt-1">
                  AOV: {formatVND(data.retention.returningBuyerAov)} (gấp 1.5x)
                </div>
              </div>
            </div>

            {/* Small Pie Chart showing proportions */}
            {(() => {
              const totalBuyers = (data.retention.newBuyers || 0) + (data.retention.returningBuyers || 0) || 1;
              const newPct = (((data.retention.newBuyers || 0) / totalBuyers) * 100).toFixed(1);
              const retPct = (((data.retention.returningBuyers || 0) / totalBuyers) * 100).toFixed(1);

              const customerPieData = [
                { name: 'Khách hàng mới', value: data.retention.newBuyers || 0, percent: newPct, color: '#38bdf8' },
                { name: 'Khách cũ quay lại', value: data.retention.returningBuyers || 0, percent: retPct, color: '#10b981' },
              ];

              return (
                <div className="glass-panel-subtle p-3 rounded-2xl my-3 flex items-center justify-between gap-2">
                  <div className="w-[120px] h-[100px] shrink-0 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={customerPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={26}
                          outerRadius={42}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {customerPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const p = payload[0].payload;
                              return (
                                <div className="glass-panel text-white text-[11px] p-2 rounded-lg shadow-xl border border-white/20">
                                  <div className="font-bold">{p.name}</div>
                                  <div className="text-slate-200">
                                    {formatNumber(p.value)} người ({p.percent}%)
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-slate-400 font-medium leading-none">Tỉ trọng</span>
                      <span className="text-xs font-bold text-white leading-tight">100%</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 pr-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block shrink-0 shadow-sm shadow-sky-400/50"></span>
                        <span className="text-slate-200 font-medium">Khách hàng mới:</span>
                      </div>
                      <span className="font-bold text-sky-400">
                        {newPct}% <span className="text-[11px] font-normal text-slate-400">({formatNumber(data.retention.newBuyers)})</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shrink-0 shadow-sm shadow-emerald-400/50"></span>
                        <span className="text-slate-200 font-medium">Khách cũ quay lại:</span>
                      </div>
                      <span className="font-bold text-emerald-400">
                        {retPct}% <span className="text-[11px] font-normal text-slate-400">({formatNumber(data.retention.returningBuyers)})</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="glass-panel-subtle p-3 rounded-xl text-xs text-slate-200 flex items-center justify-between mt-2">
            <span>Tỷ lệ khách quay lại (Repeat Purchase):</span>
            <span className="font-bold text-emerald-400 text-sm">
              {data.retention.repeatPurchaseRate}%
            </span>
          </div>
        </div>

        {/* Ad Performance & Budget Mismatch */}
        <div className="glass-panel rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-rose-400" />
              <h3 className="text-base font-bold text-white">
                Hiệu Quả Quảng Cáo Shopee Ads (ROAS Matrix)
              </h3>
            </div>
            {data.adSummary.wastedBudget > 0 && (
              <span className="text-xs font-bold bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-400/30 backdrop-blur-md">
                Lãng phí: {formatVND(data.adSummary.wastedBudget)}
              </span>
            )}
          </div>

          <div className="space-y-3 mt-4">
            {data.ads.map((ad) => (
              <div
                key={ad.name}
                className="glass-panel-subtle rounded-2xl p-3.5 flex flex-col justify-between gap-2 shadow-md hover:bg-white/[0.06] transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">
                    {ad.name}
                  </span>
                  <span
                    className={`text-xs font-black px-2.5 py-0.5 rounded-full backdrop-blur-md ${
                      ad.isBudgetWaste
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    }`}
                  >
                    ROAS {ad.roas}x {ad.isBudgetWaste ? '(Lỗ vốn)' : '(Lãi)'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs pt-1 text-slate-300">
                  <div>
                    Chi phí: <strong className="text-slate-100">{formatVND(ad.spend)}</strong>
                  </div>
                  <div>
                    Doanh thu: <strong className="text-emerald-400">{formatVND(ad.paidRevenue)}</strong>
                  </div>
                  <div className="text-right">
                    Điểm hòa vốn: <strong className="text-slate-100">{ad.breakEvenRoas}x</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Group 4: Live Session Contribution (If Available) */}
      {data.liveSessions && data.liveSessions.length > 0 && (
        <div className="glass-panel rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">
                Hiệu Suất Phiên Live Stream (Group 4: Session Contribution)
              </h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
              {data.liveSessions.length} Phiên Live
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-white/[0.1] text-slate-300 uppercase tracking-wider font-semibold bg-white/[0.02]">
                  <th className="py-3 px-3">Tiêu Đề Phiên Live</th>
                  <th className="py-3 px-3 text-right">Doanh Số (VND)</th>
                  <th className="py-3 px-3 text-right">Tỷ Trọng %</th>
                  <th className="py-3 px-3 text-right">Số Đơn</th>
                  <th className="py-3 px-3 text-right">Lượt Xem</th>
                  <th className="py-3 px-3 text-right">CTR / ATC</th>
                  <th className="py-3 px-3 text-right">Tỷ Lệ Mua (CR)</th>
                  <th className="py-3 px-3 text-center">Thời Lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {data.liveSessions.map((session, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.04] transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white text-sm">{session.title}</div>
                      <div className="text-[11px] font-mono text-slate-400">{session.sessionId}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">
                      {formatVND(session.revenue)}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-blue-300">
                      {session.revenueShare}%
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-200">
                      {formatNumber(session.orders)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {formatNumber(session.liveViews)} ({formatNumber(session.liveViewers)} người)
                    </td>
                    <td className="py-3 px-3 text-right text-slate-200">
                      {session.ctr}% / {session.atc} ATC
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-300">
                      {session.conversionRate}%
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">
                      {session.avgWatchDuration}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Group 5 & 6: Video & Affiliate Contribution Matrix */}
      {(data.videoMetrics || data.affiliates) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shopee Video Metrics */}
          {data.videoMetrics && (
            <div className="glass-panel rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center space-x-2">
                  <Flame className="w-5 h-5 text-orange-400" />
                  <h3 className="text-base font-bold text-white">
                    Shopee Video (Group 5)
                  </h3>
                </div>
                <span className="text-xs text-slate-300">{data.videoMetrics.length} Video</span>
              </div>

              <div className="space-y-3 mt-4">
                {data.videoMetrics.map((v, idx) => (
                  <div key={idx} className="glass-panel-subtle p-3.5 rounded-2xl">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-white text-xs">{getVideoDisplayName(v.videoTitle, v.videoId, idx)}</div>
                      <div className="font-bold text-emerald-400 text-xs shrink-0">{formatVND(v.revenue)}</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-[11px] text-slate-300 mt-2">
                      <div>Views: <strong className="text-white">{formatNumber(v.videoViews)}</strong></div>
                      <div>Likes: <strong className="text-white">{formatNumber(v.likes)}</strong></div>
                      <div>Đơn: <strong className="text-white">{formatNumber(v.orders)}</strong></div>
                      <div>CR: <strong className="text-emerald-300">{v.conversionRate}%</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affiliate / KOC Metrics */}
          {data.affiliates && (
            <div className="glass-panel rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">
                    Affiliate & KOC (Group 6)
                  </h3>
                </div>
                <span className="text-xs text-slate-300">{data.affiliates.length} Partners</span>
              </div>

              <div className="space-y-3 mt-4">
                {data.affiliates.map((aff, idx) => (
                  <div key={idx} className="glass-panel-subtle p-3.5 rounded-2xl">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-white text-xs">@{aff.username}</div>
                      <div className="font-bold text-emerald-400 text-xs shrink-0">{formatVND(aff.revenue)}</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-[11px] text-slate-300 mt-2">
                      <div>Tỷ trọng: <strong className="text-white">{aff.revenueShare}%</strong></div>
                      <div>Đơn: <strong className="text-white">{formatNumber(aff.orders)}</strong></div>
                      <div>Clicks: <strong className="text-white">{formatNumber(aff.productClicks)}</strong></div>
                      <div>AOV: <strong className="text-emerald-300">{formatCompactVND(aff.aov)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
