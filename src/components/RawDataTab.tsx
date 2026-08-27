import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Layers,
  Filter,
  CheckCircle2,
  Table,
  Radio,
  Video,
  Users2,
  TrendingUp,
  Tag,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import { ParsedStoreData } from '../types';
import { formatVND, formatNumber } from '../utils/formatters';
import { downloadSampleShopeeExcel } from '../utils/excelParser';

interface RawDataTabProps {
  data: ParsedStoreData;
}

export const RawDataTab: React.FC<RawDataTabProps> = ({ data }) => {
  const [activeSheet, setActiveSheet] = useState<string>(
    data.detectedSheets[0] || 'Đơn hàng đã đặt'
  );
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 15;

  // Group definitions for the 21 sheets
  const groups = [
    { id: 'all', name: 'Tất cả Sheets', count: data.detectedSheets.length, icon: Layers },
    { id: 'g1', name: 'Group 1: Tổng Quan (3 sheets)', match: ['đặt', 'xác nhận', 'thanh toán', 'placed', 'confirmed', 'paid'], icon: TrendingUp },
    { id: 'g2', name: 'Group 2: Lưu Lượng (6 sheets)', match: ['nguồn', 'traffic'], icon: BarChart3 },
    { id: 'g3', name: 'Group 3: Sản Phẩm (3 sheets)', match: ['sản phẩm', 'product'], icon: Tag },
    { id: 'g4', name: 'Group 4: Live Session (3 sheets)', match: ['session', 'live'], icon: Radio },
    { id: 'g5', name: 'Group 5: Shopee Video (3 sheets)', match: ['video'], icon: Video },
    { id: 'g6', name: 'Group 6: Affiliate KOC (3 sheets)', match: ['affiliate', 'koc'], icon: Users2 },
  ];

  // Filter sheets by selected group
  const filteredSheets = useMemo(() => {
    if (selectedGroup === 'all') return data.detectedSheets;
    const groupDef = groups.find((g) => g.id === selectedGroup);
    if (!groupDef || !groupDef.match) return data.detectedSheets;

    return data.detectedSheets.filter((s) => {
      const lower = s.toLowerCase();
      if (selectedGroup === 'g1') {
        return (
          (lower.includes('đặt') || lower.includes('xác') || lower.includes('thanh toán')) &&
          !lower.includes('theo') &&
          !lower.includes('nguồn') &&
          !lower.includes('session') &&
          !lower.includes('video') &&
          !lower.includes('affiliate')
        );
      }
      return groupDef.match.some((m) => lower.includes(m));
    });
  }, [selectedGroup, data.detectedSheets]);

  // Current sheet raw table
  const currentRawTable = data.rawSheets ? data.rawSheets[activeSheet] : null;

  // Filtered rows for current sheet
  const filteredRows = useMemo(() => {
    if (!currentRawTable || !currentRawTable.rows) return [];
    if (!searchTerm.trim()) return currentRawTable.rows;

    const term = searchTerm.toLowerCase();
    return currentRawTable.rows.filter((row) =>
      Object.values(row).some((val) => String(val).toLowerCase().includes(term))
    );
  }, [currentRawTable, searchTerm]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="glass-panel rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Trình Soi & Kiểm Tra Dữ Liệu Raw 21 Sheet Chuẩn Shopee
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {data.detectedSheets.length} Sheets
                </span>
              </h3>
              <p className="text-xs text-slate-300/80 mt-0.5">
                File nguồn: <span className="text-slate-100 font-medium">{data.fileName}</span> • Nhận diện cấu trúc header từng nhóm dòng (Row 1, Row 2, Row 3, Row 5)
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={downloadSampleShopeeExcel}
          className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-600/80 hover:bg-blue-600 border border-blue-400/30 rounded-xl transition-all backdrop-blur-md shadow-lg shadow-blue-500/20 shrink-0"
        >
          <Download className="w-4 h-4 mr-1.5" />
          <span>Tải file mẫu Shopee 21 Sheet (.XLSX)</span>
        </button>
      </div>

      {/* Group Navigation Filter */}
      <div className="glass-panel-subtle p-3 rounded-2xl flex items-center space-x-2 overflow-x-auto">
        <span className="text-xs font-semibold text-slate-400 px-2 flex items-center gap-1 shrink-0">
          <Filter className="w-3.5 h-3.5" /> Nhóm Sheet:
        </span>
        {groups.map((g) => {
          const Icon = g.icon;
          const isSelected = selectedGroup === g.id;
          return (
            <button
              key={g.id}
              onClick={() => {
                setSelectedGroup(g.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 backdrop-blur-md ${
                isSelected
                  ? 'bg-blue-500/25 text-blue-300 border border-blue-400/40 shadow-sm shadow-blue-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{g.name}</span>
            </button>
          );
        })}
      </div>

      {/* Sheet Buttons Navigation */}
      <div className="flex items-center space-x-2 border-b border-white/[0.08] pb-3 overflow-x-auto">
        {filteredSheets.map((sheet) => {
          const isCurrent = activeSheet === sheet;
          return (
            <button
              key={sheet}
              onClick={() => {
                setActiveSheet(sheet);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 backdrop-blur-md ${
                isCurrent
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 shadow-md shadow-emerald-500/20'
                  : 'glass-panel-subtle text-slate-300 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{sheet}</span>
              {data.rawSheets?.[sheet] && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-slate-300">
                  {data.rawSheets[sheet].totalRowCount} dòng
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Current Sheet Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="glass-panel-subtle p-3.5 rounded-2xl shadow-md">
          <span className="text-[11px] text-slate-400">Sheet đang xem</span>
          <div className="text-xs font-bold text-white mt-1 truncate" title={activeSheet}>
            {activeSheet}
          </div>
          {currentRawTable && (
            <span className="text-[10px] text-blue-400 block mt-0.5">{currentRawTable.groupName}</span>
          )}
        </div>
        <div className="glass-panel-subtle p-3.5 rounded-2xl shadow-md">
          <span className="text-[11px] text-slate-400">Dòng Header quy định</span>
          <div className="text-xs font-bold text-emerald-400 mt-1">
            Row {currentRawTable ? currentRawTable.headerRowIndex + 1 : 1} (Index {currentRawTable ? currentRawTable.headerRowIndex : 0})
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Tự động căn lề theo chuẩn Shopee</span>
        </div>
        <div className="glass-panel-subtle p-3.5 rounded-2xl shadow-md">
          <span className="text-[11px] text-slate-400">Tổng số cột trích xuất</span>
          <div className="text-sm font-bold text-white mt-0.5">
            {currentRawTable ? currentRawTable.headers.length : 12} cột
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Bao gồm tỷ lệ %, doanh số VND</span>
        </div>
        <div className="glass-panel-subtle p-3.5 rounded-2xl shadow-md">
          <span className="text-[11px] text-slate-400">Trạng thái trích xuất</span>
          <div className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Chuẩn hoá 100%
          </div>
          <span className="text-[10px] text-emerald-400/80 block mt-0.5">Sẵn sàng phân tích sâu</span>
        </div>
      </div>

      {/* Raw Sheet Data Table */}
      <div className="glass-panel rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
          <div className="flex items-center space-x-2">
            <Table className="w-4 h-4 text-blue-400" />
            <h4 className="text-sm font-bold text-white">
              Dữ Liệu Chi Tiết: {activeSheet} ({filteredRows.length} dòng khớp)
            </h4>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm nội dung trong sheet..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="glass-input text-xs text-white pl-9 pr-3 py-1.5 rounded-xl border border-white/15 focus:outline-none focus:border-blue-400 w-full sm:w-64"
            />
          </div>
        </div>

        {currentRawTable && currentRawTable.headers.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-white/[0.1] text-slate-300 uppercase tracking-wider font-semibold bg-white/[0.02]">
                  <th className="py-3 px-3 text-center w-12 text-slate-400">#</th>
                  {currentRawTable.headers.map((h, i) => (
                    <th key={i} className="py-3 px-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {paginatedRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-white/[0.04] transition-colors">
                    <td className="py-3 px-3 text-center font-mono text-slate-400 text-[11px]">
                      {(currentPage - 1) * rowsPerPage + rIdx + 1}
                    </td>
                    {currentRawTable.headers.map((h, cIdx) => {
                      const val = row[h];
                      const isNumber = typeof val === 'number' || (!isNaN(parseFloat(val)) && typeof val === 'string' && /^\d+$/.test(val));
                      const isVND = String(h).toLowerCase().includes('doanh số') || String(h).toLowerCase().includes('doanh thu') || String(h).toLowerCase().includes('vnd');
                      const isPercent = String(h).toLowerCase().includes('tỷ lệ') || String(h).toLowerCase().includes('tỉ lệ') || String(h).toLowerCase().includes('ctr') || String(h).toLowerCase().includes('cr');

                      return (
                        <td
                          key={cIdx}
                          className={`py-3 px-3 ${
                            isVND
                              ? 'text-emerald-400 font-medium'
                              : isPercent
                              ? 'text-blue-300 font-semibold'
                              : 'text-slate-200'
                          }`}
                        >
                          {val !== undefined && val !== null && val !== '' ? String(val) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-white/[0.08] mt-4 text-xs text-slate-400">
                <span>
                  Trang {currentPage} / {totalPages} (Hiển thị {paginatedRows.length} / {filteredRows.length} dòng)
                </span>
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded-lg glass-panel-subtle text-slate-300 disabled:opacity-40 hover:text-white"
                  >
                    Trước
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded-lg glass-panel-subtle text-slate-300 disabled:opacity-40 hover:text-white"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Fallback table if sheet raw representation is loading */
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.1] text-slate-300 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3">Mã Đơn / SKU</th>
                  <th className="py-3 px-3">Tên Sản Phẩm / Kênh</th>
                  <th className="py-3 px-3 text-right">Lượt Xem / Click</th>
                  <th className="py-3 px-3 text-right">Số Lượng</th>
                  <th className="py-3 px-3 text-right">Doanh Thu (VND)</th>
                  <th className="py-3 px-3 text-center">Phân Loại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {data.abcProducts.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-white/[0.04] transition-colors">
                    <td className="py-3.5 px-3 font-mono text-slate-300">{p.sku}</td>
                    <td className="py-3.5 px-3 font-bold text-white">{p.name}</td>
                    <td className="py-3.5 px-3 text-right text-slate-300">{formatNumber(p.views)}</td>
                    <td className="py-3.5 px-3 text-right text-slate-100 font-medium">{formatNumber(p.orders)}</td>
                    <td className="py-3.5 px-3 text-right font-bold text-emerald-400">{formatVND(p.revenue)}</td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        Class {p.classification}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
