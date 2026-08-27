import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  Flame,
  Clock,
  Calendar,
  Compass,
  CheckSquare,
  Square,
  Copy,
  Check,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Target,
  ChevronDown,
  ChevronUp,
  Layers,
  Zap,
  BarChart3,
  MessageSquare,
  Video,
  ShoppingBag,
  RefreshCw,
  Gift,
  ExternalLink,
  Link,
  Users,
  Plus,
  Edit3,
  Trash2,
  User,
  Briefcase,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ParsedStoreData, GoogleSheetsSyncConfig, RoadmapActionItem } from '../../types';
import { formatVND, formatNumber } from '../../utils/formatters';
import { AddRoadmapTaskModal } from './AddRoadmapTaskModal';
import { saveRoadmapTasksToFirestore } from '../../utils/firebaseService';
import { getSavedGoogleUser } from '../../utils/googleSheetsService';

interface BusinessActionRoadmapProps {
  data: ParsedStoreData;
  language: 'vi' | 'en';
  sheetsConfig?: GoogleSheetsSyncConfig | null;
  onOpenSheetsModal?: () => void;
  onSyncSheets?: (customRoadmap?: RoadmapItem[]) => Promise<void>;
  isSyncing?: boolean;
  onRoadmapChange?: (items: RoadmapItem[]) => void;
}

export interface RoadmapItem extends RoadmapActionItem {
  icon?: React.ElementType;
}

