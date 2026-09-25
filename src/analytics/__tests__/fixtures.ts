import { emptyDataset, type CanonicalDataset, type Order, type OrderLine } from '../model';

export function order(partial: Partial<Order> & Pick<Order, 'orderId' | 'orderDate' | 'status'>): Order {
  return { platform: 'shopee', ...partial };
}

export function line(partial: Partial<OrderLine> & Pick<OrderLine, 'orderId' | 'sku' | 'quantity' | 'grossAmount'>): OrderLine {
  return { ...partial };
}

export function dataset(orders: Order[], lines: OrderLine[], extra: Partial<CanonicalDataset> = {}): CanonicalDataset {
  return { ...emptyDataset('test', 'Test'), orders, orderLines: lines, ...extra };
}

/**
 * Hand-checkable fixture (all amounts in thousand VND ×1000):
 *
 *  O1 01/09 shopee completed : A×2 gross 200 (seller disc 20) + B×1 gross 100 · platform fee 30 · ship 15
 *  O2 01/09 shopee cancelled : A×1 gross 100
 *  O3 02/09 tiktok returned  : B×1 gross 100 (no refund amount → full refund assumed)
 *  O4 02/09 tiktok delivered : C×3 gross 300, line refund 50
 *
 *  placed 4 · valid 3 · cancelled 1 · GMV 700 · placed GMV 800 · discount 20 · refund 150
 *  net revenue 530 · units 7 · AOV 233.33 · cancel 25% · refund rate 1/3 · completion 50%
 *  COGS: A 40, B 30, C missing → known COGS 110 (O3 returned consumes none)
 */
export function baseFixture(): CanonicalDataset {
  const k = 1000;
  return dataset(
    [
      order({ orderId: 'O1', orderDate: '2025-09-01', status: 'completed', customerId: 'c1', platformFee: 30 * k, shippingFeeSeller: 15 * k }),
      order({ orderId: 'O2', orderDate: '2025-09-01', status: 'cancelled', customerId: 'c2', cancelReason: 'Đổi ý' }),
      order({ orderId: 'O3', orderDate: '2025-09-02', status: 'returned', platform: 'tiktok', customerId: 'c1' }),
      order({ orderId: 'O4', orderDate: '2025-09-02', status: 'delivered', platform: 'tiktok', customerId: 'c3' }),
    ],
    [
      line({ orderId: 'O1', sku: 'A', quantity: 2, grossAmount: 200 * k, sellerDiscount: 20 * k }),
      line({ orderId: 'O1', sku: 'B', quantity: 1, grossAmount: 100 * k }),
      line({ orderId: 'O2', sku: 'A', quantity: 1, grossAmount: 100 * k }),
      line({ orderId: 'O3', sku: 'B', quantity: 1, grossAmount: 100 * k }),
      line({ orderId: 'O4', sku: 'C', quantity: 3, grossAmount: 300 * k, refundAmount: 50 * k }),
    ],
    {
      products: [
        { sku: 'A', name: 'Sản phẩm A', category: 'Mẹ & Bé', subcategory: 'Tã', unitCogs: 40 * k },
        { sku: 'B', name: 'Sản phẩm B', category: 'Mẹ & Bé', subcategory: 'Sữa', unitCogs: 30 * k },
        { sku: 'C', name: 'Sản phẩm C', category: 'Làm đẹp' },
      ],
    },
  );
}

export const SEPT_1_2 = { start: '2025-09-01', end: '2025-09-02' };
