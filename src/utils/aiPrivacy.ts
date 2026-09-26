/**
 * AI privacy modes. Every AI call in the app goes through these checks.
 *
 * - local_only: no AI model is called. Answers come from the local analytics engine.
 * - privacy_ai: a model running on this machine / network (Ollama, LM Studio or any
 *   OpenAI-compatible endpoint), called directly from the browser. Nothing reaches the
 *   EcomPulse server or a cloud provider.
 * - cloud_ai: Gemini through the EcomPulse server. Only aggregated, anonymized numbers
 *   are sent, and only after the user has read and accepted the disclosure.
 *
 * Settings live only in this browser (localStorage).
 */
export type AiPrivacyMode = 'local_only' | 'privacy_ai' | 'cloud_ai';

export interface LocalLlmConfig {
  /** Base URL of an OpenAI-compatible server, e.g. http://localhost:11434 (Ollama). */
  baseUrl: string;
  model: string;
}

const MODE_KEY = 'ecompulse_ai_privacy_mode';
const CONSENT_KEY = 'ecompulse_cloud_ai_consent';
const LLM_KEY = 'ecompulse_local_llm';

export const DEFAULT_LOCAL_LLM: LocalLlmConfig = { baseUrl: 'http://localhost:11434', model: 'qwen2.5:7b' };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the setting lasts for this page only.
  }
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
export function onAiPrivacyChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAiPrivacyMode(): AiPrivacyMode {
  const v = read(MODE_KEY);
  return v === 'privacy_ai' || v === 'cloud_ai' ? v : 'local_only';
}

export function setAiPrivacyMode(mode: AiPrivacyMode): void {
  write(MODE_KEY, mode);
  notify();
}

export function hasCloudConsent(): boolean {
  return !!read(CONSENT_KEY);
}

export function getCloudConsentDate(): string | null {
  return read(CONSENT_KEY);
}

export function grantCloudConsent(): void {
  write(CONSENT_KEY, new Date().toISOString());
  notify();
}

export function revokeCloudConsent(): void {
  write(CONSENT_KEY, null);
  if (getAiPrivacyMode() === 'cloud_ai') write(MODE_KEY, 'local_only');
  notify();
}

/** True only when Cloud AI is selected AND the disclosure was accepted. */
export function cloudAiAllowed(): boolean {
  return getAiPrivacyMode() === 'cloud_ai' && hasCloudConsent();
}

export function getLocalLlmConfig(): LocalLlmConfig {
  try {
    const v = JSON.parse(read(LLM_KEY) ?? 'null');
    if (v && typeof v.baseUrl === 'string' && typeof v.model === 'string') return v;
  } catch {
    // ignore malformed value
  }
  return DEFAULT_LOCAL_LLM;
}

export function setLocalLlmConfig(cfg: LocalLlmConfig): void {
  write(LLM_KEY, JSON.stringify({ baseUrl: cfg.baseUrl.trim().replace(/\/+$/, ''), model: cfg.model.trim() }));
  notify();
}

export const PRIVACY_MODE_INFO: Record<AiPrivacyMode, { vi: string; en: string; descVi: string; descEn: string }> = {
  local_only: {
    vi: 'Local Only',
    en: 'Local Only',
    descVi: 'Không gọi mô hình AI nào. Dolphin trả lời bằng số liệu tính trên máy bạn. Không dữ liệu nào rời trình duyệt.',
    descEn: 'No AI model is called. Dolphin answers from numbers computed on your device. No data leaves the browser.',
  },
  privacy_ai: {
    vi: 'Privacy AI (mô hình chạy trên máy)',
    en: 'Privacy AI (on-device model)',
    descVi: 'Dùng mô hình AI chạy trên máy/mạng nội bộ của bạn (Ollama, LM Studio…). Dữ liệu tổng hợp chỉ gửi tới địa chỉ bạn cấu hình, không qua máy chủ EcomPulse.',
    descEn: 'Uses a model on your machine / local network (Ollama, LM Studio…). Aggregates go only to the address you configure, never to the EcomPulse server.',
  },
  cloud_ai: {
    vi: 'Cloud AI (Gemini)',
    en: 'Cloud AI (Gemini)',
    descVi: 'Gửi số liệu tổng hợp đã ẩn danh (không có đơn hàng, tên, SĐT, địa chỉ) tới máy chủ EcomPulse và Google Gemini để diễn đạt câu trả lời. Không phải "zero knowledge".',
    descEn: 'Sends anonymized aggregates (no orders, names, phones, addresses) to the EcomPulse server and Google Gemini. This is not "zero knowledge".',
  },
};

export class AiBlockedError extends Error {
  constructor(public mode: AiPrivacyMode) {
    super(`AI call blocked by privacy mode ${mode}`);
  }
}

/** Message shown instead of an AI answer when the current mode does not allow the call. */
export function blockedMessage(lang: 'vi' | 'en' = 'vi'): string {
  const mode = getAiPrivacyMode();
  if (lang === 'en') {
    return mode === 'cloud_ai'
      ? 'Cloud AI needs your consent first (Settings → AI privacy).'
      : `AI is set to ${PRIVACY_MODE_INFO[mode].en}. Nothing was sent. Switch to Cloud AI in Settings → AI privacy to use this feature.`;
  }
  return mode === 'cloud_ai'
    ? 'Cloud AI cần bạn xác nhận đồng ý trước (Cài đặt → Quyền riêng tư AI).'
    : `AI đang ở chế độ ${PRIVACY_MODE_INFO[mode].vi} — không dữ liệu nào được gửi đi. Bật Cloud AI trong Cài đặt → Quyền riêng tư AI nếu muốn dùng tính năng này.`;
}

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Calls an OpenAI-compatible chat endpoint directly from the browser. */
export async function localLlmChat(messages: ChatTurn[], cfg: LocalLlmConfig = getLocalLlmConfig(), signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: cfg.model, messages, temperature: 0.2, stream: false }),
    signal,
  });
  if (!res.ok) throw new Error(`Local model error ${res.status}`);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Local model returned no text');
  return text.trim();
}

/** Lists models of the local server (OpenAI-compatible /v1/models). */
export async function testLocalLlm(cfg: LocalLlmConfig): Promise<string[]> {
  const res = await fetch(`${cfg.baseUrl}/v1/models`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data.map((m: { id: string }) => m.id) : [];
}

/** Instructions for any model that rephrases an evidence answer. */
export const REPHRASE_SYSTEM_PROMPT_VI = [
  'Bạn là Dolphin, trợ lý phân tích bán hàng.',
  'Chỉ diễn đạt lại câu trả lời có cấu trúc được cung cấp bằng tiếng Việt tự nhiên, ngắn gọn.',
  'KHÔNG thêm, bớt hay tính lại bất kỳ con số nào. KHÔNG bịa dữ liệu.',
  'KHÔNG khẳng định nguyên nhân: dùng "liên quan", "đi cùng", "đóng góp", "cần kiểm tra", không dùng "gây ra", "do".',
  'Nếu có trường unavailable, nói rõ là không đủ dữ liệu.',
  'Giữ 4 phần: Nhận định, Bằng chứng, Diễn giải, Nên kiểm tra.',
].join('\n');