export const BusinessActionRoadmap: React.FC<BusinessActionRoadmapProps> = ({
  data,
  language,
  sheetsConfig,
  onOpenSheetsModal,
  onSyncSheets,
  isSyncing = false,
  onRoadmapChange,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'high' | 'medium' | 'long'>('all');
  const [copied, setCopied] = useState<boolean>(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<RoadmapActionItem | null>(null);

  // Storage key for custom tasks per file
  const storageKey = useMemo(() => {
    const fileId = data?.fileName ? data.fileName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'default';
    return `ecompulse_custom_roadmap_${fileId}`;
  }, [data?.fileName]);

  // Load custom tasks from local storage
  const [customTasks, setCustomTasks] = useState<RoadmapItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Reload custom tasks when file changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setCustomTasks(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setCustomTasks([]);
    }
  }, [storageKey]);

  // Save custom tasks helper
  const saveCustomTasksToStorage = (updatedCustoms: RoadmapItem[]) => {
    setCustomTasks(updatedCustoms);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedCustoms));
      const user = getSavedGoogleUser();
      if (user && user.id) {
        saveRoadmapTasksToFirestore(
          user.id,
          updatedCustoms.map((t) => ({
            title: t.action,
            timeframe: t.timeframe || '',
            category: t.category,
            priority: t.category === 'high' ? 'P0' : t.category === 'medium' ? 'P1' : 'P2',
            assignee: t.assignee || '',
            deadline: t.deadline || '',
            status: t.status as any,
            expectedImpact: t.targetKpi,
          }))
        );
      }
    } catch (e) {
      console.error('Error saving custom tasks to localStorage or Firebase:', e);
    }
  };

  // Dynamic values calculated from parsed store data
  const dynamicRoadmap = useMemo(() => {
    const kpis = data.kpis;
    const funnel = data.funnel;
    const channels = data.channels || [];
    const ads = data.ads || [];
    const retention = data.retention;
    const daily = data.dailyTimeline || [];
    const campaign = data.campaignStats;

    const placedRev = kpis.placedRevenue || 0;
    const paidRev = kpis.paidRevenue || 0;
    const leakageVND = funnel.totalLeakageVND || Math.max(0, placedRev - paidRev);
    const leakagePct = placedRev > 0 ? ((leakageVND / placedRev) * 100).toFixed(1) : '23.8';

    // Channel specific metrics
    const searchChannel = channels.find((c) => c.channelName.toLowerCase().includes('tìm kiếm')) ||
      channels.find((c) => c.channelName.toLowerCase().includes('search')) || {
        channelName: 'Tìm kiếm',
        retentionRate: 53.4,
        leakageAmount: leakageVND * 0.4,
      };

    const chatChannel = channels.find((c) => c.channelName.toLowerCase().includes('chat')) || {
      channelName: 'Chat',
      retentionRate: 0,
      leakageAmount: 0,
    };

    const totalAdsSpend = ads.reduce((acc, a) => acc + a.spend, 0);
    const totalAdsPaid = ads.reduce((acc, a) => acc + a.paidRevenue, 0);
    const roas = totalAdsSpend > 0 ? (totalAdsPaid / totalAdsSpend).toFixed(1) : '12.3';

    const newBuyerPct = retention && retention.totalBuyers > 0
      ? ((retention.newBuyers / retention.totalBuyers) * 100).toFixed(1)
      : '77.7';
    const returningPct = retention && retention.totalBuyers > 0
      ? ((retention.returningBuyers / retention.totalBuyers) * 100).toFixed(1)
      : '22.3';

    const normalDays = daily.filter((d) => !d.isDoubleDigitCampaign);
    const avgNormalRevenue = normalDays.length > 0
      ? Math.round(normalDays.reduce((acc, d) => acc + d.revenue, 0) / normalDays.length)
      : Math.round(paidRev / 30);

    const items: RoadmapItem[] = [
      // === 1. Ưu tiên cao — thực hiện trong 0–2 tuần ===
      {
        id: 'act-high-1',
        category: 'high',
        categoryLabel: 'Ưu tiên cao',
        categoryBadge: '0–2 tuần',
        timeframe: '0–2 tuần (Thực hiện ngay)',
        icon: MessageSquare,
        department: 'CSKH & Vận hành',
        action: 'Rà soát quy trình chốt đơn qua Chat (kiểm tra chatbot, thời gian phản hồi, xác nhận tồn kho trước khi seller báo giá)',
        targetKpi: 'Giảm tỷ lệ hủy đơn Chat từ 100% xuống dưới 20%',
        kpiHighlight: 'Hủy Chat < 20%',
        currentBaseline: `Hiện tại: Tỷ lệ rơi rớt đơn chat đang ở mức báo động (${chatChannel.retentionRate}% giữ chân)`,
        targetGoal: 'Mục tiêu: Đạt tỷ lệ phản hồi < 5 phút & chốt đơn thành công > 80%',
        details: [
          'Kiểm tra và sửa các nút bấm menu tự động trong Shopee Chat bị lỗi liên kết.',
          'Cài đặt câu trả lời tự động thông minh cung cấp mã giảm giá độc quyền cho khách chat trong 3 phút đầu.',
          'Đồng bộ tồn kho thời gian thực để nhân viên trực chat không tư vấn sản phẩm đã hết hàng.',
        ],
        status: 'pending',
      },
      {
        id: 'act-high-2',
        category: 'high',
        categoryLabel: 'Ưu tiên cao',
        categoryBadge: '0–2 tuần',
        timeframe: '0–2 tuần (Thực hiện ngay)',
        icon: AlertTriangle,
        department: 'Kho vận & CSKH',
        action: 'Kiểm tra nguyên nhân hủy đơn cụ thể (hết hàng, đổi ý, thời gian xử lý) qua báo cáo lý do hủy của Shopee, ưu tiên xử lý nhóm nguyên nhân chiếm tỷ trọng lớn nhất',
        targetKpi: `Giảm tỷ lệ hủy đơn tổng thể từ ${leakagePct}% xuống 12–15%`,
        kpiHighlight: 'Hủy đơn: 12–15%',
        currentBaseline: `Hiện tại: Thất thoát ${leakagePct}% (-${formatVND(leakageVND)})`,
        targetGoal: 'Mục tiêu: Cứu ít nhất 8.000.000đ - 10.000.000đ doanh thu rò rỉ mỗi chu kỳ',
        details: [
          'Phân loại nguyên nhân: Người mua hủy trước khi giao vs Hủy do giao hàng thất bại (COD).',
          'Gọi điện/nhắn tin xác thực địa chỉ cho 100% đơn COD giá trị > 300.000đ trong vòng 15 phút.',
          'Đóng gói đơn hàng nhanh trong ngày để bàn giao cho bưu tá trước 16h00 hàng ngày.',
        ],
        status: 'pending',
      },
      {
        id: 'act-high-3',
        category: 'high',
        categoryLabel: 'Ưu tiên cao',
        categoryBadge: '0–2 tuần',
        timeframe: '0–2 tuần (Thực hiện ngay)',
        icon: Compass,
        department: 'Marketing & SEO On-page',
        action: 'Tối ưu tiêu đề, hình ảnh bìa và mô tả sản phẩm cho từ khóa tìm kiếm chính (đối chiếu với sản phẩm đối thủ đang xếp hạng cao), đồng thời rút ngắn thời gian chuẩn bị hàng cho đơn từ Tìm kiếm',
        targetKpi: `Nâng tỷ lệ giữ chân kênh Tìm kiếm từ ${searchChannel.retentionRate}% lên trên 65%`,
        kpiHighlight: 'Giữ chân Tìm kiếm > 65%',
        currentBaseline: `Hiện tại: Kênh Tìm kiếm giữ chân ${searchChannel.retentionRate}% (thất thoát -${formatVND(searchChannel.leakageAmount)})`,
        targetGoal: 'Mục tiêu: Khách tìm thấy đúng nhu cầu, giảm tình trạng đặt nhầm rồi hủy đơn',
        details: [
          'Chèn bộ từ khóa có lượt tìm kiếm cao vào 50 ký tự đầu của tiêu đề sản phẩm.',
          'Bổ sung bảng quy đổi size / thành phần / hướng dẫn sử dụng rõ ràng ở ảnh số 2 và 3.',
          'Gắn khung bìa chuẩn nhận diện thương hiệu kèm các icon bảo hành / cam kết chính hãng.',
        ],
        status: 'pending',
      },

      // === 2. Ưu tiên trung bình — 2–6 tuần ===
      {
        id: 'act-med-1',
        category: 'medium',
        categoryLabel: 'Ưu tiên trung bình',
        categoryBadge: '2–6 tuần',
        timeframe: '2–6 tuần (Mở rộng & Tối ưu)',
        icon: Video,
        department: 'Content & Affiliate MCN',
        action: 'Phân tích các video Affiliate có hiệu suất tốt nhất (kịch bản, độ dài, hook mở đầu) và áp dụng định dạng tương tự cho Video do shop tự đăng',
        targetKpi: 'Tăng doanh số Video shop tự đăng thêm 30–50%',
        kpiHighlight: 'DT Video +30–50%',
        currentBaseline: 'Hiện tại: Doanh số video tự đăng còn chiếm tỷ trọng khiêm tốn so với KOC ngoài',
        targetGoal: 'Mục tiêu: Sản xuất 3-5 video ngắn/tuần với hook giải quyết nỗi đau khách hàng trong 3 giây đầu',
        details: [
          'Nghiên cứu 10 video triệu view của đối thủ cùng ngành về cấu trúc âm thanh trending và góc quay.',
          'Tối ưu nút gắn giỏ hàng màu vàng với voucher trợ giá riêng từ Shopee Video.',
          'Phát lại video chất lượng cao kèm livestream tự động vào các khung giờ nghỉ trưa.',
        ],
        status: 'pending',
      },
      {
        id: 'act-med-2',
        category: 'medium',
        categoryLabel: 'Ưu tiên trung bình',
        categoryBadge: '2–6 tuần',
        timeframe: '2–6 tuần (Mở rộng & Tối ưu)',
        icon: Zap,
        department: 'Live Commerce',
        action: 'Thiết kế lại lịch & kịch bản Livestream (ưu đãi độc quyền trong live, mời affiliate/KOC tham gia), tạm dừng ngân sách Dịch vụ hiển thị Live nếu không cải thiện sau 2 tuần thử nghiệm',
        targetKpi: 'ROAS Live tối thiểu 3 lần trong 4 tuần',
        kpiHighlight: 'ROAS Live ≥ 3.0x',
        currentBaseline: 'Hiện tại: Doanh thu livestream chưa tận dụng hết tệp voucher độc quyền sàn',
        targetGoal: 'Mục tiêu: Đưa Live Stream thành kênh doanh số chủ lực thứ 2 sau Thẻ sản phẩm',
        details: [
          'Định kỳ phát live tối thiểu 3 buổi/tuần (khung giờ 11h30 - 13h30 và 20h00 - 22h30).',
          'Tung deal chớp nhoáng (Flash Sale 1k/9k trong live) mỗi 20 phút để giữ chân mắt xem.',
          'Mời KOC micro-influencer đồng livestream để kéo tệp fan mới vào gian hàng.',
        ],
        status: 'pending',
      },
      {
        id: 'act-med-3',
        category: 'medium',
        categoryLabel: 'Ưu tiên trung bình',
        categoryBadge: '2–6 tuần',
        timeframe: '2–6 tuần (Mở rộng & Tối ưu)',
        icon: Target,
        department: 'CRM & Loyalty',
        action: 'Triển khai remarketing cho nhóm "người mua tiềm năng" (~1.000+ người) qua voucher cá nhân hóa, tin nhắn follow-up sau khi thêm giỏ hàng/theo dõi shop',
        targetKpi: `Tăng tỷ lệ khách quay lại lên trên 15% (Hiện tại: ${returningPct}%)`,
        kpiHighlight: 'Khách quay lại > 15–20%',
        currentBaseline: `Hiện tại: Tệp khách mới áp đảo (${newBuyerPct}%), khách mua lặp lại là ${returningPct}%`,
        targetGoal: 'Mục tiêu: Xây dựng vòng đời khách hàng bền vững, giảm phụ thuộc chi phí kéo khách mới',
        details: [
          'Tạo chiến dịch Shopee Tin Nhắn Quảng Bá gửi mã giảm giá 10-15k cho khách đã bỏ giỏ 48h qua.',
          'Thiết lập ưu đãi "Mua Lại Giảm Thêm" cho sản phẩm có chu kỳ tiêu dùng 30-45 ngày.',
          'Tặng voucher theo dõi shop (Follower Voucher) để chuyển đổi lượt view vãng lai thành fan cứng.',
        ],
        status: 'pending',
      },

      // === 3. Ưu tiên dài hạn — 1–3 tháng ===
      {
        id: 'act-long-1',
        category: 'long',
        categoryLabel: 'Ưu tiên dài hạn',
        categoryBadge: '1–3 tháng',
        timeframe: '1–3 tháng (Quy mô & Bền vững)',
        icon: Calendar,
        department: 'Chiến lược & Kinh doanh',
        action: 'Xây lịch mini-sale/flash sale riêng của shop vào các ngày không trùng lịch sale lớn của Shopee, kết hợp voucher shop + freeship riêng',
        targetKpi: 'Nâng doanh số baseline ngày thường thêm 20–30%',
        kpiHighlight: 'Baseline ngày thường +20–30%',
        currentBaseline: `Hiện tại: Doanh số ngày thường ~${formatVND(avgNormalRevenue)}/ngày, phụ thuộc nhiều vào đợt Mega Sale`,
        targetGoal: `Mục tiêu: Đưa doanh số ngày thường lên ${formatVND(Math.round(avgNormalRevenue * 1.25))}/ngày`,
        details: [
          'Chọn định kỳ "Thứ 4 Vui Vẻ" hoặc "Lương Về Giữa Tháng" làm ngày sale đặc trưng của shop.',
          'Kết hợp gói Freeship Xtra với mã giảm giá bậc thang (mua 2 giảm 5%, mua 3 giảm 10%).',
          'Đẩy mạnh truyền thông trước 24h qua Shopee Feed, Story và Broadcast tin nhắn.',
        ],
        status: 'pending',
      },
      {
        id: 'act-long-2',
        category: 'long',
        categoryLabel: 'Ưu tiên dài hạn',
        categoryBadge: '1–3 tháng',
        timeframe: '1–3 tháng (Quy mô & Bền vững)',
        icon: TrendingUp,
        department: 'Performance Ads',
        action: 'Tăng ngân sách GMV Max ROAS cho nhóm sản phẩm chủ lực và kênh Đề xuất/Cửa hàng (giữ chân tốt), hạn chế đổ thêm ngân sách vào riêng kênh Tìm kiếm cho đến khi tỷ lệ giữ chân cải thiện',
        targetKpi: `Duy trì ROAS tổng thể trên 10 lần khi mở rộng ngân sách (Hiện tại: ${roas}x)`,
        kpiHighlight: 'Duy trì ROAS > 10.0x',
        currentBaseline: `Hiện tại: ROAS đạt ${roas}x, hiệu quả rất tốt nhưng cần scale thông minh`,
        targetGoal: 'Mục tiêu: Tăng trưởng doanh thu quảng cáo +40% mà không bị suy giảm biên lợi nhuận',
        details: [
          'Tách riêng ngân sách: 70% cho 3 SKU Hero nhóm A, 20% cho nhóm B, 10% test sản phẩm mới.',
          'Bật tính năng Tối ưu hóa GMV Max tự động theo mục tiêu ROAS kỳ vọng của shop.',
          'Theo dõi chặt chẽ khung giờ ban đêm để hạ giá thầu tránh click ảo không ra đơn.',
        ],
        status: 'pending',
      },
      {
        id: 'act-long-3',
        category: 'long',
        categoryLabel: 'Ưu tiên dài hạn',
        categoryBadge: '1–3 tháng',
        timeframe: '1–3 tháng (Quy mô & Bền vững)',
        icon: Gift,
        department: 'Sản phẩm & Merchandise',
        action: 'Xây gói bán sỉ/đặt trước riêng cho các sản phẩm combo lớn (ví dụ Combo 10 xách 20 chai) hướng đến khách mua quà tặng doanh nghiệp, quà Tết',
        targetKpi: 'Tăng tỷ trọng đơn giá trị cao (>1 triệu đ/đơn)',
        kpiHighlight: 'Đơn > 1 triệu tăng 15%',
        currentBaseline: `Hiện tại: AOV trung bình ~${formatVND(kpis.aov)}/đơn`,
        targetGoal: 'Mục tiêu: Khai phá phân khúc khách hàng B2B, quà biếu và gia đình mua chung',
        details: [
          'Thiết kế bao bì hộp quà cao cấp, bổ sung túi xách sang trọng đi kèm combo.',
          'Kích hoạt tính năng "Hàng Đặt Trước" (Pre-order) nếu sản lượng yêu cầu sản xuất theo lô.',
          'Đưa chính sách chiết khấu trực tiếp trên giá bán khi mua từ số lượng 5 combo trở lên.',
        ],
        status: 'pending',
      },
      {
        id: 'act-long-4',
        category: 'long',
        categoryLabel: 'Ưu tiên dài hạn',
        categoryBadge: '1–3 tháng',
        timeframe: '1–3 tháng (Quy mô & Bền vững)',
        icon: RefreshCw,
        department: 'Merchandise & Kho',
        action: 'Rà soát và làm mới hình ảnh/giá cho nhóm sản phẩm 0 doanh số trong Live & Video để đưa vào vòng xoay nội dung định kỳ',
        targetKpi: 'Không còn sản phẩm hoạt động với 0 lượt hiển thị sau 1 tháng',
        kpiHighlight: '0 SKU Zombie 0 lượt xem',
        currentBaseline: 'Hiện tại: Còn các SKU đuôi dài (Nhóm C) chưa phát sinh đơn đều đặn',
        targetGoal: 'Mục tiêu: Đưa 100% SKU vào luồng hiển thị hoặc thanh lý dứt điểm để tối ưu vốn',
        details: [
          'Kiểm tra tiêu đề và ngành hàng của các SKU 0 view để đổi đúng từ khóa phổ biến.',
          'Đưa vào danh mục "Mua Kèm Deal Sốc 0đ" khi mua sản phẩm Hero chính.',
          'Nếu sau 45 ngày vẫn không có tương tác, tiến hành đóng gói xả kho dứt điểm.',
        ],
        status: 'pending',
      },
    ];

    return items;
  }, [data]);

  // Combine dynamic roadmap + custom tasks added by manager
  const roadmapItems = useMemo(() => {
    // Merge custom tasks and dynamic tasks, keeping custom overrides
    const combined: RoadmapItem[] = [...customTasks, ...dynamicRoadmap];
    const uniqueMap = new Map<string, RoadmapItem>();
    combined.forEach((item) => {
      uniqueMap.set(item.id, item);
    });
    return Array.from(uniqueMap.values());
  }, [customTasks, dynamicRoadmap]);

  // Notify parent on roadmap change
  useEffect(() => {
    if (onRoadmapChange) {
      onRoadmapChange(roadmapItems);
    }
  }, [roadmapItems, onRoadmapChange]);

  const toggleItemStatus = (id: string) => {
    const isCustom = customTasks.some((t) => t.id === id);
    let updatedRoadmap: RoadmapItem[] = [];

    if (isCustom) {
      const updatedCustoms = customTasks.map((t) => {
        if (t.id === id) {
          const nextStatus = t.status === 'completed' ? 'pending' : 'completed';
          if (nextStatus === 'completed') {
            try {
              confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
            } catch (e) {}
          }
          return { ...t, status: nextStatus as any, updatedAt: new Date().toLocaleString('vi-VN') };
        }
        return t;
      });
      saveCustomTasksToStorage(updatedCustoms);
      updatedRoadmap = roadmapItems.map((item) => {
        const match = updatedCustoms.find((c) => c.id === item.id);
        return match || item;
      });
    } else {
      const targetItem = roadmapItems.find((i) => i.id === id);
      if (targetItem) {
        const nextStatus = targetItem.status === 'completed' ? 'pending' : 'completed';
        if (nextStatus === 'completed') {
          try {
            confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
          } catch (e) {}
        }
        const updatedItem = {
          ...targetItem,
          status: nextStatus as any,
          updatedAt: new Date().toLocaleString('vi-VN'),
        };
        const updatedCustoms = [...customTasks.filter((t) => t.id !== id), updatedItem];
        saveCustomTasksToStorage(updatedCustoms);
        updatedRoadmap = roadmapItems.map((item) => (item.id === id ? updatedItem : item));
      }
    }

    if (onRoadmapChange) {
      onRoadmapChange(updatedRoadmap);
    }

    if (sheetsConfig?.spreadsheetId && sheetsConfig.autoSync && onSyncSheets) {
      onSyncSheets(updatedRoadmap);
    }
  };

  const toggleExpandItem = (id: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Add or edit task handler
  const handleSaveTask = (task: RoadmapActionItem) => {
    const isExisting = customTasks.some((t) => t.id === task.id) || dynamicRoadmap.some((t) => t.id === task.id);
    let updatedCustoms: RoadmapItem[] = [];

    if (isExisting) {
      updatedCustoms = customTasks.map((t) => (t.id === task.id ? { ...t, ...task } : t));
      if (!customTasks.some((t) => t.id === task.id)) {
        updatedCustoms.unshift({ ...task });
      }
    } else {
      updatedCustoms = [{ ...task, isCustom: true }, ...customTasks];
    }

    saveCustomTasksToStorage(updatedCustoms);

    const merged = [
      ...updatedCustoms,
      ...dynamicRoadmap.filter((d) => !updatedCustoms.some((c) => c.id === d.id)),
    ];

    if (onRoadmapChange) {
      onRoadmapChange(merged);
    }

    // Auto-sync to sheets if connected
    if (sheetsConfig?.spreadsheetId && onSyncSheets) {
      onSyncSheets(merged);
    }

    try {
      confetti({ particleCount: 25, spread: 45, origin: { y: 0.7 } });
    } catch (e) {}
  };

  // Delete task handler
  const handleDeleteTask = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa task giao việc này không?')) {
      const updatedCustoms = customTasks.filter((t) => t.id !== id);
      saveCustomTasksToStorage(updatedCustoms);

      const merged = roadmapItems.filter((i) => i.id !== id);
      if (onRoadmapChange) {
        onRoadmapChange(merged);
      }

      if (sheetsConfig?.spreadsheetId && onSyncSheets) {
        onSyncSheets(merged);
      }
    }
  };

  // Open modal for new task
  const handleOpenAddModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  // Open modal to edit existing task
  const handleOpenEditModal = (task: RoadmapItem) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  // Filter items
  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return roadmapItems;
    return roadmapItems.filter((i) => i.category === activeTab);
  }, [roadmapItems, activeTab]);

  const completedCount = roadmapItems.filter((i) => i.status === 'completed').length;
  const progressPercent = roadmapItems.length > 0 ? Math.round((completedCount / roadmapItems.length) * 100) : 0;

  // Copy full roadmap action table
  const handleCopyRoadmap = () => {
    let text = `=== ĐỀ XUẤT HÀNH ĐỘNG CHO DOANH NGHIỆP ===\nFile dữ liệu: ${data.fileName}\n\n`;

    const groups = [
      { key: 'high', title: 'ƯU TIÊN CAO — THỰC HIỆN TRONG 0–2 TUẦN' },
      { key: 'medium', title: 'ƯU TIÊN TRUNG BÌNH — 2–6 TUẦN' },
      { key: 'long', title: 'ƯU TIÊN DÀI HẠN — 1–3 THÁNG' },
    ];

    groups.forEach((g) => {
      text += `--- ${g.title} ---\n`;
      const groupItems = roadmapItems.filter((i) => i.category === g.key);
      groupItems.forEach((item, idx) => {
        text += `${idx + 1}. [${item.status === 'completed' ? 'ĐÃ XONG' : 'CẦN LÀM'}] ${item.action}\n`;
        if (item.assignee) text += `   • Người phụ trách: ${item.assignee}\n`;
        if (item.deadline) text += `   • Hạn chót: ${item.deadline}\n`;
        text += `   • Mục tiêu / KPI theo dõi: ${item.targetKpi}\n`;
        if (item.currentBaseline) text += `   • ${item.currentBaseline}\n`;
        if (item.targetGoal) text += `   • ${item.targetGoal}\n`;
        text += `\n`;
      });
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Export CSV
  const handleExportCsv = () => {
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'Cấp độ ưu tiên,Thời gian thực hiện,Bộ phận,Người phụ trách,Hạn chót,Hành động đề xuất,Mục tiêu / KPI theo dõi,Hiện trạng,Mục tiêu chi tiết,Trạng thái\n';

    roadmapItems.forEach((item) => {
      const row = [
        `"${item.categoryLabel}"`,
        `"${item.timeframe}"`,
        `"${item.department || ''}"`,
        `"${item.assignee || ''}"`,
        `"${item.deadline || ''}"`,
        `"${item.action.replace(/"/g, '""')}"`,
        `"${item.targetKpi.replace(/"/g, '""')}"`,
        `"${(item.currentBaseline || '').replace(/"/g, '""')}"`,
        `"${(item.targetGoal || '').replace(/"/g, '""')}"`,
        `"${item.status === 'completed' ? 'Đã hoàn thành' : 'Chưa xong'}"`,
      ].join(',');
      csv += row + '\r\n';
    });

    const encodedUri = encodeURI(csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EcomPulse_De_Xuat_Hanh_Dong_${data.fileName.replace(/\.(xlsx|xls|csv)$/i, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6 shadow-2xl border border-indigo-500/30 bg-gradient-to-br from-[#1b1938] via-[#131b2e] to-[#0f172a] space-y-6">
      {/* 1. Header with title and quick actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-5 border-b border-white/[0.08] gap-4">
        <div className="flex items-start sm:items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 border border-white/20 shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Đề Xuất Hành Động Cho Doanh Nghiệp (Action Roadmap)
              </h3>
              <span className="px-3 py-0.5 rounded-full text-xs font-black bg-rose-500/25 text-rose-300 border border-rose-400/40 uppercase tracking-wider backdrop-blur-md">
                Lộ Trình Giải Quyết
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
              Kế hoạch hành động từng bước gắn liền với mục tiêu & chỉ số KPI định lượng, tự động liên kết trực tiếp sang Google Sheets cho nhóm bán hàng
            </p>
          </div>
        </div>

        {/* Action Buttons & Progress */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Progress Badge */}
          <div className="glass-panel-subtle px-3.5 py-1.5 rounded-xl border border-white/10 flex items-center space-x-2 text-xs backdrop-blur-md">
            <span className="text-slate-300">Tiến độ thực thi:</span>
            <strong className="text-emerald-400 font-bold">
              {completedCount}/{roadmapItems.length} ({progressPercent}%)
            </strong>
          </div>

          {/* NEW: Add Task / Assign Work Button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-rose-500 hover:from-indigo-500 hover:to-rose-400 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-500/25 hover:scale-[1.02] active:scale-95"
            title="Thêm công việc mới, phân công nhân viên và đồng bộ sang Google Sheets"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Thêm Task / Giao Việc</span>
          </button>

          {/* Google Sheets Sync / Link Button */}
          {sheetsConfig ? (
            <div className="flex items-center gap-2">
              <a
                href={sheetsConfig.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/25 group"
                title="Mở Google Spreadsheet trực tuyến để nhóm bán hàng cùng làm việc"
              >
                <FileSpreadsheet className="w-4 h-4 text-slate-950 group-hover:scale-110 transition-transform" />
                <span>Mở Google Sheet</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-950" />
              </a>

              <button
                type="button"
                onClick={() => onSyncSheets && onSyncSheets(roadmapItems)}
                disabled={isSyncing}
                className="px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 border border-white/[0.12] text-xs font-semibold transition-all flex items-center gap-1.5"
                title="Đồng bộ lại lộ trình sang Google Sheets"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ'}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenSheetsModal}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 animate-pulse hover:animate-none"
              title="Tạo hoặc liên kết trang tính Google Sheets trực tuyến cho cả team cùng làm việc"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-950" />
              <span>Liên Kết Google Sheets</span>
            </button>
          )}

          {/* Export CSV Offline Button */}
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 border border-white/[0.1] text-xs font-medium transition-all flex items-center gap-1.5"
            title="Tải file CSV về máy tính để lưu trữ offline"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
            <span>Xuất CSV</span>
          </button>

          {/* Copy Roadmap */}
          <button
            onClick={handleCopyRoadmap}
            className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 border border-white/[0.1] text-xs font-medium transition-all flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Đã chép!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Sao chép</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Priority Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border shadow-sm ${
            activeTab === 'all'
              ? 'bg-indigo-600 text-white border-indigo-400 shadow-indigo-600/30'
              : 'glass-panel-subtle text-slate-300 border-white/10 hover:bg-white/[0.1]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Tất Cả Các Khung Giờ ({roadmapItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('high')}
          className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border shadow-sm ${
            activeTab === 'high'
              ? 'bg-rose-600 text-white border-rose-400 shadow-rose-600/30'
              : 'glass-panel-subtle text-rose-300 border-rose-500/20 hover:bg-rose-500/10'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-rose-400" />
          <span>Ưu Tiên Cao (0–2 Tuần)</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-rose-500/30 font-black">
            {roadmapItems.filter((i) => i.category === 'high').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('medium')}
          className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border shadow-sm ${
            activeTab === 'medium'
              ? 'bg-amber-600 text-white border-amber-400 shadow-amber-600/30'
              : 'glass-panel-subtle text-amber-300 border-amber-500/20 hover:bg-amber-500/10'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Ưu Tiên Trung Bình (2–6 Tuần)</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500/30 font-black">
            {roadmapItems.filter((i) => i.category === 'medium').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('long')}
          className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border shadow-sm ${
            activeTab === 'long'
              ? 'bg-cyan-600 text-white border-cyan-400 shadow-cyan-600/30'
              : 'glass-panel-subtle text-cyan-300 border-cyan-500/20 hover:bg-cyan-500/10'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          <span>Ưu Tiên Dài Hạn (1–3 Tháng)</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-cyan-500/30 font-black">
            {roadmapItems.filter((i) => i.category === 'long').length}
          </span>
        </button>
      </div>

      {/* 3. Action Cards Matrix Table View */}
      <div className="space-y-4">
        {filteredItems.map((item, idx) => {
          const isExpanded = expandedItems[item.id] ?? false;
          const isHigh = item.category === 'high';
          const isMedium = item.category === 'medium';
          const isCompleted = item.status === 'completed';
          const IconComp = item.icon || Briefcase;

          return (
            <div
              key={item.id}
              id={`roadmap-item-${item.id}`}
              className={`rounded-2xl border transition-all duration-300 overflow-hidden shadow-lg ${
                isCompleted
                  ? 'bg-emerald-950/20 border-emerald-500/30 opacity-85'
                  : isHigh
                  ? 'bg-gradient-to-r from-rose-950/25 via-slate-900/60 to-slate-900/60 border-rose-500/30 hover:border-rose-400/50'
                  : isMedium
                  ? 'bg-gradient-to-r from-amber-950/25 via-slate-900/60 to-slate-900/60 border-amber-500/30 hover:border-amber-400/50'
                  : 'bg-gradient-to-r from-cyan-950/25 via-slate-900/60 to-slate-900/60 border-cyan-500/30 hover:border-cyan-400/50'
              }`}
            >
              {/* Row Summary Bar */}
              <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left side: Checkbox + Action Name + Assignee & Badges */}
                <div className="flex items-start space-x-3.5 flex-1">
                  <button
                    onClick={() => toggleItemStatus(item.id)}
                    className="mt-1 text-slate-400 hover:text-white transition-colors shrink-0"
                    title={isCompleted ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu đã hoàn thành'}
                  >
                    {isCompleted ? (
                      <CheckSquare className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400 hover:text-indigo-300" />
                    )}
                  </button>

                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border backdrop-blur-md ${
                          isHigh
                            ? 'bg-rose-500/30 text-rose-200 border-rose-400/40'
                            : isMedium
                            ? 'bg-amber-500/30 text-amber-200 border-amber-400/40'
                            : 'bg-cyan-500/30 text-cyan-200 border-cyan-400/40'
                        }`}
                      >
                        {item.categoryLabel} • {item.categoryBadge}
                      </span>

                      {item.department && (
                        <span className="text-[11px] text-slate-300 font-medium bg-white/[0.06] px-2.5 py-0.5 rounded-md border border-white/[0.1] flex items-center gap-1">
                          <Users className="w-3 h-3 text-indigo-400" />
                          <span>{item.department}</span>
                        </span>
                      )}

                      {item.assignee && (
                        <span className="text-[11px] text-emerald-300 font-semibold bg-emerald-950/40 px-2.5 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1">
                          <User className="w-3 h-3 text-emerald-400" />
                          <span>Phụ trách: {item.assignee}</span>
                        </span>
                      )}

                      {item.deadline && (
                        <span className="text-[11px] text-amber-300 font-medium bg-amber-950/40 px-2.5 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-400" />
                          <span>Hạn: {item.deadline}</span>
                        </span>
                      )}

                      {item.isCustom && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-400/30 uppercase tracking-wider">
                          Giao Việc Mới
                        </span>
                      )}

                      {isCompleted && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/25 text-emerald-300 border border-emerald-400/30">
                          ✓ Đã thực hiện
                        </span>
                      )}
                    </div>

                    <h4
                      className={`text-sm sm:text-base font-bold text-white leading-snug ${
                        isCompleted ? 'line-through text-slate-400' : ''
                      }`}
                    >
                      {item.action}
                    </h4>
                  </div>
                </div>

                {/* Right side: KPI Metric Box + Action Buttons (Edit / Delete / Expand) */}
                <div className="flex items-center justify-between lg:justify-end gap-2.5 shrink-0 lg:w-[460px]">
                  {/* KPI Target Box */}
                  <div className="flex-1 rounded-xl p-3 bg-black/40 border border-white/[0.1] shadow-inner">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Target className="w-3 h-3 text-amber-400" />
                        Mục tiêu / KPI theo dõi:
                      </span>
                      {item.kpiHighlight && (
                        <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-400/30">
                          {item.kpiHighlight}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-emerald-300 leading-snug">
                      {item.targetKpi}
                    </p>
                  </div>

                  {/* Edit Task Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(item)}
                    className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-indigo-600/30 hover:text-indigo-300 text-slate-400 border border-white/10 flex items-center justify-center transition-colors"
                    title="Chỉnh sửa thông tin công việc hoặc người phụ trách"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Task Button (Custom or User-managed) */}
                  {item.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(item.id)}
                      className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-rose-600/30 hover:text-rose-300 text-slate-400 border border-white/10 flex items-center justify-center transition-colors"
                      title="Xóa công việc này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Toggle Details Chevron */}
                  <button
                    onClick={() => toggleExpandItem(item.id)}
                    className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-slate-300 shrink-0 transition-colors"
                    title="Xem chi tiết các bước thực thi"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expandable Step-by-Step Execution Guide */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-white/[0.06] bg-black/30 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {item.currentBaseline && (
                      <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/20 text-rose-200">
                        <span className="font-bold block text-rose-300 mb-0.5">📌 Hiện trạng số liệu:</span>
                        {item.currentBaseline}
                      </div>
                    )}
                    {item.targetGoal && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-200">
                        <span className="font-bold block text-emerald-300 mb-0.5">🎯 Kỳ vọng đạt được:</span>
                        {item.targetGoal}
                      </div>
                    )}
                  </div>

                  {item.details && item.details.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                        Các bước triển khai cụ thể:
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {item.details.map((step, sIdx) => (
                          <li key={sIdx} className="flex items-start space-x-2">
                            <span className="text-indigo-400 font-bold mt-0.5">Step {sIdx + 1}:</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Task Creation & Assignment Modal */}
      <AddRoadmapTaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        initialTask={editingTask}
        hasSheetsConnected={!!sheetsConfig?.spreadsheetId}
        language={language}
      />
    </div>
  );
};
