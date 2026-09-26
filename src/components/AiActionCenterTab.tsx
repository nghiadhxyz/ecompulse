import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import {
  Sparkles,
  CheckSquare,
  Square,
  AlertOctagon,
  TrendingUp,
  Sliders,
  Send,
  Bot,
  User,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  Flame,
  ShieldAlert,
  Download,
  ListTodo,
  Percent,
  DollarSign,
  FileSpreadsheet,
  ExternalLink,
  Link,
  Users,
  CheckCircle2,
  Clock,
  Plus,
  ChevronDown,
  Zap,
  Brain,
  Wand2,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { cloudAiPost, aiChat, unavailableMessage } from '../utils/aiClient';
import { blockedMessage, cloudAiAllowed } from '../utils/aiPrivacy';
import {
  ParsedStoreData,
  ActionCard,
  ChatMessage,
  SimulationParams,
  SimulationResult,
  GoogleSheetsSyncConfig,
  RoadmapActionItem,
} from '../types';
import { formatVND, formatNumber, formatPercent } from '../utils/formatters';
import { runWhatIfSimulation } from '../utils/analyticsEngine';
import dolphinAiAvatar from '../assets/images/dolphin_ai_avatar_1787721342181.jpg';
import { AiAssessment7Pillars } from './dashboard/AiAssessment7Pillars';
import { BusinessActionRoadmap } from './dashboard/BusinessActionRoadmap';
import { GoogleSheetsActionSyncModal } from './dashboard/GoogleSheetsActionSyncModal';
import {
  getSavedSheetsConfig,
  saveSheetsConfig,
  getSavedGoogleUser,
  autoGenerateAndOpenGoogleSheet,
} from '../utils/googleSheetsService';
import {
  saveDatasetToFirestore,
  saveChatMessageToFirestore,
} from '../utils/firebaseService';
import { anonymizeStoreDataForAI, getSavedAiPrivacyMode } from '../utils/dataAnonymizer';

interface AiActionCenterTabProps {
  data: ParsedStoreData;
  language: 'vi' | 'en';
}

export const AiActionCenterTab: React.FC<AiActionCenterTabProps> = ({
  data,
  language,
}) => {
  // Phase 2 State
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);

  const [actionCards, setActionCards] = useState<ActionCard[]>([]);
  const [isActionsLoading, setIsActionsLoading] = useState<boolean>(false);
  const [copiedChecklist, setCopiedChecklist] = useState<boolean>(false);

  // Google Sheets Integration State
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsSyncConfig | null>(getSavedSheetsConfig());
  const [isSheetsLoading, setIsSheetsLoading] = useState<boolean>(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState<boolean>(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<string | null>(null);
  const [activeAssigneeFilter, setActiveAssigneeFilter] = useState<string>('all');
  const [roadmapItems, setRoadmapItems] = useState<RoadmapActionItem[]>([]);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: language === 'vi'
        ? `Xin chào! Tôi là Trợ Lý Phân Tích Dữ Liệu (Dolphin AI). Toàn bộ số liệu từ file ${data.fileName} đã được nạp sẵn. Bạn muốn phân tích sâu về điểm rò rỉ doanh thu, hiệu quả kênh hay tối ưu quảng cáo?`
        : `Hello! I am your Dolphin AI Data Analyst. All data from ${data.fileName} is parsed. What would you like to explore regarding leakage, channels, or ad performance?`,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.7-flash-high');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState<boolean>(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState<boolean>(false);

  // Custom Gemini API Key Management
  const [apiKey, setApiKey] = useState<string>(() => {
    const saved = localStorage.getItem('gemini_custom_api_key') || '';
    // Filter out old invalid test string if present
    if (saved.startsWith('AQ.')) {
      localStorage.removeItem('gemini_custom_api_key');
      return '';
    }
    return saved;
  });
  const [tempApiKey, setTempApiKey] = useState<string>(apiKey);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [showKeyPassword, setShowKeyPassword] = useState<boolean>(false);
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
  const [testKeyStatus, setTestKeyStatus] = useState<{ ok?: boolean; message?: string } | null>(null);
  const [isKeySavedSuccess, setIsKeySavedSuccess] = useState<boolean>(false);

  // Available AI Models Configuration
  const availableModels = [
    {
      id: 'gemini-3.7-flash-high',
      apiModel: 'gemini-3.7-flash',
      label: 'Gemini 3.7 Flash High',
      badge: 'Mặc định • Thinking Sâu',
      desc: 'Phân tích đa chiều, bóc tách dòng tiền & logic chiến lược chuyên sâu',
      badgeColor: 'text-amber-300 bg-amber-500/20 border-amber-400/30',
      speed: 'Rất nhanh',
      reasoning: 'Tối ưu',
    },
    {
      id: 'gemini-3.7-flash',
      apiModel: 'gemini-3.7-flash',
      label: 'Gemini 3.7 Flash',
      badge: 'Tốc độ cao • Chuẩn xác',
      desc: 'Phản hồi cực nhanh cho tra cứu số liệu và câu hỏi ngắn gọn',
      badgeColor: 'text-cyan-300 bg-cyan-500/20 border-cyan-400/30',
      speed: 'Siêu tốc',
      reasoning: 'Chuẩn',
    },
    {
      id: 'gemini-3.5-flash',
      apiModel: 'gemini-3.5-flash',
      label: 'Gemini 3.5 Flash',
      badge: 'Cân bằng • Tiết kiệm',
      desc: 'Mô hình thế hệ 3.5 tiêu chuẩn cân bằng hiệu năng và token',
      badgeColor: 'text-emerald-300 bg-emerald-500/20 border-emerald-400/30',
      speed: 'Nhanh',
      reasoning: 'Cơ bản',
    },
  ];

  const currentModelObj = availableModels.find((m) => m.id === selectedModel) || availableModels[0];

  // Simulator State
  const [simParams, setSimParams] = useState<SimulationParams>({
    priceDelta: 0,
    voucherPercent: 5,
    adSpendDelta: 15,
    conversionBoost: 5,
  });
  const [simResult, setSimResult] = useState<SimulationResult>(
    runWhatIfSimulation(data.kpis, {
      priceDelta: 0,
      voucherPercent: 5,
      adSpendDelta: 15,
      conversionBoost: 5,
    })
  );
  const [aiSimAnalysis, setAiSimAnalysis] = useState<string>('');
  const [isSimLoading, setIsSimLoading] = useState<boolean>(false);

  // Fetch initial AI Summary & Action Cards
  useEffect(() => {
    fetchExecutiveSummary();
    fetchActionCards();
  }, [data.datasetId, language]);

  // Recalculate simulation whenever params or data change
  useEffect(() => {
    const res = runWhatIfSimulation(data.kpis, simParams);
    setSimResult(res);
  }, [simParams, data.kpis]);

  const fetchExecutiveSummary = async (customKey?: string) => {
    setIsSummaryLoading(true);
    try {
      if (!cloudAiAllowed()) {
        setExecutiveSummary(blockedMessage(language));
        return;
      }
      const anonymized = anonymizeStoreDataForAI(data);
      const resJson = await cloudAiPost<{ summary?: string; isFallback?: boolean }>('/api/ai/executive-summary', {
        analyticsData: anonymized,
        language,
        apiKey: customKey || apiKey || undefined,
      });
      // Server fallbacks are templates, not analysis — never shown as an AI answer.
      setExecutiveSummary(resJson && !resJson.isFallback && resJson.summary ? resJson.summary : unavailableMessage(language));
    } catch (err) {
      console.error('Failed to fetch AI executive summary', err);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const fetchActionCards = async (customKey?: string) => {
    setIsActionsLoading(true);
    try {
      if (!cloudAiAllowed()) {
        setActionCards([]);
        return;
      }
      const anonymized = anonymizeStoreDataForAI(data);
      const resJson = await cloudAiPost<{ actionCards?: typeof actionCards; isFallback?: boolean }>('/api/ai/action-center', {
        analyticsData: anonymized,
        language,
        apiKey: customKey || apiKey || undefined,
      });
      if (resJson && !resJson.isFallback && resJson.actionCards && resJson.actionCards.length > 0) {
        setActionCards(resJson.actionCards);
        
        // Auto-save snapshot report to On-Premise Local Storage
        const user = getSavedGoogleUser();
        const userId = user?.id || user?.email || 'local-user';
        saveDatasetToFirestore(userId, {
          fileName: data.fileName,
          platform: data.fileName.toLowerCase().includes('tiktok') ? 'tiktok' : 'shopee',
          kpis: data.kpis,
          executiveSummary,
          actionCards: resJson.actionCards,
        });
      }
    } catch (err) {
      console.error('Failed to fetch AI action cards', err);
    } finally {
      setIsActionsLoading(false);
    }
  };

  // Save custom API key
  const handleSaveApiKey = () => {
    const cleanKey = tempApiKey.trim();
    setApiKey(cleanKey);
    localStorage.setItem('gemini_custom_api_key', cleanKey);
    setIsKeySavedSuccess(true);
    setTimeout(() => setIsKeySavedSuccess(false), 2500);
    setShowApiKeyModal(false);
    fetchExecutiveSummary(cleanKey);
    fetchActionCards(cleanKey);
  };

  // Test custom API Key
  const handleTestApiKey = async () => {
    setIsTestingKey(true);
    setTestKeyStatus(null);
    try {
      const res = await fetch('/api/ai/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: tempApiKey.trim() }),
      });
      const resData = await res.json();
      if (resData.ok) {
        setTestKeyStatus({ ok: true, message: 'Khóa API hoạt động chính xác và phản hồi tốt!' });
      } else {
        setTestKeyStatus({ ok: false, message: resData.error || 'Khóa API không hợp lệ' });
      }
    } catch (err: any) {
      setTestKeyStatus({ ok: false, message: 'Lỗi kết nối kiểm tra API Key' });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Google Sheets Handlers
  const handleSyncToSheets = async () => {
    setIsSheetsModalOpen(true);
  };

  const handleQuickAutoGenerateSheet = () => {
    const newConfig = autoGenerateAndOpenGoogleSheet(roadmapItems, actionCards, data.fileName);
    setSheetsConfig(newConfig);
    try {
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.7 } });
    } catch (_) {}
  };

  // Toggle Todo checkbox
  const toggleTodo = (cardId: string, todoId: string) => {
    const updated = actionCards.map((c) => {
      if (c.id === cardId) {
        const newTodos = c.todos.map((t) =>
          t.id === todoId ? { ...t, done: !t.done, completedAt: !t.done ? new Date().toLocaleString('vi-VN') : undefined } : t
        );
        if (newTodos.every((t) => t.done)) {
          try {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.7 },
            });
          } catch (e) {}
        }
        return { ...c, todos: newTodos, updatedAt: new Date().toLocaleString('vi-VN') };
      }
      return c;
    });
    setActionCards(updated);

    if (sheetsConfig?.spreadsheetId && sheetsConfig.autoSync) {
      handleSyncToSheets();
    }
  };

  const updateCardAssignee = (cardId: string, assignee: string) => {
    const updated = actionCards.map((c) => (c.id === cardId ? { ...c, assignee, updatedAt: new Date().toLocaleString('vi-VN') } : c));
    setActionCards(updated);
    if (sheetsConfig?.spreadsheetId && sheetsConfig.autoSync) {
      handleSyncToSheets();
    }
  };

  // Send Chat message
  const [thinkingStage, setThinkingStage] = useState<string>('Đang đọc dữ liệu từ các sheet...');

  const handleSendMessage = async (customText?: string) => {
    const text = customText || chatInput;
    if (!text.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);
    setThinkingStage('Đang đọc ma trận dữ liệu & các sheet phân tích...');

    const startTime = Date.now();

    // Rotate thinking messages to make it feel super authentic
    const t1 = setTimeout(() => {
      setThinkingStage('Đang trích xuất dẫn chứng số liệu & đối soát phễu...');
    }, 600);

    const t2 = setTimeout(() => {
      setThinkingStage('Đang tổng hợp định hướng chiến lược & lập luận...');
    }, 1200);

    try {
      const reply = await aiChat({
        message: text,
        history: chatMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        analyticsData: anonymizeStoreDataForAI(data),
        language,
        model: currentModelObj.apiModel,
        apiKey: apiKey || undefined,
      });
      const resJson = { reply: reply.text };

      // Enforce realistic thinking delay of at least 1.5 seconds (1500ms)
      const elapsed = Date.now() - startTime;
      if (elapsed < 1500) {
        await new Promise((resolve) => setTimeout(resolve, 1500 - elapsed));
      }

      const assistantMsg: ChatMessage = {
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        content: resJson.reply || 'Đã phân tích xong dữ liệu của shop.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);

      // Save to On-Premise Local Storage
      const user = getSavedGoogleUser();
      const userId = user?.id || user?.email || 'local-user';
      saveChatMessageToFirestore(userId, { role: 'user', content: text });
      saveChatMessageToFirestore(userId, { role: 'assistant', content: assistantMsg.content });
    } catch (err) {
      console.error('Chat error', err);
      const errorAssistantMsg: ChatMessage = {
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        content: 'Không thể kết nối đến máy chủ phân tích. Vui lòng kiểm tra lại kết nối mạng!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorAssistantMsg]);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setIsChatLoading(false);
    }
  };

  // Run AI Simulator analysis
  const handleRunAiSimulatorAnalysis = async () => {
    setIsSimLoading(true);
    try {
      if (!cloudAiAllowed()) {
        setAiSimAnalysis(blockedMessage(language));
        return;
      }
      const res = await fetch('/api/ai/simulate-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulationParams: {
            ...simParams,
            projectedRevenue: simResult.projectedRevenue,
            projectedMargin: simResult.projectedMargin,
            breakEvenRoas: simResult.breakEvenRoas,
          },
          currentMetrics: {
            paidRevenue: data.kpis.paidRevenue,
            aov: data.kpis.aov,
            paidOrders: data.kpis.paidOrders,
            cr: data.kpis.conversionRate,
          },
          language,
          apiKey,
        }),
      });
      const resJson = await res.json();
      setAiSimAnalysis(!resJson.isFallback && resJson.analysis ? resJson.analysis : unavailableMessage(language));
    } catch (err) {
      console.error('Sim error', err);
    } finally {
      setIsSimLoading(false);
    }
  };

  // Copy Action Plan to clipboard
  const handleCopyChecklist = () => {
    const text = actionCards
      .map(
        (c) =>
          `[${c.urgency.toUpperCase()}] ${c.title} (Ước tính: ${c.estimatedImpact})\n${c.description}\n` +
          c.todos
            .map((t) => `  ${t.done ? '[x]' : '[ ]'} ${t.text}`)
            .join('\n')
      )
      .join('\n\n');

    navigator.clipboard.writeText(text);
    setCopiedChecklist(true);
    setTimeout(() => setCopiedChecklist(false), 2500);
  };

  const totalTodosCount = actionCards.reduce((acc, c) => acc + c.todos.length, 0);
  const doneTodosCount = actionCards.reduce(
    (acc, c) => acc + c.todos.filter((t) => t.done).length,
    0
  );
  const todoProgressPercent =
    totalTodosCount > 0 ? Math.round((doneTodosCount / totalTodosCount) * 100) : 0;

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Hệ Thống Đánh Giá & Thẩm Định Toàn Diện Bằng AI (7 Trụ Cột) */}
      <AiAssessment7Pillars
        data={data}
        language={language}
        onReEvaluate={() => {
          fetchExecutiveSummary();
          fetchActionCards();
        }}
        isEvaluating={isSummaryLoading || isActionsLoading}
      />

      {/* 2. Đề Xuất Hành Động Cho Doanh Nghiệp (Strategic Action Roadmap: 0-2w, 2-6w, 1-3m) */}
      <BusinessActionRoadmap
        data={data}
        language={language}
        sheetsConfig={sheetsConfig}
        onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
        onConfigChange={(newConfig) => setSheetsConfig(newConfig)}
        onSyncSheets={() => handleSyncToSheets()}
        isSyncing={isSyncing}
        onRoadmapChange={(items) => setRoadmapItems(items)}
      />

      {/* 3. Trung Tâm Hành Động Ưu Tiên (Prioritized Action Center with To-Do Cards & Google Sheets Sync) */}
      <div className="glass-panel rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-white/[0.08] gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <ListTodo className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-bold text-white">
                Trung Tâm Hành Động Ưu Tiên
              </h3>
            </div>
            <p className="text-xs text-slate-300/80 mt-0.5">
              Chuyển hóa dữ liệu rò rỉ thành các đầu việc (To-Do list) cụ thể và liên kết trực tiếp sang Google Sheets cho nhóm bán hàng
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Progress Pill */}
            <div className="glass-panel-subtle px-3 py-1.5 rounded-xl flex items-center space-x-2 text-xs">
              <span className="text-slate-300">Tiến độ:</span>
              <strong className="text-emerald-400 font-bold">
                {doneTodosCount}/{totalTodosCount} việc ({todoProgressPercent}%)
              </strong>
            </div>

            {/* Google Sheets Status & Connect Button */}
            {sheetsConfig ? (
              <div className="flex items-center gap-2">
                <a
                  href={sheetsConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 transition-all shadow-sm group"
                  title="Mở bảng tính Google Sheets để cả nhóm cùng theo dõi"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="max-w-[130px] truncate">Mở Google Sheet</span>
                  <ExternalLink className="w-3 h-3 text-emerald-400/80" />
                </a>

                <button
                  type="button"
                  onClick={() => handleSyncToSheets()}
                  disabled={isSyncing}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 border border-white/[0.12] flex items-center gap-1.5 transition-all"
                  title="Đồng bộ lại toàn bộ trạng thái sang Google Sheets"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSheetsModalOpen(true)}
                  className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white border border-white/[0.1] transition-all text-xs"
                  title="Cài đặt kết nối Google Sheets"
                >
                  <Link className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleQuickAutoGenerateSheet}
                  className="text-xs font-black px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 hover:scale-[1.02] active:scale-95"
                  title="1-Click Tự động xuất việc cần làm sang Google Sheet & tải file Excel (.xlsx)"
                >
                  <Zap className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
                  <span>Xuất Google Sheet (1-Click)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSheetsModalOpen(true)}
                  className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white border border-white/[0.1] transition-all text-xs"
                  title="Tùy chọn nâng cao / Nhập link Google Sheet"
                >
                  <Link className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Copy Button */}
            <button
              onClick={handleCopyChecklist}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 border border-white/[0.15] flex items-center gap-1.5 transition-all backdrop-blur-md"
            >
              {copiedChecklist ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Đã sao chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                  <span>Sao chép To-Do</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sync status toast bar when connected */}
        {sheetsConfig && (
          <div className="mt-3 py-2 px-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2 text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Đang liên kết: <strong className="text-white">{sheetsConfig.spreadsheetTitle}</strong>
              </span>
              {sheetsConfig.lastSyncedAt && (
                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" /> Đồng bộ lúc {sheetsConfig.lastSyncedAt}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3 text-[11px]">
              <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={sheetsConfig.autoSync}
                  onChange={(e) => {
                    const updated = { ...sheetsConfig, autoSync: e.target.checked };
                    setSheetsConfig(updated);
                    saveSheetsConfig(updated);
                  }}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-400 w-3.5 h-3.5"
                />
                <span>Tự động cập nhật sang Sheet khi xong việc</span>
              </label>

              {lastSyncStatus && (
                <span className="text-emerald-400 font-semibold animate-pulse">
                  ⚡ {lastSyncStatus}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Cards List */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {actionCards.map((card) => {
            const isRed = card.urgency === 'red';
            const isYellow = card.urgency === 'yellow';

            return (
              <div
                key={card.id}
                id={`action-card-${card.id}`}
                className={`rounded-2xl p-4.5 border flex flex-col justify-between transition-all backdrop-blur-xl shadow-lg ${
                  isRed
                    ? 'bg-rose-950/25 border-rose-500/30 hover:border-rose-400/50'
                    : isYellow
                    ? 'bg-amber-950/25 border-amber-500/30 hover:border-amber-400/50'
                    : 'bg-emerald-950/25 border-emerald-500/30 hover:border-emerald-400/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm ${
                        isRed
                          ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                          : isYellow
                          ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                          : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                      }`}
                    >
                      {isRed ? '🔴 Cứu doanh thu' : isYellow ? '🟡 Cơ hội tăng trưởng' : '🟢 Tăng AOV'}
                    </span>
                    <span className="text-xs font-black text-emerald-300 bg-white/[0.08] px-2.5 py-0.5 rounded-full border border-white/[0.12] backdrop-blur-md">
                      {card.estimatedImpact}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white mt-3">
                    {card.title}
                  </h4>
                  <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                    {card.description}
                  </p>

                  {/* Assignee / Role Selector */}
                  <div className="mt-3 flex items-center justify-between text-[11px] bg-white/[0.04] p-2 rounded-xl border border-white/[0.06]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Users className="w-3 h-3 text-sky-400" /> Phụ trách:
                    </span>
                    <select
                      value={card.assignee || 'Toàn bộ Team Bán Hàng'}
                      onChange={(e) => updateCardAssignee(card.id, e.target.value)}
                      className="bg-slate-900 border border-white/20 text-white rounded-lg px-2 py-0.5 text-[11px] focus:outline-none focus:border-emerald-400 cursor-pointer"
                    >
                      <option value="Toàn bộ Team Bán Hàng">Toàn bộ Team Bán Hàng</option>
                      <option value="Leader Ads & Marketing">Leader Ads & Marketing</option>
                      <option value="CSKH & Xác Nhận Đơn">CSKH & Xác Nhận Đơn</option>
                      <option value="Content & Livestream">Content & Livestream</option>
                      <option value="Quản Lý Kho & Vận Hành">Quản Lý Kho & Vận Hành</option>
                    </select>
                  </div>

                  {/* To-Do Checklist */}
                  <div className="mt-3 space-y-2 pt-3 border-t border-white/[0.08]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block mb-1">
                      Checklist việc cần làm:
                    </span>
                    {card.todos.map((todo) => (
                      <div
                        key={todo.id}
                        onClick={() => toggleTodo(card.id, todo.id)}
                        className={`flex items-start space-x-2.5 p-2 rounded-xl text-xs cursor-pointer select-none transition-all ${
                          todo.done
                            ? 'bg-white/[0.03] text-slate-400 line-through border border-transparent'
                            : 'glass-panel-subtle text-slate-100 hover:bg-white/[0.1]'
                        }`}
                      >
                        {todo.done ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        )}
                        <span className="leading-snug">{todo.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. AI Data Analyst Chatbot & 4. What-If Simulator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Chatbot */}
        <div className="glass-panel rounded-2xl p-5 shadow-xl flex flex-col h-[540px]">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center space-x-3">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-cyan-500/25 ring-1 ring-cyan-400/40 bg-slate-950 flex-shrink-0 group">
                <img
                  src={dolphinAiAvatar}
                  alt="Trợ Lý Dolphin AI"
                  className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950 shadow-sm" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Trợ Lý Phân Tích Dữ Liệu (Dolphin AI)
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                    Online
                  </span>
                </div>
                <span className="text-[11px] text-slate-300">
                  RAG truy xuất trực tiếp từ các sheet Excel & mô hình phân tích sâu
                </span>
              </div>
            </div>

            {/* Top Right: Engine Badge */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold">
                <Zap className="w-3 h-3 text-cyan-400 fill-cyan-400/30" />
                <span>{currentModelObj.label}</span>
              </div>
            </div>
          </div>

          {/* Quick Questions Chips */}
          <div className="py-2.5 flex items-center space-x-2 overflow-x-auto scrollbar-none border-b border-white/[0.08]">
            <button
              onClick={() => handleSendMessage('Tại sao kênh Live Stream và Chat bị rò rỉ đơn nhiều nhất và cần khắc phục thế nào?')}
              className="text-[11px] bg-white/[0.06] hover:bg-orange-500/20 hover:border-orange-400/40 text-slate-200 hover:text-orange-200 px-3 py-1 rounded-full whitespace-nowrap border border-white/[0.1] transition-all backdrop-blur-md flex items-center gap-1.5"
            >
              <span>🔥</span>
              <span>Điểm nóng rò rỉ COD & Kênh Live/Chat?</span>
            </button>
            <button
              onClick={() => handleSendMessage('Top sản phẩm nhóm A đóng góp bao nhiêu % và có SKU Zombie nào cần giải phóng không?')}
              className="text-[11px] bg-white/[0.06] hover:bg-emerald-500/20 hover:border-emerald-400/40 text-slate-200 hover:text-emerald-200 px-3 py-1 rounded-full whitespace-nowrap border border-white/[0.1] transition-all backdrop-blur-md flex items-center gap-1.5"
            >
              <span>📦</span>
              <span>Top SKU nhóm A & SKU Zombie?</span>
            </button>
            <button
              onClick={() => handleSendMessage('Đánh giá chi tiết hiệu quả Shopee Ads, ROAS và chi phí có bị lãng phí không?')}
              className="text-[11px] bg-white/[0.06] hover:bg-blue-500/20 hover:border-blue-400/40 text-slate-200 hover:text-blue-200 px-3 py-1 rounded-full whitespace-nowrap border border-white/[0.1] transition-all backdrop-blur-md flex items-center gap-1.5"
            >
              <span>📉</span>
              <span>Hiệu quả Ads & Điểm hòa vốn ROAS?</span>
            </button>
            <button
              onClick={() => handleSendMessage('Đưa ra tư vấn chiến lược và lộ trình hành động ưu tiên trong 2 tuần tới cho shop?')}
              className="text-[11px] bg-white/[0.06] hover:bg-purple-500/20 hover:border-purple-400/40 text-slate-200 hover:text-purple-200 px-3 py-1 rounded-full whitespace-nowrap border border-white/[0.1] transition-all backdrop-blur-md flex items-center gap-1.5"
            >
              <span>🎯</span>
              <span>Lộ trình chiến lược 0-2 tuần?</span>
            </button>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 min-h-[260px] max-h-[360px]">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex space-x-2.5 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl overflow-hidden ring-1 ring-cyan-400/40 shadow-sm shrink-0 bg-slate-950">
                    <img
                      src={dolphinAiAvatar}
                      alt="Dolphin AI"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600/90 text-white rounded-tr-none shadow-md shadow-blue-500/20'
                      : 'glass-panel-subtle text-slate-100 rounded-tl-none shadow-md border border-white/10'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-line">{msg.content}</p>
                  ) : (
                    <div className="chat-markdown-body space-y-2">
                      <Markdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-slate-200">{children}</p>,
                          ul: ({ children }) => <ul className="space-y-1.5 my-2 pl-0 list-none">{children}</ul>,
                          ol: ({ children }) => <ol className="space-y-1.5 my-2 pl-4 list-decimal text-slate-200">{children}</ol>,
                          li: ({ children }) => (
                            <li className="flex items-start gap-1.5 text-slate-200">
                              <span className="text-cyan-400 mt-1 shrink-0 text-[10px]">◆</span>
                              <span className="flex-1 leading-relaxed">{children}</span>
                            </li>
                          ),
                          strong: ({ children }) => {
                            const text = String(children || '');
                            if (text.includes('Kết luận cốt lõi') || text.includes('Core Conclusion')) {
                              return (
                                <span className="inline-flex items-center gap-1.5 font-bold text-amber-300 bg-amber-500/15 border border-amber-400/40 px-2.5 py-0.5 rounded-md my-1 text-[11px] tracking-wide uppercase shadow-sm">
                                  <span>📌</span>
                                  <span>{children}</span>
                                </span>
                              );
                            }
                            if (text.includes('Dẫn chứng số liệu thực tế') || text.includes('Actual Data Evidence')) {
                              return (
                                <span className="inline-flex items-center gap-1.5 font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-400/40 px-2.5 py-0.5 rounded-md my-1 text-[11px] tracking-wide uppercase shadow-sm">
                                  <span>📊</span>
                                  <span>{children}</span>
                                </span>
                              );
                            }
                            if (text.includes('Khuyến nghị hành động') || text.includes('Actionable Recommendations')) {
                              return (
                                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-400/40 px-2.5 py-0.5 rounded-md my-1 text-[11px] tracking-wide uppercase shadow-sm">
                                  <span>💡</span>
                                  <span>{children}</span>
                                </span>
                              );
                            }
                            return (
                              <strong className="font-bold text-cyan-200 bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-400/30 font-mono text-[11.5px] inline-block my-0.5">
                                {children}
                              </strong>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </Markdown>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-slate-200 shrink-0 backdrop-blur-md">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {isChatLoading && (
              <div className="flex items-center space-x-3 text-slate-200 text-xs py-3 px-3 bg-white/[0.04] rounded-2xl border border-cyan-500/20 backdrop-blur-md animate-pulse">
                <div className="relative w-8 h-8 rounded-xl overflow-hidden ring-2 ring-cyan-400/60 shrink-0 bg-slate-950 shadow-md shadow-cyan-500/30">
                  <img
                    src={dolphinAiAvatar}
                    alt="Dolphin AI Thinking"
                    className="w-full h-full object-cover animate-spin-slow"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-cyan-500/10 animate-ping" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span className="font-semibold text-cyan-300">Dolphin AI đang phân tích dữ liệu</span>
                  </div>
                  <p className="text-[11px] text-slate-300 italic font-mono">
                    {thinkingStage}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input Area with Model Selector & Quick Actions */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setIsModelDropdownOpen(false);
              setIsQuickActionsOpen(false);
              handleSendMessage();
            }}
            className="pt-2 border-t border-white/[0.08]"
          >
            <div className="relative rounded-2xl bg-slate-950/80 border border-white/15 focus-within:border-cyan-400/60 transition-all p-2.5 shadow-inner">
              {/* Input row */}
              <input
                type="text"
                id="ai-chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    setIsModelDropdownOpen(false);
                    setIsQuickActionsOpen(false);
                    handleSendMessage();
                  }
                }}
                placeholder={
                  language === 'vi'
                    ? 'Hỏi bất kỳ điều gì, @ hoặc / để phân tích dữ liệu...'
                    : 'Ask anything, @ to mention, / for prompt templates...'
                }
                className="w-full bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none px-1 py-1"
              />

              {/* Bottom toolbar */}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/[0.06]">
                {/* Left side: Plus Button + Model Selector Badge */}
                <div className="flex items-center space-x-1.5 relative">
                  {/* Plus / Quick Prompts Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsQuickActionsOpen(!isQuickActionsOpen);
                        setIsModelDropdownOpen(false);
                      }}
                      className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                      title="Mẫu câu hỏi phân tích nhanh"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    {/* Quick Prompts Popup */}
                    {isQuickActionsOpen && (
                      <div className="absolute bottom-full left-0 mb-2 w-72 bg-slate-900/95 border border-white/15 rounded-xl shadow-2xl backdrop-blur-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider flex items-center justify-between">
                          <span>Mẫu phân tích nhanh</span>
                          <Wand2 className="w-3 h-3 text-cyan-400" />
                        </div>
                        <div className="space-y-1 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              handleSendMessage('Tại sao kênh Live Stream và Chat bị rò rỉ đơn nhiều nhất và cần khắc phục thế nào?');
                              setIsQuickActionsOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] text-slate-200 hover:bg-white/10 hover:text-cyan-300 transition-colors flex items-center gap-1.5"
                          >
                            <span>🔥</span>
                            <span className="truncate">Phân tích rò rỉ COD & Kênh Live</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleSendMessage('Top sản phẩm nhóm A đóng góp bao nhiêu % và có SKU Zombie nào cần giải phóng không?');
                              setIsQuickActionsOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] text-slate-200 hover:bg-white/10 hover:text-emerald-300 transition-colors flex items-center gap-1.5"
                          >
                            <span>📦</span>
                            <span className="truncate">Quét Top SKU & SKU Zombie</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleSendMessage('Đánh giá chi tiết hiệu quả Shopee Ads, ROAS và chi phí có bị lãng phí không?');
                              setIsQuickActionsOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] text-slate-200 hover:bg-white/10 hover:text-blue-300 transition-colors flex items-center gap-1.5"
                          >
                            <span>📉</span>
                            <span className="truncate">Hiệu quả Ads & Điểm hòa vốn ROAS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleSendMessage('Đưa ra tư vấn chiến lược và lộ trình hành động ưu tiên trong 2 tuần tới cho shop?');
                              setIsQuickActionsOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] text-slate-200 hover:bg-white/10 hover:text-purple-300 transition-colors flex items-center gap-1.5"
                          >
                            <span>🎯</span>
                            <span className="truncate">Lộ trình chiến lược 0-2 tuần</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Model Selector Chip / Dropdown (Matching Screenshot) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModelDropdownOpen(!isModelDropdownOpen);
                        setIsQuickActionsOpen(false);
                      }}
                      className="bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 px-2.5 py-1 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all shadow-sm active:scale-95 group"
                    >
                      <span className="text-cyan-300 font-semibold group-hover:text-cyan-200">
                        {currentModelObj.label}
                      </span>
                      <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-200 transition-transform" />
                    </button>

                    {/* Model Dropdown Menu */}
                    {isModelDropdownOpen && (
                      <div className="absolute bottom-full left-0 mb-2 w-80 bg-slate-900/95 border border-white/15 rounded-2xl shadow-2xl backdrop-blur-xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5">
                          <span>Chọn Model Trí Tuệ Nhân Tạo</span>
                          <Brain className="w-3.5 h-3.5 text-cyan-400" />
                        </div>
                        <div className="space-y-1.5">
                          {availableModels.map((m) => {
                            const isSelected = m.id === selectedModel;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setSelectedModel(m.id);
                                  setIsModelDropdownOpen(false);
                                }}
                                className={`w-full text-left p-2 rounded-xl transition-all border ${
                                  isSelected
                                    ? 'bg-cyan-950/40 border-cyan-500/40 shadow-sm'
                                    : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/5'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-1.5">
                                    <span className="text-xs font-bold text-white">
                                      {m.label}
                                    </span>
                                    {isSelected && (
                                      <Check className="w-3 h-3 text-cyan-400 stroke-[3]" />
                                    )}
                                  </div>
                                  <span
                                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${m.badgeColor}`}
                                  >
                                    {m.badge}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                                  {m.desc}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Shortcut Hint + Send Button */}
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline-block">
                    Enter ↵
                  </span>
                  <button
                    type="submit"
                    disabled={isChatLoading || !chatInput.trim()}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 via-cyan-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-md shadow-blue-500/25 active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* What-If Promotion & Price Simulator */}
        <div className="glass-panel rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Mô Phỏng Định Giá & Khuyến Mãi (What-If Simulator)
                </h3>
              </div>
              <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/30 backdrop-blur-md">
                Live Math Engine
              </span>
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-2 gap-4 my-4">
              <div>
                <div className="flex justify-between text-xs text-slate-200 font-medium mb-1.5">
                  <span>Điều chỉnh Giá bán:</span>
                  <span className="font-bold text-blue-400">
                    {simParams.priceDelta > 0 ? `+${simParams.priceDelta}%` : `${simParams.priceDelta}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="30"
                  step="5"
                  value={simParams.priceDelta}
                  onChange={(e) =>
                    setSimParams({ ...simParams, priceDelta: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-blue-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-200 font-medium mb-1.5">
                  <span>Voucher Shop (%):</span>
                  <span className="font-bold text-blue-400">
                    {simParams.voucherPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="1"
                  value={simParams.voucherPercent}
                  onChange={(e) =>
                    setSimParams({ ...simParams, voucherPercent: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-blue-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-200 font-medium mb-1.5">
                  <span>Tăng chi phí Ads (%):</span>
                  <span className="font-bold text-blue-400">
                    +{simParams.adSpendDelta}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="100"
                  step="10"
                  value={simParams.adSpendDelta}
                  onChange={(e) =>
                    setSimParams({ ...simParams, adSpendDelta: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-blue-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-200 font-medium mb-1.5">
                  <span>Tăng tỷ lệ chốt đơn (%):</span>
                  <span className="font-bold text-blue-400">
                    +{simParams.conversionBoost}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="5"
                  value={simParams.conversionBoost}
                  onChange={(e) =>
                    setSimParams({ ...simParams, conversionBoost: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-blue-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Projected Results Card */}
            <div className="glass-panel-subtle rounded-2xl p-4 grid grid-cols-3 gap-2 text-xs shadow-md">
              <div>
                <span className="text-slate-300">Doanh thu dự kiến:</span>
                <div className="text-sm font-black text-emerald-400 mt-0.5">
                  {formatVND(simResult.projectedRevenue)}
                </div>
                <span className="text-[10px] text-emerald-300 font-bold">
                  {simResult.revenueDeltaPercent >= 0 ? '+' : ''}
                  {simResult.revenueDeltaPercent}%
                </span>
              </div>

              <div>
                <span className="text-slate-300">Lợi nhuận gộp:</span>
                <div className="text-sm font-black text-white mt-0.5">
                  {formatVND(simResult.projectedGrossProfit)}
                </div>
                <span className="text-[10px] text-slate-300">
                  Biên lợi nhuận: {simResult.projectedMargin}%
                </span>
              </div>

              <div>
                <span className="text-slate-300">Điểm hòa vốn Ads:</span>
                <div className="text-sm font-black text-amber-400 mt-0.5">
                  {simResult.breakEvenRoas}x ROAS
                </div>
                <span className="text-[10px] text-slate-400">
                  Ước tính {formatNumber(simResult.projectedOrders)} đơn
                </span>
              </div>
            </div>
          </div>

          {/* AI Scenario Evaluation */}
          <div className="mt-4 pt-3 border-t border-white/[0.08]">
            {aiSimAnalysis ? (
              <div className="glass-panel-subtle p-3.5 rounded-xl text-xs text-slate-100 leading-relaxed whitespace-pre-line shadow-md">
                <div className="font-bold text-blue-300 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Đánh giá kịch bản từ AI:
                </div>
                {aiSimAnalysis}
              </div>
            ) : (
              <button
                onClick={handleRunAiSimulatorAnalysis}
                disabled={isSimLoading}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isSimLoading ? 'animate-spin' : ''}`} />
                <span>{isSimLoading ? 'AI đang phân tích kịch bản...' : 'Nhận xét chiến lược kịch bản bằng AI'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Google Sheets Sync Modal */}
      <GoogleSheetsActionSyncModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        config={sheetsConfig}
        onConfigChange={(newConfig) => setSheetsConfig(newConfig)}
        onImportTasks={(importedTasks) => {
          setRoadmapItems(importedTasks);
          const fileId = data?.fileName ? data.fileName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'default';
          localStorage.setItem(`ecompulse_custom_roadmap_${fileId}`, JSON.stringify(importedTasks));
        }}
        roadmapTasks={roadmapItems}
        actionCards={actionCards}
        storeName={data.fileName}
        language={language}
      />

      {/* Gemini API Key Configuration Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/20 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-left">
            {/* Close Button */}
            <button
              onClick={() => setShowApiKeyModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center space-x-3 pb-4 border-b border-white/10">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Cài Đặt Gemini API Key
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Active
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Tích hợp khóa API trực tiếp vào Chat Box Dolphin & các module AI
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Khóa API Gemini (Google AI Studio):
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showKeyPassword ? 'text' : 'password'}
                    value={tempApiKey}
                    onChange={(e) => {
                      setTempApiKey(e.target.value);
                      setTestKeyStatus(null);
                    }}
                    placeholder="Nhập API Key Google Gemini (AIzaSy...)"
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyPassword(!showKeyPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-200"
                    title={showKeyPassword ? 'Ẩn khóa API' : 'Hiện khóa API'}
                  >
                    {showKeyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-slate-400">
                    Khóa được lưu an toàn & gửi bảo mật qua proxy backend.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setTempApiKey('');
                      setTestKeyStatus(null);
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-medium"
                  >
                    Xóa / Sử dụng mặc định
                  </button>
                </div>
              </div>

              {/* Status Message */}
              {testKeyStatus && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                    testKeyStatus.ok
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {testKeyStatus.ok ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{testKeyStatus.message}</span>
                </div>
              )}

              {isKeySavedSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Đã lưu và áp dụng API Key thành công!</span>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="mt-6 flex items-center justify-end space-x-2 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={handleTestApiKey}
                disabled={isTestingKey || !tempApiKey.trim()}
                className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 text-amber-400 ${isTestingKey ? 'animate-spin' : ''}`} />
                <span>{isTestingKey ? 'Đang test...' : 'Kiểm tra kết nối'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveApiKey}
                disabled={!tempApiKey.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
              >
                Lưu & Áp Dụng Ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
