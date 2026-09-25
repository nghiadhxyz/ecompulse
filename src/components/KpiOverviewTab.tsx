import React from 'react';
import {
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { ParsedStoreData } from '../types';
import { formatCompactVND, formatNumber } from '../utils/formatters';
import { P0AnalyticsDashboard } from './dashboard/P0AnalyticsDashboard';
import { StoreOperationsMetricStrip } from './dashboard/StoreOperationsMetricStrip';
import { ShopeeGrowthAndContentHub } from './dashboard/ShopeeGrowthAndContentHub';

interface KpiOverviewTabProps {
  data: ParsedStoreData;
  onNavigateToTab: (tab: 'overview' | 'deep' | 'ai' | 'raw') => void;
  language: 'vi' | 'en';
}

export const KpiOverviewTab: React.FC<KpiOverviewTabProps> = ({
  data,
  onNavigateToTab,
  language,
}) => {
  return (
    <div className="space-y-6 pb-12">
      {/* 1. 6-Box Criteria Matrix (Single row on desktop) */}
      <div className="glass-panel rounded-2xl border border-white/[0.15] shadow-2xl overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 divide-x-0 sm:divide-x divide-white/[0.1]">
          {/* Box 1: Doanh số đã đặt */}
          <div className="py-6 px-3 text-center flex flex-col items-center justify-center space-y-1.5 hover:bg-white/[0.03] transition-colors">
            <div className="text-xl sm:text-2xl lg:text-2xl font-extrabold text-sky-400 tracking-tight">
              {formatCompactVND(data.kpis.placedRevenue)}
            </div>
            <div className="text-xs sm:text-sm font-bold text-white tracking-tight">
              Doanh số đã đặt
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {formatNumber(data.kpis.placedOrders)} đơn · {data.dailyTimeline && data.dailyTimeline.length > 0 ? data.dailyTimeline.length : 30} ngày
            </div>
          </div>

          {/* Box 2: Doanh số thanh toán */}
          <div className="py-6 px-3 text-center flex flex-col items-center justify-center space-y-1.5 hover:bg-white/[0.03] transition-colors">
            <div className="text-xl sm:text-2xl lg:text-2xl font-extrabold text-sky-400 tracking-tight">
              {formatCompactVND(data.kpis.paidRevenue)}
            </div>
            <div className="text-xs sm:text-sm font-bold text-white tracking-tight">
              Doanh số thanh toán
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {formatNumber(data.kpis.paidOrders)} đơn · giữ {String(data.kpis.conversionRate).replace('.', ',')}%
            </div>
          </div>

          {/* Box 3: ROAS quảng cáo */}
          <div className="py-6 px-3 text-center flex flex-col items-center justify-center space-y-1.5 hover:bg-white/[0.03] transition-colors">
            <div className="text-xl sm:text-2xl lg:text-2xl font-extrabold text-sky-400 tracking-tight">
              {(() => {
                const totalAdSpend = data.kpis.adSpend || (data.ads && data.ads.length > 0 ? data.ads.reduce((sum, a) => sum + (a.spend || 0), 0) : 0);
                const totalAdRev = data.ads && data.ads.length > 0 ? data.ads.reduce((sum, a) => sum + (a.paidRevenue || 0), 0) : 0;
                const roas = data.kpis.blendedRoas && data.kpis.blendedRoas > 0
                  ? data.kpis.blendedRoas
                  : (totalAdSpend > 0 ? (totalAdRev > 0 ? totalAdRev / totalAdSpend : data.kpis.paidRevenue / totalAdSpend) : 0);
                return roas > 0 ? `~${roas.toFixed(1).replace('.', ',')} lần` : '0,0 lần';
              })()}
            </div>
            <div className="text-xs sm:text-sm font-bold text-white tracking-tight">
              ROAS quảng cáo
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {(() => {
                const totalAdSpend = data.kpis.adSpend || (data.ads && data.ads.length > 0 ? data.ads.reduce((sum, a) => sum + (a.spend || 0), 0) : 0);
                return `Chi phí ads ${formatCompactVND(totalAdSpend)}`;
              })()}
            </div>
          </div>

          {/* Box 4: Tỷ lệ đơn bị hủy */}
          <div className="py-6 px-3 text-center flex flex-col items-center justify-center space-y-1.5 hover:bg-white/[0.03] transition-colors">
            <div className="text-xl sm:text-2xl lg:text-2xl font-extrabold text-sky-400 tracking-tight">
              {String(data.kpis.cancellationRate).replace('.', ',')}%
            </div>
            <div className="text-xs sm:text-sm font-bold text-white tracking-tight">
              Tỷ lệ đơn bị hủy
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {formatNumber(data.kpis.cancelledOrders)} đơn · {formatCompactVND(data.kpis.leakageAmount || Math.max(0, data.kpis.placedRevenue - data.kpis.paidRevenue))}
            </div>
          </div>

          {/* Box 5: Khách mua mới */}
          <div className="py-6 px-3 text-center flex flex-col items-center justify-center space-y-1.5 hover:bg-white/[0.03] transition-colors">
            <div className="text-xl sm:text-2xl lg:text-2xl font-extrabold text-sky-400 tracking-tight">
              {(() => {
                const totalBuyers = data.retention?.totalBuyers ?? (data.kpis.paidOrders > 0 ? data.kpis.paidOrders : 0);
                const newBuyers = data.retention?.newBuyers ?? totalBuyers;
                return totalBuyers > 0 ? ((newBuyers / totalBuyers) * 100).toFixed(1).replace('.', ',') + '%' : '0,0%';
              })()}
            </div>
            <div className="text-xs sm:text-sm font-bold text-white tracking-tight">
              Khách mua mới
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {(() => {
                const totalBuyers = data.retention?.totalBuyers ?? (data.kpis.paidOrders > 0 ? data.kpis.paidOrders : 0);
                const newBuyers = data.retention?.newBuyers ?? totalBuyers;
                return `${formatNumber(newBuyers)}/${formatNumber(totalBuyers)} người mua`;
              })()}
            </div>
          </div>

          {/* Box 6: Tỷ lệ khách quay lại */}
          <div className="py-6 px-3 text-center flex flex-col items-center justify-center space-y-1.5 hover:bg-white/[0.03] transition-colors">
            <div className="text-xl sm:text-2xl lg:text-2xl font-extrabold text-sky-400 tracking-tight">
              {(() => {
                const repeatRate = data.retention?.repeatPurchaseRate ?? 0;
                return repeatRate > 0 ? `${String(repeatRate).replace('.', ',')}%` : '0,0%';
              })()}
            </div>
            <div className="text-xs sm:text-sm font-bold text-white tracking-tight">
              Tỷ lệ khách quay lại
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {(() => {
                const totalBuyers = data.retention?.totalBuyers ?? (data.kpis.paidOrders > 0 ? data.kpis.paidOrders : 0);
                const newBuyers = data.retention?.newBuyers ?? totalBuyers;
                const returningBuyers = data.retention?.returningBuyers ?? Math.max(0, totalBuyers - newBuyers);
                return returningBuyers > 0 ? `${formatNumber(returningBuyers)} khách quay lại` : 'Khách mua lần đầu';
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Operational & Store Performance Metrics Strip (4 Essential Shopee Operational KPIs) */}
      <StoreOperationsMetricStrip data={data} language={language} />

      {/* 3. Power BI Visual Analytics Dashboard (Row 1: 3-Col Horizontal Widgets, Revenue Leakage Pie Card, Row 2: Channel Retention Matrix Table) */}
      <P0AnalyticsDashboard
        data={data}
        onNavigateToAiTab={() => onNavigateToTab('ai')}
        language={language}
      />

      {/* 4. Shopee Growth & Content Hub (Flywheel Momentum, Creator Analytics, Reels Analytics, Livestream Analytics) */}
      <ShopeeGrowthAndContentHub
        data={data}
        language={language}
        onNavigateToAi={() => onNavigateToTab('ai')}
      />

      {/* 5. Rule-Based Alerts (Phase 0 Zero-Latency Warnings) */}
      {data.alerts.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold tracking-wider uppercase text-slate-300">
                Cảnh Báo Tức Thì Từ Bộ Luật (Rule-Based Alerts Engine)
              </h3>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-400">
                {data.alerts.length} vấn đề cần chú ý
              </span>
              <button
                onClick={() => onNavigateToTab('ai')}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <span>Mở AI Action Center</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.alerts.map((alert) => (
              <div
                key={alert.id}
                id={`alert-card-${alert.id}`}
                className={`p-4 rounded-2xl border transition-all backdrop-blur-xl shadow-lg ${
                  alert.severity === 'critical'
                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-400/50 text-rose-100'
                    : alert.severity === 'warning'
                    ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-400/50 text-amber-100'
                    : 'bg-blue-950/20 border-blue-500/30 hover:border-blue-400/50 text-blue-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${
                        alert.severity === 'critical'
                          ? 'bg-rose-500/80 text-white border border-rose-400/50 shadow-sm'
                          : alert.severity === 'warning'
                          ? 'bg-amber-500/80 text-slate-950 border border-amber-400/50 shadow-sm'
                          : 'bg-blue-500/80 text-white border border-blue-400/50 shadow-sm'
                      }`}
                    >
                      {alert.severity === 'critical' ? 'Báo động đỏ' : alert.severity === 'warning' ? 'Cảnh báo' : 'Thông tin'}
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      {alert.metricValue}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {alert.threshold}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white mt-2">
                  {alert.title}
                </h4>
                <p className="text-xs text-slate-300/90 mt-1 leading-relaxed">
                  {alert.message}
                </p>

                <div className="mt-3 pt-2.5 border-t border-white/[0.08] flex items-center justify-between text-xs">
                  <span className="text-amber-300 font-semibold flex items-center gap-1">
                    💡 Khuyến nghị: {alert.recommendation}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
