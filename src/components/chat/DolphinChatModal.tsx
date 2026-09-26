import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import {
  Sparkles,
  Send,
  Loader2,
  X,
  Maximize2,
  Minimize2,
  RotateCcw,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Bot,
  User,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  HelpCircle,
  ArrowRight,
  Lightbulb,
  Lock,
  Layers,
  BarChart3,
  DollarSign,
  ChevronRight,
  Database,
  Video,
  BookOpen,
  Upload,
  Play,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import dolphinAvatar from '../../assets/images/dolphin_ai_avatar_1787721342181.jpg';
import { GoogleUserProfile, ParsedStoreData } from '../../types';
import { anonymizeStoreDataForAI } from '../../utils/dataAnonymizer';
import { aiChat } from '../../utils/aiClient';
import { ShopeeLogo, TikTokShopLogo } from '../PlatformLogos';

export interface DolphinChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: ParsedStoreData | null;
  onLoadDemoSample?: () => void;
  onOpenUpload?: () => void;
  onOpenTour?: () => void;
  currentUser?: GoogleUserProfile | null;
  language?: 'vi' | 'en';
  initialPrompt?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedFollowUps?: string[];
  showActionButtons?: boolean;
}

export const DolphinChatModal: React.FC<DolphinChatModalProps> = ({
  isOpen,
  onClose,
  data,
  onLoadDemoSample,
  onOpenUpload,
  onOpenTour,
  currentUser,
  language = 'vi',
  initialPrompt,
}) => {
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [thinkingStep, setThinkingStep] = useState<string>('');
  const [guideTab, setGuideTab] = useState<'quick' | 'export' | 'internal' | 'roles'>('quick');
  const [exportPlatform, setExportPlatform] = useState<'shopee' | 'tiktok'>('shopee');

  const formatVND = (val: number = 0) => new Intl.NumberFormat('vi-VN').format(Math.round(val)) + ' ₫';
  const formatNum = (val: number = 0) => new Intl.NumberFormat('vi-VN').format(Math.round(val));

  const hasData = !!(data && data.kpis && (
    (data.kpis.placedRevenue || 0) > 0 ||
    (data.kpis.paidRevenue || 0) > 0 ||
    (data.kpis.placedOrders || 0) > 0
  ));

  const isInternalFinance = Boolean((data as any)?.internalFinance || data?.datasetId === 'internal-finance-data');

  const getWelcomeMessage = (): Message => {
    if (hasData && data) {
      const kpis = data.kpis;
      const fileName = data.fileName || 'Báo cáo bán hàng';
      const paidRev = kpis?.paidRevenue || 0;
      const paidOrders = kpis?.paidOrders || 0;
      const placedRev = kpis?.placedRevenue || 0;
      const placedOrders = kpis?.placedOrders || 0;
      const cancelRate = kpis?.cancellationRate || 0;
      const leakRev = Math.max(0, placedRev - paidRev);
      const totalCogs = (kpis as any)?.totalCogs || ((data as any)?.internalFinance?.cogs) || (paidRev * 0.42);
      const totalGrossProfit = (kpis as any)?.totalGrossProfit || ((data as any)?.internalFinance?.grossProfit) || Math.max(0, paidRev - totalCogs);
      const grossMargin = (kpis as any)?.grossProfitMargin || ((data as any)?.internalFinance?.grossMargin) || 58;

      if (isInternalFinance) {
        return {
          id: 'msg-welcome-internal-data',
          role: 'assistant',
          content: language === 'vi'
            ? `Xin chào! Tôi là **Dolphin AI** – Cố vấn Tài chính & Vận hành Doanh nghiệp trong hệ thống **EcomPulse**.

Tôi đã đồng bộ toàn bộ dữ liệu từ báo cáo tài chính nội bộ **"${fileName}"**:
- 💰 **Doanh thu thuần (GMV Paid):** **${formatVND(paidRev)}** (${formatNum(paidOrders)} đơn thành công).
- 📦 **Doanh thu gộp (GMV Placed):** **${formatVND(placedRev)}** (${formatNum(placedOrders)} đơn đặt ban đầu).
- 🏷️ **Ước tính Giá vốn (COGS):** **${formatVND(totalCogs)}** | **Lợi nhuận gộp:** **${formatVND(totalGrossProfit)}** (Biên lãi: **${grossMargin.toFixed(1)}%**).
- 📉 **Thất thoát dòng tiền:** **${formatVND(leakRev)}** (Tỷ lệ hủy/chưa thu tiền: **${cancelRate.toFixed(1)}%**).

*Dolphin AI tuân thủ nghiêm ngặt **Từ Điển 53 Cột TMĐT v1.0**, không bịa số và cô lập dữ liệu 100% trong RAM.* Bạn muốn tôi phân tích khía cạnh nào?`
            : `Hello! I am **Dolphin AI** – your Internal Corporate Finance & Operations Consultant. Data from **${fileName}** is ready with **${formatVND(paidRev)}** in Net GMV.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedFollowUps: [
            '📊 Giá vốn COGS & Biên lợi nhuận gộp',
            '🚨 Chênh lệch Doanh thu Gộp vs Thuần',
            '🎥 Doanh số Livestream & Mạng lưới KOC',
            '📖 Quy tắc cấm nhầm lẫn Từ Điển 53 Cột',
          ],
        };
      }

      return {
        id: 'msg-welcome-data',
        role: 'assistant',
        content: language === 'vi'
          ? `Xin chào! Tôi là **Dolphin AI** – AI Business Analyst của shop trong hệ thống **EcomPulse**.

Tôi đã nạp và bóc tách thành công dữ liệu từ file **${fileName}**:
- 💰 **Doanh thu thực nhận:** **${formatVND(paidRev)}** (${formatNum(paidOrders)} đơn hoàn tất).
- 📦 **Doanh thu đặt hàng (Placed):** **${formatVND(placedRev)}** (${formatNum(placedOrders)} đơn đặt).
- 📉 **Thất thoát / Rò rỉ:** **${formatVND(leakRev)}** (Tỷ lệ hủy: **${cancelRate.toFixed(1)}%**).

Tôi sẵn sàng trích xuất số liệu thực tế và dẫn chứng chi tiết cho bạn. Bạn muốn tôi phân tích khía cạnh nào trước?`
          : `Hello! I am **Dolphin AI** – your E-commerce Business Analyst at **EcomPulse**.

I have extracted real data from **${fileName}** with **${formatVND(paidRev)}** in paid revenue. How can I assist you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedFollowUps: [
          '📊 Shop tui tháng này sao?',
          '🚨 Shop đang đốt tiền ở đâu?',
          '🏆 Mặt hàng nào bán chạy nhất?',
          '⚡ Quảng cáo có hiệu quả không?',
          '👥 Khách có quay lại mua không?',
          '💡 Nên làm gì để tối ưu doanh thu?',
        ],
      };
    }

    return {
      id: 'msg-welcome-no-data',
      role: 'assistant',
      content: language === 'vi'
        ? `Xin chào! Tôi là **Dolphin AI** – Trợ lý Phân tích Dữ liệu Kinh doanh Thương mại Điện tử (AI Business Analyst) của **EcomPulse**.

Theo nguyên tắc cốt lõi, Dolphin **tuyệt đối không bịa số** mà chỉ trích xuất số liệu thực tế từ file báo cáo của shop.

Dưới đây là các phương án hướng dẫn để bạn bắt đầu dễ dàng ngay lập tức:`
        : `Hello! I am **Dolphin AI** – your AI Business Analyst. Please choose a starting option or ask anything about how to use EcomPulse.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      showActionButtons: true,
      suggestedFollowUps: [
        '🚀 Nạp dữ liệu mẫu Shopee Mega 8.8 (Demo)',
        '📁 Tải lên file Excel báo cáo của bạn',
        '📖 Hướng dẫn xuất file Shopee',
        '💡 Người mới bắt đầu nên xem gì?',
      ],
    };
  };

  const [messages, setMessages] = useState<Message[]>([getWelcomeMessage()]);

  // Update greeting when data changes
  useEffect(() => {
    setMessages([getWelcomeMessage()]);
  }, [data]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  // Focus on input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Handle initial prompt
  useEffect(() => {
    if (isOpen && initialPrompt) {
      handleSendMessage(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  // ESC to close, unless maximized
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    setMessages([getWelcomeMessage()]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isTyping) return;

    // Check if user clicked action buttons
    if (query.includes('Nạp dữ liệu mẫu') || query.includes('Shopee Mega 8.8')) {
      if (onLoadDemoSample) {
        onLoadDemoSample();
        return;
      }
    }
    if (query.includes('Tải lên file Excel') || query.includes('báo cáo của bạn')) {
      if (onOpenUpload) {
        onOpenUpload();
        onClose();
        return;
      }
    }

    const userMsgId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setThinkingStep('Dolphin AI đang đọc dữ liệu & trích xuất dẫn chứng...');

    const stepTimer1 = setTimeout(() => {
      setThinkingStep('Đang tính toán các chỉ số kinh doanh & đối soát phễu...');
    }, 600);

    const stepTimer2 = setTimeout(() => {
      setThinkingStep('Đang tổng hợp nhận định và giải pháp chiến lược...');
    }, 1200);

    try {
      // Privacy mode decides where (if anywhere) the question goes. Only anonymized
      // aggregates are ever sent — never order rows or raw sheets.
      const reply = await aiChat({
        message: query,
        history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        analyticsData: data ? anonymizeStoreDataForAI(data) : null,
        language,
      });
      const replyContent = reply.text;

      let dynamicFollowUps = isInternalFinance
        ? [
            '📊 Giá vốn COGS & Biên lãi gộp',
            '🚨 Chênh lệch GMV Placed vs GMV Paid',
            '🎥 Doanh số Livestream & KOC',
            '📖 Từ Điển 53 Cột Chuẩn v1.0',
          ]
        : [
            '📊 Shop tui tháng này sao?',
            '🚨 Rò rỉ đơn COD ở đâu?',
            '🏆 Sản phẩm nào bán chạy nhất?',
            '⚡ Tối ưu Shopee Ads',
          ];

      const qLower = query.toLowerCase();
      if (qLower.includes('giá vốn') || qLower.includes('cogs') || qLower.includes('lãi gộp') || qLower.includes('biên')) {
        dynamicFollowUps = [
          'Chiến lược đàm phán giá nhập cho Top 3 SKU',
          'Tỷ trọng chi phí Ads trên Lợi nhuận gộp',
          'Điểm hòa vốn Break-even ROAS',
        ];
      } else if (qLower.includes('rò rỉ') || qLower.includes('cod') || qLower.includes('hủy') || qLower.includes('placed')) {
        dynamicFollowUps = [
          'Thiết lập kịch bản xác nhận đơn COD trong 15 phút',
          'Khóa hình thức COD với tài khoản bom hàng',
          'So sánh tỷ lệ giữ chân các kênh',
        ];
      } else if (qLower.includes('sản phẩm') || qLower.includes('bán chạy') || qLower.includes('sku') || qLower.includes('zombie')) {
        dynamicFollowUps = [
          'Cách đóng gói Bundle Mua Kèm Deal Sốc',
          'Sản phẩm nào lời nhất?',
          'Tối ưu ảnh bìa và video cho SKU nhóm B',
        ];
      } else if (qLower.includes('live') || qLower.includes('koc') || qLower.includes('affiliate') || qLower.includes('hoa hồng')) {
        dynamicFollowUps = [
          'Top 3 KOC mang lại chuyển đổi cao nhất',
          'Nhân bản khung giờ Flash Sale Livestream',
          'Chính sách thưởng nóng thúc đẩy đối tác Affiliate',
        ];
      } else if (qLower.includes('từ điển') || qLower.includes('53 cột') || qLower.includes('cấm nhầm lẫn')) {
        dynamicFollowUps = [
          '10 cặp cấm nhầm lẫn cốt lõi trong TMĐT',
          'Quy trình 10 bước AI đọc file an toàn',
          '22 từ viết tắt thuật ngữ ngành sàn',
        ];
      } else if (qLower.includes('ads') || qLower.includes('quảng cáo') || qLower.includes('roas')) {
        dynamicFollowUps = [
          'Phủ định từ khóa lãng phí ngân sách',
          'Tăng ngân sách từ khóa chính xác ROAS > 5x',
          'Tính điểm hòa vốn Break-even ROAS',
        ];
      } else if (qLower.includes('hướng dẫn') || qLower.includes('bắt đầu') || qLower.includes('xuất file')) {
        dynamicFollowUps = [
          '🚀 Nạp demo Shopee Mega 8.8',
          '📖 Hướng dẫn xuất file Shopee',
          '📖 Hướng dẫn xuất file TikTok Shop',
          '🏢 File P&L 53 Cột chuẩn',
        ];
      }

      const assistantMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: replyContent || 'Dolphin AI đã ghi nhận yêu cầu và đang đồng bộ số liệu.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedFollowUps: hasData ? dynamicFollowUps : [
          '🚀 Nạp dữ liệu mẫu Shopee Mega 8.8 (Demo)',
          '📁 Tải lên file Excel báo cáo của bạn',
          '📖 Hướng dẫn xuất file Shopee',
          '💡 Người mới bắt đầu nên xem gì?',
        ],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content: 'Không thể kết nối tới dịch vụ AI. Bạn vẫn có thể hỏi Dolphin ở chế độ bằng chứng (Local Only) trong Seller/Analyst workspace.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsTyping(false);
      setThinkingStep('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const QUICK_PROMPTS_WITH_DATA = isInternalFinance
    ? [
        {
          icon: DollarSign,
          color: 'from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30',
          title: 'Giá vốn & Lợi nhuận gộp',
          prompt: 'Phân tích chi tiết Giá vốn hàng bán COGS và Biên lợi nhuận gộp của doanh nghiệp',
        },
        {
          icon: AlertTriangle,
          color: 'from-rose-500/20 to-amber-500/20 text-rose-300 border-rose-500/30',
          title: 'Doanh thu Gộp vs Thuần',
          prompt: 'Bóc tách chênh lệch Doanh thu Gộp (Placed) vs Doanh thu Thuần (Paid) và tỷ lệ đơn hủy',
        },
        {
          icon: Video,
          color: 'from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/30',
          title: 'Livestream & KOC / Affiliate',
          prompt: 'Đánh giá doanh số mang về từ các phiên Livestream và hiệu quả mạng lưới KOC / Affiliate',
        },
        {
          icon: ShoppingBag,
          color: 'from-cyan-500/20 to-teal-500/20 text-cyan-300 border-cyan-500/30',
          title: 'Sản phẩm chủ lực & AOV',
          prompt: 'Sản phẩm nào đang có biên lợi nhuận cao nhất và đề xuất đóng gói combo tăng AOV',
        },
        {
          icon: BookOpen,
          color: 'from-sky-500/20 to-blue-500/20 text-sky-300 border-sky-500/30',
          title: 'Từ điển 53 Cột v1.0',
          prompt: 'Tra cứu các quy tắc cấm nhầm lẫn và từ điển 53 cột TMĐT áp dụng cho file này',
        },
      ]
    : [
        {
          icon: BarChart3,
          color: 'from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/30',
          title: 'Shop tui sao rồi?',
          prompt: 'Shop tui tháng này bán sao rồi, tình hình tổng quan thế nào?',
        },
        {
          icon: AlertTriangle,
          color: 'from-rose-500/20 to-amber-500/20 text-rose-300 border-rose-500/30',
          title: 'Rò rỉ dòng tiền',
          prompt: 'Shop đang đốt tiền ở đâu, đơn hủy và rò rỉ COD nhiều không?',
        },
        {
          icon: ShoppingBag,
          color: 'from-cyan-500/20 to-teal-500/20 text-cyan-300 border-cyan-500/30',
          title: 'Top SKU & Zombie',
          prompt: 'Mặt hàng nào bán chạy nhất và có sản phẩm Zombie nào không có chuyển đổi không?',
        },
        {
          icon: Zap,
          color: 'from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30',
          title: 'Quảng cáo & ROAS',
          prompt: 'Quảng cáo có hiệu quả không, ROAS bao nhiêu và có lãng phí ngân sách ở đâu không?',
        },
        {
          icon: TrendingUp,
          color: 'from-emerald-500/20 to-green-500/20 text-emerald-300 border-emerald-500/30',
          title: 'Nên làm gì tiếp?',
          prompt: 'Dựa trên số liệu hiện tại, shop nên làm gì để tăng doanh thu và bịt lỗ rò rỉ?',
        },
      ];

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
    >
      {/* Background Ambient Aura */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[160px] pointer-events-none" />

      {/* Main Container Card */}
      <div
        className={`relative w-full ${
          isMaximized
            ? 'max-w-[96vw] h-[94vh]'
            : 'max-w-4xl lg:max-w-5xl h-[86vh] min-h-[620px] max-h-[900px]'
        } bg-[#080d22]/95 border border-cyan-500/30 rounded-3xl shadow-2xl shadow-cyan-950/80 flex flex-col overflow-hidden transition-all duration-300 backdrop-blur-2xl`}
      >
        {/* =========================================================================
            1. TOP HEADER BAR
        ========================================================================= */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900/80 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          {/* Left: Avatar & Assistant Info */}
          <div className="flex items-center space-x-3.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-cyan-400/60 shadow-lg shadow-cyan-500/30 bg-slate-950 p-0.5">
                <img src={dolphinAvatar} alt="Dolphin AI" className="w-full h-full object-cover rounded-xl" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-900 rounded-full animate-pulse shadow-sm" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  Dolphin AI
                  <Sparkles className="w-4 h-4 text-cyan-400 fill-cyan-400/30 animate-pulse" />
                </h3>
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                  AI Business Analyst
                </span>
              </div>
              
              {/* Active Data Source Indicator */}
              <div className="flex items-center space-x-2 text-xs">
                {hasData ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5 text-[11px] sm:text-xs">
                    <Database className="w-3.5 h-3.5" />
                    <span className="max-w-[280px] sm:max-w-md truncate">
                      Đang đọc: {data?.fileName || 'Báo cáo bán hàng'} ({formatNum(data?.kpis?.paidOrders || 0)} đơn • {formatVND(data?.kpis?.paidRevenue || 0)})
                    </span>
                  </span>
                ) : (
                  <span className="text-amber-400 font-medium flex items-center gap-1.5 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Chưa nạp dữ liệu cửa hàng • Chế độ Hỏi đáp &amp; Hướng dẫn quy chuẩn
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions Controls */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {/* Tour Button */}
            {onOpenTour && (
              <button
                onClick={onOpenTour}
                title="Mở Tour hướng dẫn 1 phút"
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-bold transition-all flex items-center space-x-1.5 active:scale-95 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Tour Hướng Dẫn</span>
              </button>
            )}

            {/* Clear History Button */}
            <button
              onClick={handleResetChat}
              title="Làm mới cuộc trò chuyện"
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center space-x-1.5 active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            {/* Maximize / Restore Toggle Button */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình'}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all active:scale-95"
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              title="Đóng khung chat (ESC)"
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-red-500/20 hover:border-red-500/40 border border-white/10 flex items-center justify-center text-slate-400 hover:text-red-300 transition-all active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            2. QUICK PROMPT CHIPS RIBBON (Category Pill Carousel)
        ========================================================================= */}
        <div className="px-5 sm:px-6 py-2.5 bg-slate-950/60 border-b border-white/5 overflow-x-auto no-scrollbar flex items-center space-x-2 flex-shrink-0">
          <div className="flex items-center space-x-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0 mr-1">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{hasData ? 'Hỏi nhanh:' : 'Gợi ý bắt đầu:'}</span>
          </div>

          {hasData ? (
            QUICK_PROMPTS_WITH_DATA.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(item.prompt)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-r ${item.color} border text-xs font-semibold transition-all hover:scale-105 active:scale-95 flex items-center space-x-1.5 shadow-sm`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.title}</span>
                </button>
              );
            })
          ) : (
            <>
              <button
                onClick={() => handleSendMessage('Người mới bắt đầu nên xem những chỉ số nào trước?')}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-xs font-semibold text-blue-300 transition-all flex items-center space-x-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                <span>Người mới nên xem gì?</span>
              </button>
              <button
                onClick={() => handleSendMessage('Hướng dẫn tôi cách xuất báo cáo chuẩn từ Shopee')}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 text-xs font-semibold text-orange-300 transition-all flex items-center space-x-1.5"
              >
                <ShopeeLogo className="w-3.5 h-3.5 rounded" />
                <span>Cách xuất file Shopee</span>
              </button>
              <button
                onClick={() => handleSendMessage('Hướng dẫn cách xuất báo cáo từ TikTok Shop')}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 text-xs font-semibold text-cyan-300 transition-all flex items-center space-x-1.5"
              >
                <TikTokShopLogo className="w-3.5 h-3.5 rounded" />
                <span>Cách xuất file TikTok Shop</span>
              </button>
              <button
                onClick={() => handleSendMessage('Từ điển 53 Cột TMĐT v1.0 gồm những gì?')}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-xs font-semibold text-emerald-300 transition-all flex items-center space-x-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>Từ điển 53 Cột</span>
              </button>
            </>
          )}
        </div>

        {/* =========================================================================
            3. MESSAGES SCROLLABLE FEED
        ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-sm text-left">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex items-start gap-3.5 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}
              >
                {/* Assistant Avatar */}
                {!isUser && (
                  <div className="w-9 h-9 rounded-xl overflow-hidden border border-cyan-400/40 shadow-md bg-slate-900 flex-shrink-0 mt-0.5">
                    <img src={dolphinAvatar} alt="Dolphin AI" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Message Bubble */}
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[92%] sm:max-w-[85%]`}>
                  <div
                    className={`relative p-4 sm:p-5 rounded-2xl ${
                      isUser
                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-tr-none shadow-xl shadow-blue-950/40 font-medium'
                        : 'bg-slate-900/90 border border-white/15 text-slate-100 rounded-tl-none shadow-xl shadow-black/40'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed text-sm">{m.content}</p>
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none space-y-3 leading-relaxed text-slate-200">
                        <Markdown
                          components={{
                            h1: ({ children }) => <h1 className="text-base font-bold text-white mb-2">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-sm font-bold text-cyan-300 mt-3 mb-1.5">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-xs font-bold text-sky-300 uppercase tracking-wider mt-3 mb-1">{children}</h3>,
                            p: ({ children }) => <p className="text-xs sm:text-sm text-slate-200 leading-relaxed mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm text-slate-300 my-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 text-xs sm:text-sm text-slate-300 my-2">{children}</ol>,
                            li: ({ children }) => <li className="leading-snug">{children}</li>,
                            strong: ({ children }) => <strong className="font-bold text-white bg-white/5 px-1 py-0.5 rounded">{children}</strong>,
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-2 border-cyan-400 pl-3 py-1 bg-cyan-950/30 text-cyan-200 rounded-r-lg text-xs italic my-2">
                                {children}
                              </blockquote>
                            ),
                          }}
                        >
                          {m.content}
                        </Markdown>

                        {/* Interactive Guide Hub Cards for Empty / Onboarding State */}
                        {m.showActionButtons && !hasData && (
                          <div className="space-y-4 pt-3 mt-3 border-t border-white/10">
                            
                            {/* Guide Tab Switcher */}
                            <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-xl border border-white/10 overflow-x-auto no-scrollbar">
                              <button
                                onClick={() => setGuideTab('quick')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                  guideTab === 'quick'
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                🚀 Bắt Đầu Nhanh
                              </button>
                              <button
                                onClick={() => setGuideTab('export')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                  guideTab === 'export'
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                📖 Hướng Dẫn Tải File Sàn
                              </button>
                              <button
                                onClick={() => setGuideTab('internal')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                  guideTab === 'internal'
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                🏢 File P&L Nội Bộ
                              </button>
                              <button
                                onClick={() => setGuideTab('roles')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                  guideTab === 'roles'
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                💡 Câu Hỏi Mẫu
                              </button>
                            </div>

                            {/* TAB 1: QUICK START */}
                            {guideTab === 'quick' && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
                                {onLoadDemoSample && (
                                  <button
                                    onClick={() => onLoadDemoSample()}
                                    className="p-3.5 rounded-2xl bg-gradient-to-b from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white text-left space-y-2 shadow-lg shadow-blue-950/50 transition-all active:scale-95 group"
                                  >
                                    <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                                      <Play className="w-3.5 h-3.5 fill-white text-white" />
                                    </div>
                                    <div>
                                      <span className="text-xs font-black block">1. Nạp Demo 1-Click</span>
                                      <span className="text-[10px] text-blue-200 block leading-tight">Shopee Mega 8.8 (3.260 đơn)</span>
                                    </div>
                                  </button>
                                )}

                                {onOpenUpload && (
                                  <button
                                    onClick={() => {
                                      onOpenUpload();
                                      onClose();
                                    }}
                                    className="p-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-white text-left space-y-2 transition-all active:scale-95 group"
                                  >
                                    <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                                      <Upload className="w-3.5 h-3.5 text-cyan-300" />
                                    </div>
                                    <div>
                                      <span className="text-xs font-black block">2. Tải File Lên</span>
                                      <span className="text-[10px] text-slate-400 block leading-tight">Báo cáo Excel của shop</span>
                                    </div>
                                  </button>
                                )}

                                {onOpenTour && (
                                  <button
                                    onClick={onOpenTour}
                                    className="p-3.5 rounded-2xl bg-gradient-to-b from-purple-900/50 to-slate-900 border border-purple-500/40 hover:border-purple-400 text-white text-left space-y-2 transition-all active:scale-95 group"
                                  >
                                    <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                      <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                                    </div>
                                    <div>
                                      <span className="text-xs font-black block">3. Xem Tour 1 Phút</span>
                                      <span className="text-[10px] text-purple-300 block leading-tight">Khám phá tính năng</span>
                                    </div>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* TAB 2: EXPORT GUIDE */}
                            {guideTab === 'export' && (
                              <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3 animate-in fade-in duration-200">
                                <div className="flex items-center space-x-2 pb-2 border-b border-white/5">
                                  <button
                                    onClick={() => setExportPlatform('shopee')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                                      exportPlatform === 'shopee'
                                        ? 'bg-orange-500/20 text-orange-300 border border-orange-400/40'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                                  >
                                    <ShopeeLogo className="w-3.5 h-3.5 rounded" />
                                    <span>Shopee</span>
                                  </button>
                                  <button
                                    onClick={() => setExportPlatform('tiktok')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                                      exportPlatform === 'tiktok'
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                                  >
                                    <TikTokShopLogo className="w-3.5 h-3.5 rounded" />
                                    <span>TikTok Shop</span>
                                  </button>
                                </div>

                                {exportPlatform === 'shopee' && (
                                  <div className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                                    <p><strong>1.</strong> Đăng nhập <strong>Shopee Seller Centre</strong> &gt; <strong>Dữ Liệu</strong> &gt; <strong>Phân Tích Bán Hàng</strong>.</p>
                                    <p><strong>2.</strong> Chọn khung ngày chiến dịch Mega Sale, Tuần hoặc Tháng.</p>
                                    <p><strong>3.</strong> Bấm <strong>Tải Dữ Liệu (.xlsx)</strong> và kéo thả trực tiếp vào EcomPulse.</p>
                                  </div>
                                )}

                                {exportPlatform === 'tiktok' && (
                                  <div className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                                    <p><strong>1.</strong> Đăng nhập <strong>TikTok Shop Seller Center</strong> &gt; <strong>Phân tích</strong> &gt; <strong>La bàn dữ liệu (Compass)</strong>.</p>
                                    <p><strong>2.</strong> Chọn báo cáo Video / Livestream &amp; Doanh số bán hàng.</p>
                                    <p><strong>3.</strong> Bấm <strong>Xuất báo cáo (Export Excel)</strong> và nạp vào hệ thống.</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* TAB 3: INTERNAL FINANCE */}
                            {guideTab === 'internal' && (
                              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2 text-xs text-slate-300 animate-in fade-in duration-200">
                                <span className="font-bold text-emerald-300 block">Cấu trúc báo cáo P&amp;L 53 Cột Chuẩn v1.0:</span>
                                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                                  <li><strong>Doanh thu:</strong> Phân biệt Doanh thu gộp (Placed) vs Doanh thu thuần (Paid).</li>
                                  <li><strong>Giá vốn (COGS):</strong> Tự động tính Lợi nhuận gộp &amp; Biên lãi gộp.</li>
                                  <li><strong>Chi phí:</strong> Phí sàn, Phí Ads, Hoa hồng KOC / Affiliate, Chi phí vận hành OPEX.</li>
                                </ul>
                              </div>
                            )}

                            {/* TAB 4: ROLES PROMPTS */}
                            {guideTab === 'roles' && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 animate-in fade-in duration-200">
                                <button
                                  onClick={() => handleSendMessage('Chủ shop nên quan tâm những chỉ số tài chính và rủi ro nào nhất?')}
                                  className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-left space-y-1 transition-all active:scale-95"
                                >
                                  <span className="text-[11px] font-bold text-sky-300 block">👔 Dành Cho Chủ Shop</span>
                                  <span className="text-[10px] text-slate-400 block leading-tight">Kiểm soát dòng tiền &amp; điểm rò rỉ COD</span>
                                </button>

                                <button
                                  onClick={() => handleSendMessage('Làm sao để đo lường ROAS và phát hiện từ khóa Ads lãng phí ngân sách?')}
                                  className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-left space-y-1 transition-all active:scale-95"
                                >
                                  <span className="text-[11px] font-bold text-purple-300 block">⚡ Dành Cho Marketing / Ads</span>
                                  <span className="text-[10px] text-slate-400 block leading-tight">Tối ưu ROAS &amp; phủ định từ khóa rác</span>
                                </button>

                                <button
                                  onClick={() => handleSendMessage('Công thức bóc tách Giá vốn COGS và tính điểm hòa vốn Break-even?')}
                                  className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-left space-y-1 transition-all active:scale-95"
                                >
                                  <span className="text-[11px] font-bold text-emerald-300 block">📊 Dành Cho Kế Toán / P&amp;L</span>
                                  <span className="text-[10px] text-slate-400 block leading-tight">Đối soát biên lãi gộp &amp; Unit Economics</span>
                                </button>
                              </div>
                            )}

                          </div>
                        )}

                        {/* Message Action Footer */}
                        <div className="pt-2 mt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="flex items-center space-x-1">
                            <Bot className="w-3 h-3 text-cyan-400" />
                            <span>Dolphin AI • {m.timestamp}</span>
                          </span>

                          <button
                            onClick={() => handleCopyMessage(m.id, m.content)}
                            className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
                          >
                            {copiedId === m.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-300 font-bold">Đã chép</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Sao chép</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Follow-up Suggested Action Pills */}
                  {!isUser && m.suggestedFollowUps && m.suggestedFollowUps.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {m.suggestedFollowUps.map((promptText, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => handleSendMessage(promptText.replace(/^[🔍📊💰👉⚡🚨🚀📁🏆👥💡📖]\s*/, ''))}
                          className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 text-xs text-slate-300 hover:text-cyan-200 transition-all flex items-center space-x-1.5 active:scale-95"
                        >
                          <span>{promptText}</span>
                          <ArrowRight className="w-3 h-3 text-cyan-400" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* User Timestamp */}
                  {isUser && (
                    <span className="text-[10px] text-slate-500 mt-1 px-1">
                      {m.timestamp}
                    </span>
                  )}
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 border border-white/20 flex items-center justify-center text-white font-bold text-xs shadow-md flex-shrink-0 mt-0.5">
                    {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />}
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Loading Indicator */}
          {isTyping && (
            <div className="flex items-start gap-3.5 animate-in fade-in duration-200">
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-cyan-400/40 shadow-md bg-slate-900 flex-shrink-0">
                <img src={dolphinAvatar} alt="Dolphin AI" className="w-full h-full object-cover" />
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/30 rounded-tl-none flex items-center space-x-3 text-cyan-300 text-xs shadow-lg shadow-cyan-950/30">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span className="font-semibold">{thinkingStep || 'Dolphin AI đang phân tích dữ liệu...'}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* =========================================================================
            4. BOTTOM INPUT & COMPOSER
        ========================================================================= */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border-t border-white/10 flex-shrink-0 space-y-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2.5 bg-slate-950 border border-white/15 focus-within:border-cyan-400/80 focus-within:ring-2 focus-within:ring-cyan-500/20 rounded-2xl p-2.5 sm:p-3 transition-all shadow-inner"
          >
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                hasData
                  ? 'Hỏi Dolphin về doanh thu, số đơn, rò rỉ COD, sản phẩm Hero, ROAS Ads, P&L...'
                  : 'Nhập câu hỏi... (VD: Hướng dẫn xuất file Shopee, Người mới nên xem gì...)'
              }
              className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-0 resize-none max-h-32 leading-relaxed"
            />

            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-900/50 transition-all flex items-center space-x-1.5 active:scale-95 flex-shrink-0"
            >
              {isTyping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Gửi</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Keyboard Helper & Security Badge */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-slate-400 px-1">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Bảo mật On-Premise: Dữ liệu xử lý 100% trong RAM máy khách, không bịa số.</span>
            </span>
            <span className="hidden sm:inline text-slate-500">
              Nhấn <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-slate-300 font-mono text-[10px]">Enter</kbd> để gửi, <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-slate-300 font-mono text-[10px]">Shift + Enter</kbd> xuống dòng
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
