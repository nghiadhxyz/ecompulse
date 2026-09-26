import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  HardDrive,
  Cpu,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  Server,
  Key,
  Database,
  ExternalLink,
  HelpCircle,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import {
  exportOnPremiseBackup,
  importOnPremiseBackup,
  wipeAllLocalData,
} from '../../utils/localDatabaseService';
import {
  getSavedAiPrivacyMode,
  setSavedAiPrivacyMode,
  getSavedLocalLlmUrl,
  setSavedLocalLlmUrl,
  getSavedCustomApiKey,
  setSavedCustomApiKey,
  AiPrivacyMode,
} from '../../utils/dataAnonymizer';

interface OnPremiseSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  language?: 'vi' | 'en';
}

export const OnPremiseSecurityModal: React.FC<OnPremiseSecurityModalProps> = ({
  isOpen,
  onClose,
  userId = 'local-user',
  language = 'vi',
}) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'data' | 'ai'>('audit');
  const [aiMode, setAiMode] = useState<AiPrivacyMode>(getSavedAiPrivacyMode());
  const [apiKeyInput, setApiKeyInput] = useState<string>(getSavedCustomApiKey());
  const [localLlmUrl, setLocalLlmUrl] = useState<string>(getSavedLocalLlmUrl());
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isWiping, setIsWiping] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAiMode(getSavedAiPrivacyMode());
      setApiKeyInput(getSavedCustomApiKey());
      setLocalLlmUrl(getSavedLocalLlmUrl());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setStatusMsg(null);
    try {
      const blob = await exportOnPremiseBackup(userId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EcomPulse_OnPremise_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMsg({
        type: 'success',
        text: language === 'vi' ? 'Đã xuất file sao lưu On-Premise (.json) thành công về máy!' : 'Backup exported successfully!',
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Lỗi khi xuất sao lưu.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMsg(null);
    try {
      const text = await file.text();
      const res = await importOnPremiseBackup(userId, text);
      if (res.success) {
        setStatusMsg({ type: 'success', text: res.message });
      } else {
        setStatusMsg({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Không thể đọc file sao lưu JSON.' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleWipeData = async () => {
    const confirmMsg = language === 'vi'
      ? 'CẢNH BÁO BẢO MẬT: Thao tác này sẽ xóa vĩnh viễn toàn bộ dữ liệu báo cáo, lộ trình và lịch sử chat khỏi trình duyệt máy trạm của bạn. Bạn có chắc chắn muốn xóa?'
      : 'SECURITY WARNING: This will permanently wipe all reports, roadmap tasks, and chat history from this browser. Are you sure?';

    if (window.confirm(confirmMsg)) {
      setIsWiping(true);
      await wipeAllLocalData();
      setIsWiping(false);
      setStatusMsg({
        type: 'success',
        text: language === 'vi' ? 'Đã xóa sạch 100% dữ liệu trên máy trạm. Ứng dụng sẽ tự tải lại...' : 'Data wiped. Reloading...',
      });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  const handleSaveAiSettings = () => {
    setSavedAiPrivacyMode(aiMode);
    setSavedCustomApiKey(apiKeyInput.trim());
    setSavedLocalLlmUrl(localLlmUrl.trim());
    setStatusMsg({
      type: 'success',
      text: language === 'vi' ? 'Đã lưu cấu hình Quyền Riêng Tư AI thành công!' : 'AI Privacy settings saved!',
    });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900/95 border border-emerald-500/30 rounded-3xl shadow-2xl shadow-emerald-500/10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header with Security Status */}
        <div className="p-6 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-b border-emerald-500/20 flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {language === 'vi' ? 'Trung Tâm Bảo Mật On-Premise' : 'On-Premise Security & Privacy Center'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  100% Client-Side Isolated
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {language === 'vi'
                  ? 'Dữ liệu kinh doanh và báo cáo Excel tuyệt đối không rời khỏi máy tính của bạn'
                  : 'Business data and Excel sheets strictly remain within your local workstation'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-slate-950/40 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'audit'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{language === 'vi' ? 'Kiểm Toán Bảo Mật' : 'Privacy Audit'}</span>
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'data'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>{language === 'vi' ? 'Quản Trị Dữ Liệu Nội Bộ' : 'Local Data Controls'}</span>
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'ai'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>{language === 'vi' ? 'Quyền Riêng Tư AI (BYOK/Offline)' : 'AI Privacy & BYOK'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {statusMsg && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-center space-x-2.5 border backdrop-blur-md ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* TAB 1: AUDIT */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">Kiến trúc Local-First:</span>
                  <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                    EcomPulse được thiết kế theo nguyên lý <strong>Local-First</strong>. File Excel, dòng đơn hàng và lịch sử phân tích được lưu trong trình duyệt trên máy này và không tự động tải lên máy chủ EcomPulse. Nếu bạn bật <strong>Cloud AI</strong> (Cài đặt → Quyền riêng tư AI), số liệu tổng hợp đã ẩn danh sẽ được gửi tới máy chủ EcomPulse và Google Gemini khi bạn dùng tính năng AI.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                    <Cpu className="w-4 h-4" />
                    <span>1. In-Browser RAM Parsing</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Đọc và phân tích toán học các file Excel (Shopee, TikTok Shop) 100% trong bộ nhớ RAM trình duyệt qua thư viện JS nội bộ. Không gửi file lên server.
                  </p>
                  <div className="text-[10px] text-emerald-400 font-semibold">● Trạng thái: Hoạt động (Được bảo vệ)</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                    <HardDrive className="w-4 h-4" />
                    <span>2. Local IndexedDB Storage</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Báo cáo đã lưu, lộ trình công việc (Roadmap) và lịch sử trò chuyện được lưu cục bộ trong cơ sở dữ liệu IndexedDB của trình duyệt máy này.
                  </p>
                  <div className="text-[10px] text-emerald-400 font-semibold">● Trạng thái: Hoạt động (Được bảo vệ)</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                    <EyeOff className="w-4 h-4" />
                    <span>3. PII Data Anonymization</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Bộ lọc nội bộ tự động che và loại bỏ số điện thoại, tên khách hàng và thông tin nhận diện trước bất kỳ tương tác phân tích nào.
                  </p>
                  <div className="text-[10px] text-emerald-400 font-semibold">● Trạng thái: Hoạt động (Được bảo vệ)</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                    <Server className="w-4 h-4" />
                    <span>4. Zero Telemetry & Cloud Logs</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Không có mã theo dõi bên thứ ba, không Google Analytics, không lưu trữ cơ sở dữ liệu trên cloud của nhà phát triển.
                  </p>
                  <div className="text-[10px] text-emerald-400 font-semibold">● Trạng thái: Hoạt động (Được bảo vệ)</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOCAL DATA CONTROLS */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>Xuất Bản Sao Lưu Dữ Liệu (.json)</span>
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Tải về toàn bộ báo cáo, bảng lộ trình công việc và lịch sử trò chuyện dưới dạng file JSON mã hóa lưu trữ an toàn trên máy bạn.
                    </p>
                  </div>
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center space-x-1.5 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isExporting ? 'Đang xuất...' : 'Tải File Backup'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Upload className="w-4 h-4 text-blue-400" />
                      <span>Khôi Phục Dữ Liệu Từ File Sao Lưu</span>
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Nạp lại các báo cáo và lộ trình từ file backup JSON đã xuất trước đó vào máy trạm này.
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center space-x-1.5 transition-all shadow-lg shadow-blue-500/20 shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Chọn File Backup</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportFile}
                    accept=".json"
                    className="hidden"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-rose-300 flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>Xóa Sạch 100% Dữ Liệu Khỏi Máy (Zero-Trace Wipe)</span>
                    </h4>
                    <p className="text-[11px] text-rose-300/80 mt-0.5">
                      Xóa toàn bộ IndexedDB, LocalStorage và phiên làm việc trên trình duyệt này để bảo mật tuyệt đối khi dùng máy tính chung.
                    </p>
                  </div>
                  <button
                    onClick={handleWipeData}
                    disabled={isWiping}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center space-x-1.5 transition-all shadow-lg shadow-rose-500/20 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isWiping ? 'Đang xóa...' : 'Xóa Sạch Dữ Liệu'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI PRIVACY & BYOK */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="text-xs font-bold text-white block">
                  Chọn Chế Độ Vận Hành Phân Tích & AI:
                </label>

                {/* Option 1: BYOK Gemini Key */}
                <div
                  onClick={() => setAiMode('byok_gemini')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    aiMode === 'byok_gemini'
                      ? 'bg-blue-500/15 border-blue-400 shadow-md shadow-blue-500/20'
                      : 'bg-slate-950/40 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Key className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-white">
                        Khóa Cá Nhân BYOK (Bring Your Own Key - Gemini)
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-400/30">
                      Khuyến Nghị
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Sử dụng API Key Gemini của chính bạn. Yêu cầu phân tích gửi trực tiếp từ máy bạn đến Google Cloud AI bằng khóa riêng, không qua server trung gian.
                  </p>

                  {aiMode === 'byok_gemini' && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-blue-400/20" onClick={(e) => e.stopPropagation()}>
                      <label className="text-[11px] font-semibold text-blue-300 block">
                        Nhập Gemini API Key của bạn:
                      </label>
                      <input
                        type="password"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-blue-400/40 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Lưu trữ mã hóa độc quyền trong LocalStorage máy bạn.</span>
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1"
                        >
                          Lấy Key miễn phí tại Google AI Studio <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Option 2: 100% Offline Rule-Based Engine */}
                <div
                  onClick={() => setAiMode('offline_rule_based')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    aiMode === 'offline_rule_based'
                      ? 'bg-emerald-500/15 border-emerald-400 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-950/40 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white">
                        100% Ngoại Tuyến (Offline Mathematical Rule-Based Engine)
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
                      Zero-Network
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Không gọi bất kỳ API bên ngoài nào. Toàn bộ 7 trụ cột, đánh giá thất thoát COD, phân loại ABC SKU và thẻ hành động được tính toán 100% bằng thuật toán toán học nội bộ trên máy.
                  </p>
                </div>

                {/* Option 3: Local LLM (Ollama / On-Premise Endpoint) */}
                <div
                  onClick={() => setAiMode('local_ollama')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    aiMode === 'local_ollama'
                      ? 'bg-purple-500/15 border-purple-400 shadow-md shadow-purple-500/20'
                      : 'bg-slate-950/40 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Server className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold text-white">
                        Local LLM On-Premise (Ollama / vLLM / LM Studio)
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-400/30">
                      Air-Gapped LLM
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Kết nối trực tiếp tới máy chủ AI nội bộ trong mạng LAN doanh nghiệp của bạn (Ví dụ: Llama 3 / Qwen chạy trên Ollama máy chủ riêng).
                  </p>

                  {aiMode === 'local_ollama' && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-purple-400/20" onClick={(e) => e.stopPropagation()}>
                      <label className="text-[11px] font-semibold text-purple-300 block">
                        Địa chỉ Local LLM Endpoint:
                      </label>
                      <input
                        type="text"
                        value={localLlmUrl}
                        onChange={(e) => setLocalLlmUrl(e.target.value)}
                        placeholder="http://localhost:11434"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-purple-400/40 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveAiSettings}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all shadow-lg shadow-emerald-500/20"
                >
                  Lưu Cấu Hình Quyền Riêng Tư AI
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/60 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px]">Bảo mật On-Premise: Dữ liệu thuộc quyền sở hữu 100% của bạn</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
