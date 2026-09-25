/**
 * Workspace merge: combines imported files into one canonical dataset.
 * Re-importing an overlapping export replaces the orders it contains (latest file wins),
 * so the same order is never counted twice.
 */
import { emptyDataset, type CanonicalDataset, type CostSettings, type Order, type OrderLine, type Product } from './model';

const WORKSPACE_ID = 'workspace';

function keyed<T>(rows: T[], key: (r: T) => string): Map<string, T> {
  return new Map(rows.map((r) => [key(r), r]));
}

function mergeKeyed<T>(base: T[], incoming: T[], key: (r: T) => string): T[] {
  const map = keyed(base, key);
  for (const r of incoming) map.set(key(r), r);
  return Array.from(map.values());
}

function mergeProduct(a: Product | undefined, b: Product): Product {
  if (!a) return b;
  return {
    ...a,
    name: a.name ?? b.name,
    category: a.category ?? b.category,
    subcategory: a.subcategory ?? b.subcategory,
    productId: a.productId ?? b.productId,
    listPrice: b.listPrice ?? a.listPrice,
    // A cost present in the newer file updates the catalog.
    unitCogs: b.unitCogs ?? a.unitCogs,
  };
}

export function mergeIntoWorkspace(base: CanonicalDataset | null, incoming: CanonicalDataset): CanonicalDataset {
  const ws = base ? { ...base } : emptyDataset(WORKSPACE_ID, 'Dữ liệu của shop');
  ws.id = WORKSPACE_ID;

  // Orders: key by platform + id. An id that already belongs to another platform gets prefixed.
  const orderKey = (o: Order) => `${o.platform}|${o.orderId}`;
  const baseById = new Map(ws.orders.map((o) => [o.orderId, o.platform]));
  const renamed = new Map<string, string>();
  const incomingOrders = incoming.orders.map((o) => {
    const owner = baseById.get(o.orderId);
    if (owner && owner !== o.platform) {
      const id = `${o.platform}:${o.orderId}`;
      renamed.set(o.orderId, id);
      return { ...o, orderId: id };
    }
    return o;
  });
  const incomingLines: OrderLine[] = incoming.orderLines.map((l) => (renamed.has(l.orderId) ? { ...l, orderId: renamed.get(l.orderId)! } : l));

  const replaced = new Set(incomingOrders.map(orderKey));
  const replacedIds = new Set(incomingOrders.map((o) => o.orderId));
  const keptOrders = ws.orders.filter((o) => !replaced.has(orderKey(o)));
  ws.orders = [...keptOrders, ...incomingOrders];
  ws.orderLines = [...ws.orderLines.filter((l) => !replacedIds.has(l.orderId)), ...incomingLines];

  const products = keyed(ws.products, (p) => p.sku);
  for (const p of incoming.products) products.set(p.sku, mergeProduct(products.get(p.sku), p));
  ws.products = Array.from(products.values());

  ws.combos = mergeKeyed(ws.combos, incoming.combos, (c) => c.comboId);
  ws.campaigns = mergeKeyed(ws.campaigns, incoming.campaigns, (c) => c.campaignId);
  ws.ads = mergeKeyed(ws.ads, incoming.ads, (a) => `${a.date}|${a.platform}|${a.campaignId ?? ''}|${a.adName ?? ''}|${a.sku ?? ''}`);
  ws.liveSessions = mergeKeyed(ws.liveSessions, incoming.liveSessions, (s) => `${s.platform}|${s.sessionId}`);
  ws.affiliates = mergeKeyed(ws.affiliates, incoming.affiliates, (a) => `${a.date ?? ''}|${a.platform}|${a.creatorId}|${a.contentId ?? ''}`);
  ws.traffic = mergeKeyed(ws.traffic, incoming.traffic, (t) => `${t.date}|${t.platform}|${t.sku ?? ''}`);
  ws.dailyMetrics = mergeKeyed(ws.dailyMetrics, incoming.dailyMetrics, (d) => `${d.date}|${d.platform}`);
  ws.costs = [...ws.costs, ...incoming.costs];
  ws.settlements = [...ws.settlements, ...incoming.settlements];
  ws.changeEvents = mergeKeyed(ws.changeEvents, incoming.changeEvents, (c) => c.id);
  ws.sources = [...ws.sources, ...incoming.sources];
  ws.importNotes = [...(ws.importNotes || []), ...(incoming.importNotes || [])];
  ws.estimatedFields = Array.from(new Set([...(ws.estimatedFields || []), ...(incoming.estimatedFields || [])]));
  return ws;
}

/** Returns a new dataset object carrying these cost settings (engines cache per object). */
export function withCostSettings(dataset: CanonicalDataset, settings: CostSettings | undefined): CanonicalDataset {
  return { ...dataset, costSettings: settings };
}
