/**
 * Single entry point for AI calls from the browser. Enforces the AI privacy mode:
 * nothing is sent anywhere unless the user chose Privacy AI (their own model) or
 * Cloud AI (with consent). Server "fallback" replies are never shown as AI answers,
 * because they are templates, not analysis of the user's numbers.
 */
import { blockedMessage, cloudAiAllowed, getAiPrivacyMode, localLlmChat, REPHRASE_SYSTEM_PROMPT_VI, type ChatTurn } from './aiPrivacy';
import { getSavedCustomApiKey } from './dataAnonymizer';

export type AiSource = 'cloud' | 'local_llm' | 'blocked' | 'unavailable';

export interface AiReply {
  text: string;
  source: AiSource;
}

const UNAVAILABLE_VI = 'Cloud AI chưa khả dụng (chưa có API key hoặc đã hết hạn mức). EcomPulse không hiển thị câu trả lời mẫu thay cho phân tích thật.';
const UNAVAILABLE_EN = 'Cloud AI is unavailable (no API key or quota reached). EcomPulse does not show template answers in place of real analysis.';

export function unavailableMessage(lang: 'vi' | 'en'): string {
  return lang === 'vi' ? UNAVAILABLE_VI : UNAVAILABLE_EN;
}

/** Posts to a Cloud AI endpoint only when allowed. Returns null when blocked. */
export async function cloudAiPost<T = any>(path: string, body: Record<string, unknown>): Promise<T | null> {
  if (!cloudAiAllowed()) return null;
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: getSavedCustomApiKey() || undefined, ...body }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface ChatRequest {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  /** Aggregated, anonymized store data (anonymizeStoreDataForAI). */
  analyticsData: unknown;
  language: 'vi' | 'en';
  model?: string;
  apiKey?: string;
}

export async function aiChat(req: ChatRequest): Promise<AiReply> {
  const mode = getAiPrivacyMode();
  if (mode === 'privacy_ai') {
    const system: ChatTurn = {
      role: 'system',
      content: [
        req.language === 'vi' ? 'Bạn là Dolphin, trợ lý phân tích bán hàng. Trả lời bằng tiếng Việt, ngắn gọn.' : 'You are Dolphin, a sales analytics assistant.',
        'Chỉ dùng số liệu trong DỮ LIỆU bên dưới; nếu thiếu thì nói "Không đủ dữ liệu". Không bịa số.',
        'Không khẳng định nguyên nhân — dùng "liên quan / đi cùng / đóng góp / cần kiểm tra".',
        `DỮ LIỆU: ${JSON.stringify(req.analyticsData ?? null)}`,
      ].join('\n'),
    };
    try {
      const text = await localLlmChat([system, ...req.history.slice(-6), { role: 'user', content: req.message }]);
      return { text, source: 'local_llm' };
    } catch {
      return {
        text: req.language === 'vi' ? 'Không kết nối được mô hình AI trên máy (kiểm tra địa chỉ và model trong Cài đặt → Quyền riêng tư AI).' : 'Could not reach the local model.',
        source: 'unavailable',
      };
    }
  }
  if (!cloudAiAllowed()) return { text: blockedMessage(req.language), source: 'blocked' };
  try {
    const json = await cloudAiPost<{ reply?: string; isFallback?: boolean }>('/api/ai/chat-analyst', {
      message: req.message,
      conversationHistory: req.history.slice(-6),
      analyticsData: req.analyticsData,
      language: req.language,
      model: req.model,
      ...(req.apiKey ? { apiKey: req.apiKey } : {}),
    });
    if (!json || json.isFallback || !json.reply) return { text: unavailableMessage(req.language), source: 'unavailable' };
    return { text: json.reply, source: 'cloud' };
  } catch {
    return { text: unavailableMessage(req.language), source: 'unavailable' };
  }
}

/** Rephrases a Dolphin evidence answer (aggregates only) with the allowed model. */
export async function aiRephrase(payload: unknown, lang: 'vi' | 'en'): Promise<AiReply> {
  const mode = getAiPrivacyMode();
  if (mode === 'privacy_ai') {
    try {
      const text = await localLlmChat([
        { role: 'system', content: REPHRASE_SYSTEM_PROMPT_VI },
        { role: 'user', content: JSON.stringify(payload) },
      ]);
      return { text, source: 'local_llm' };
    } catch {
      return { text: lang === 'vi' ? 'Không kết nối được mô hình AI trên máy.' : 'Could not reach the local model.', source: 'unavailable' };
    }
  }
  if (!cloudAiAllowed()) return { text: blockedMessage(lang), source: 'blocked' };
  try {
    const json = await cloudAiPost<{ ok: boolean; text?: string }>('/api/ai/rephrase-evidence', { answer: payload, language: lang });
    if (!json?.ok || !json.text) return { text: unavailableMessage(lang), source: 'unavailable' };
    return { text: json.text, source: 'cloud' };
  } catch {
    return { text: unavailableMessage(lang), source: 'unavailable' };
  }
}
