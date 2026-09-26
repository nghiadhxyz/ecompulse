import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloudAiAllowed, getAiPrivacyMode, grantCloudConsent, revokeCloudConsent, setAiPrivacyMode } from '../aiPrivacy';
import { aiChat, aiRephrase } from '../aiClient';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

describe('AI privacy modes', () => {
  beforeEach(() => {
    store.clear();
    vi.restoreAllMocks();
  });

  it('defaults to Local Only', () => {
    expect(getAiPrivacyMode()).toBe('local_only');
    expect(cloudAiAllowed()).toBe(false);
  });

  it('Cloud AI needs both the mode and consent', () => {
    setAiPrivacyMode('cloud_ai');
    expect(cloudAiAllowed()).toBe(false);
    grantCloudConsent();
    expect(cloudAiAllowed()).toBe(true);
    revokeCloudConsent();
    expect(getAiPrivacyMode()).toBe('local_only');
  });

  it('Local Only never calls the network', async () => {
    const f = vi.fn();
    (globalThis as any).fetch = f;
    const r = await aiChat({ message: 'hi', history: [], analyticsData: { gmv: 1 }, language: 'vi' });
    expect(r.source).toBe('blocked');
    expect((await aiRephrase({ insight: 'x' }, 'vi')).source).toBe('blocked');
    expect(f).not.toHaveBeenCalled();
  });

  it('Cloud AI without consent is blocked too', async () => {
    const f = vi.fn();
    (globalThis as any).fetch = f;
    setAiPrivacyMode('cloud_ai');
    expect((await aiChat({ message: 'hi', history: [], analyticsData: null, language: 'vi' })).source).toBe('blocked');
    expect(f).not.toHaveBeenCalled();
  });

  it('Privacy AI calls only the configured local endpoint, never /api', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) }));
    (globalThis as any).fetch = f;
    setAiPrivacyMode('privacy_ai');
    const r = await aiChat({ message: 'hi', history: [], analyticsData: null, language: 'vi' });
    expect(r).toEqual({ text: 'ok', source: 'local_llm' });
    expect(String((f.mock.calls[0] as unknown[])[0])).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('server template fallbacks are not shown as AI answers', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({ ok: true, json: async () => ({ reply: 'Doanh thu 382.000.000 ₫', isFallback: true }) }));
    setAiPrivacyMode('cloud_ai');
    grantCloudConsent();
    const r = await aiChat({ message: 'hi', history: [], analyticsData: null, language: 'vi' });
    expect(r.source).toBe('unavailable');
    expect(r.text).not.toContain('382');
  });
});
