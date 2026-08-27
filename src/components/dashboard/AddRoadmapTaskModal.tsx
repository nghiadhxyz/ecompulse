import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  User,
  Users,
  Target,
  Flame,
  Clock,
  Briefcase,
  FileSpreadsheet,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { RoadmapActionItem } from '../../types';

interface AddRoadmapTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: RoadmapActionItem) => void;
  initialTask?: RoadmapActionItem | null;
  hasSheetsConnected?: boolean;
  language?: 'vi' | 'en';
}

const DEPARTMENTS = [
  'CSKH & Vận hành',
  'Ads & Marketing',
  'Livestream & Video',
  'Kho & Vận chuyển',
  'Quản lý Shop & Chiến Lược',
  'Thiết kế & Media',
  'Sản phẩm & Giá Bán',
  'Kế toán & Dòng Tiền',
];

export const AddRoadmapTaskModal: React.FC<AddRoadmapTaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
  hasSheetsConnected = false,
  language = 'vi',
}) => {
  const [action, setAction] = useState('');
  const [category, setCategory] = useState<'high' | 'medium' | 'long'>('high');
  const [department, setDepartment] = useState('CSKH & Vận hành');
  const [customDepartment, setCustomDepartment] = useState('');
  const [assignee, setAssignee] = useState('');
  const [deadline, setDeadline] = useState('');
  const [targetKpi, setTargetKpi] = useState('');
  const [kpiHighlight, setKpiHighlight] = useState('');
  const [currentBaseline, setCurrentBaseline] = useState('');
  const [targetGoal, setTargetGoal] = useState('');
  const [steps, setSteps] = useState<string[]>(['']);
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'completed'>('pending');
  const [syncToSheets, setSyncToSheets] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Populate data when opening or editing
  useEffect(() => {
    if (isOpen) {
      if (initialTask) {
        setAction(initialTask.action || '');
        setCategory(initialTask.category || 'high');
        if (DEPARTMENTS.includes(initialTask.department || '')) {
          setDepartment(initialTask.department || DEPARTMENTS[0]);
          setCustomDepartment('');
        } else if (initialTask.department) {
          setDepartment('custom');
          setCustomDepartment(initialTask.department);
        } else {
          setDepartment(DEPARTMENTS[0]);
          setCustomDepartment('');
        }
        setAssignee(initialTask.assignee || '');
        setDeadline(initialTask.deadline || '');
        setTargetKpi(initialTask.targetKpi || '');
        setKpiHighlight(initialTask.kpiHighlight || '');
        setCurrentBaseline(initialTask.currentBaseline || '');
        setTargetGoal(initialTask.targetGoal || '');
        setSteps(initialTask.details && initialTask.details.length > 0 ? initialTask.details : ['']);
        setStatus(initialTask.status || 'pending');
      } else {
        // Reset defaults
        setAction('');
        setCategory('high');
        setDepartment(DEPARTMENTS[0]);
        setCustomDepartment('');
        setAssignee('');
        setDeadline('');
        setTargetKpi('');
        setKpiHighlight('');
        setCurrentBaseline('');
        setTargetGoal('');
        setSteps(['']);
        setStatus('pending');
      }
      setError(null);
    }
  }, [isOpen, initialTask]);

  if (!isOpen) return null;

  const handleAddStep = () => {
    setSteps([...steps, '']);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length === 1) {
      setSteps(['']);
    } else {
      setSteps(steps.filter((_, i) => i !== index));
    }
  };

  const handleStepChange = (index: number, value: string) => {
    const nextSteps = [...steps];
    nextSteps[index] = value;
    setSteps(nextSteps);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!action.trim()) {
      setError('Vui lòng nhập tên đầu việc / hành động cần làm!');
      return;
    }
    if (!targetKpi.trim()) {
      setError('Vui lòng nhập mục tiêu hoặc chỉ số KPI theo dõi cho công việc này!');
      return;
    }

    const finalDept = department === 'custom' ? (customDepartment.trim() || 'Chung') : department;
    const cleanSteps = steps.map((s) => s.trim()).filter((s) => s.length > 0);

    const timeframeMap = {
      high: '0–2 tuần (Thực hiện ngay)',
      medium: '2–6 tuần (Tối ưu chuyển đổi)',
      long: '1–3 tháng (Chiến lược dài hạn)',
    };

    const categoryLabelMap = {
      high: 'Ưu tiên cao',
      medium: 'Ưu tiên trung bình',
      long: 'Ưu tiên dài hạn',
    };

    const categoryBadgeMap = {
      high: '0–2 tuần',
      medium: '2–6 tuần',
      long: '1–3 tháng',
    };

    const taskItem: RoadmapActionItem = {
      id: initialTask?.id || `custom-task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      category,
      categoryLabel: categoryLabelMap[category],
      categoryBadge: categoryBadgeMap[category],
      timeframe: timeframeMap[category],
      department: finalDept,
      action: action.trim(),
      targetKpi: targetKpi.trim(),
      kpiHighlight: kpiHighlight.trim() || undefined,
      currentBaseline: currentBaseline.trim() || undefined,
      targetGoal: targetGoal.trim() || undefined,
      details: cleanSteps.length > 0 ? cleanSteps : undefined,
      status,
      assignee: assignee.trim() || undefined,
      deadline: deadline.trim() || undefined,
      isCustom: true,
      updatedAt: new Date().toLocaleString('vi-VN'),
    };

    onSave(taskItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-[#0b0f19] border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-indigo-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                {initialTask ? 'Chỉnh Sửa Task Giao Việc' : 'Thêm Task Mới / Giao Việc Cho Nhân Viên'}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  Phân Quyền Quản Lý
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Tạo đầu việc cụ thể, gán nhân viên phụ trách và đồng bộ tự động sang Google Sheets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center space-x-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Action / Task Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <span>Tên Đầu Việc / Hành Động Cần Triển Khai</span>
              <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="Ví dụ: Gọi điện xác nhận 100% đơn COD trên 300.000đ trong vòng 15 phút đầu để giảm tỷ lệ hoàn hàng..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          {/* 2-Column: Priority Category & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priority Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <span>Cấp Độ Ưu Tiên & Thời Hạn</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="high" className="bg-slate-900 text-white">🔴 Ưu Tiên Cao (0–2 Tuần - Khẩn Cấp)</option>
                <option value="medium" className="bg-slate-900 text-white">🟡 Ưu Tiên Trung Bình (2–6 Tuần)</option>
                <option value="long" className="bg-slate-900 text-white">🟢 Ưu Tiên Dài Hạn (1–3 Tháng)</option>
              </select>
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>Bộ Phận / Nhóm Thực Thi</span>
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept} className="bg-slate-900 text-white">
                    {dept}
                  </option>
                ))}
                <option value="custom" className="bg-slate-900 text-white">➕ Tự nhập bộ phận khác...</option>
              </select>
            </div>
          </div>

          {department === 'custom' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Nhập tên bộ phận:</label>
              <input
                type="text"
                value={customDepartment}
                onChange={(e) => setCustomDepartment(e.target.value)}
                placeholder="Ví dụ: Team Livestream Ca Tối, Brand Manager..."
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* 2-Column: Assignee & Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Assignee */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Người Phụ Trách (Assignee)</span>
              </label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Tên nhân viên hoặc Email (VD: Hà Nghĩa, CSKH ca 1)..."
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Deadline */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Hạn Chót Hoàn Thành (Deadline)</span>
              </label>
              <input
                type="text"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                placeholder="VD: 31/08/2026 hoặc Hàng ngày lúc 18h..."
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* 2-Column: KPI Target & Highlight Badge */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mục Tiêu & Chỉ Số KPI Đo Lường</span>
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={targetKpi}
                onChange={(e) => setTargetKpi(e.target.value)}
                placeholder="VD: Giảm tỷ lệ hủy COD từ 30% xuống dưới 15%..."
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200">
                Badge KPI Ngắn Gọn
              </label>
              <input
                type="text"
                value={kpiHighlight}
                onChange={(e) => setKpiHighlight(e.target.value)}
                placeholder="VD: Hủy COD < 15%"
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* 2-Column: Baseline & Target Goal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                📌 Hiện trạng số liệu (Baseline - Tùy chọn)
              </label>
              <input
                type="text"
                value={currentBaseline}
                onChange={(e) => setCurrentBaseline(e.target.value)}
                placeholder="VD: Hiện tại: Chi phí ads chiếm 15% doanh thu"
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                🎯 Kỳ vọng đạt được (Target Goal - Tùy chọn)
              </label>
              <input
                type="text"
                value={targetGoal}
                onChange={(e) => setTargetGoal(e.target.value)}
                placeholder="VD: Kỳ vọng: Cứu 5.000.000đ doanh thu rò rỉ"
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Execution Steps */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200">
                Các Bước Triển Khai Cụ Thể (Checklist hướng dẫn nhân viên):
              </label>
              <button
                type="button"
                onClick={handleAddStep}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm bước</span>
              </button>
            </div>

            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-400 min-w-[50px]">
                    Bước {idx + 1}:
                  </span>
                  <input
                    type="text"
                    value={step}
                    onChange={(e) => handleStepChange(idx, e.target.value)}
                    placeholder={`Nội dung bước ${idx + 1}...`}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Xóa bước này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Status Selection */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-slate-200">Trạng Thái Ban Đầu:</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="taskStatus"
                  value="pending"
                  checked={status === 'pending'}
                  onChange={() => setStatus('pending')}
                  className="accent-indigo-500"
                />
                <span>📋 Cần làm (Pending)</span>
              </label>
              <label className="flex items-center space-x-2 text-xs text-amber-300 cursor-pointer">
                <input
                  type="radio"
                  name="taskStatus"
                  value="in_progress"
                  checked={status === 'in_progress'}
                  onChange={() => setStatus('in_progress')}
                  className="accent-amber-500"
                />
                <span>⏳ Đang thực hiện</span>
              </label>
              <label className="flex items-center space-x-2 text-xs text-emerald-300 cursor-pointer">
                <input
                  type="radio"
                  name="taskStatus"
                  value="completed"
                  checked={status === 'completed'}
                  onChange={() => setStatus('completed')}
                  className="accent-emerald-500"
                />
                <span>✅ Đã hoàn thành</span>
              </label>
            </div>
          </div>

          {/* Google Sheets Live Link Info Banner */}
          {hasSheetsConnected && (
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Google Sheets đang kết nối: Task này sẽ được tự động đồng bộ ngay lập tức!</span>
              </div>
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
          )}

          {/* Buttons Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-rose-500 hover:from-indigo-500 hover:to-rose-400 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{initialTask ? 'Lưu Thay Đổi' : 'Tạo & Giao Việc'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
