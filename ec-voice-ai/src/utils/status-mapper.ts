/**
 * 注文ステータス変換ユーティリティ
 */

import { Order, OrderStatus, ReturnReason, ProductCondition } from '../types/index.js';

/** ステータスID → 内部ステータスのマッピング */
const STATUS_MAP: Record<string, OrderStatus> = {
  '10': 'pending',     // 新規受付
  '20': 'preparing',   // 出荷待ち
  '30': 'confirmed',   // 出荷確定
  '40': 'shipped',     // 出荷済み
  '50': 'delivered',   // 配達完了
  '99': 'cancelled',   // キャンセル
};

/** ステータス日本語名 */
const STATUS_NAMES: Record<OrderStatus, string> = {
  pending: '起票済み',
  preparing: '出荷準備中',
  confirmed: '出荷確定',
  shipped: '出荷済み',
  delivered: '配達完了',
  cancelled: 'キャンセル',
  returned: '返品済み',
};

/**
 * ネクストエンジンのステータスIDを内部ステータスに変換
 */
export function mapStatus(confirmId: string): OrderStatus {
  return STATUS_MAP[confirmId] || 'pending';
}

/**
 * ステータスの日本語名を取得
 */
export function getStatusName(status: OrderStatus): string {
  return STATUS_NAMES[status] || '確認中';
}

/**
 * 注文情報から顧客向けステータスメッセージを生成
 */
export function getStatusMessage(order: Order): string {
  const { status, carrier, trackingNumber } = order;

  switch (status) {
    case 'pending':
      return 'ご注文を承りました。発送準備を進めております。';

    case 'preparing':
      return '発送準備中です。まもなく発送いたします。';

    case 'confirmed':
      return '本日発送予定です。';

    case 'shipped':
      if (carrier && trackingNumber) {
        return `発送済みです。${carrier}でお届け予定です。追跡番号は${trackingNumber}です。`;
      }
      return '発送済みです。';

    case 'delivered':
      return 'お届け済みとなっております。';

    case 'cancelled':
      return 'キャンセル処理が完了しております。';

    case 'returned':
      return '返品処理が完了しております。';

    default:
      return 'ご注文を確認中です。';
  }
}

/**
 * 配送業者名から追跡URLを生成
 */
export function getTrackingUrl(carrier: string | null, trackingNumber: string | null): string | null {
  if (!carrier || !trackingNumber) {
    return null;
  }

  const num = trackingNumber.replace(/-/g, '');

  if (carrier.includes('ヤマト')) {
    return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number=${num}`;
  }

  if (carrier.includes('佐川')) {
    return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${num}`;
  }

  if (carrier.includes('日本郵便') || carrier.includes('ゆうパック') || carrier.includes('郵便')) {
    return `https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=${num}`;
  }

  if (carrier.includes('西濃')) {
    return `https://track.seino.co.jp/cgi-bin/gnpquery.pgm?GNPNO1=${num}`;
  }

  if (carrier.includes('福山')) {
    return `https://corp.fukutsu.co.jp/situation/tracking_no_hunt/${num}`;
  }

  return null;
}

/**
 * 返品理由の日本語表示
 */
export function getReturnReasonText(reason: ReturnReason): string {
  const reasonMap: Record<ReturnReason, string> = {
    defective: '不良品',
    damaged: '破損',
    wrong_item: '誤配送',
    size_issue: 'サイズ違い',
    image_different: 'イメージ違い',
    other: 'その他',
  };
  return reasonMap[reason] || reason;
}

/**
 * 商品状態の日本語表示
 */
export function getProductConditionText(condition: ProductCondition): string {
  const conditionMap: Record<ProductCondition, string> = {
    unopened: '未開封',
    opened: '開封済み',
  };
  return conditionMap[condition] || condition;
}

/**
 * 返品可否の判定
 */
export interface ReturnEligibility {
  eligible: boolean;
  reason: string;
  requiresHuman: boolean;
}

export function checkReturnEligibility(
  order: Order,
  returnReason: ReturnReason,
  condition: ProductCondition,
  daysSinceDelivery: number
): ReturnEligibility {
  // セール品は返品不可（要実装：セール品フラグが必要）
  // 高額品（1万円以上）は人へ転送
  if (order.totalAmount >= 10000) {
    return {
      eligible: false,
      reason: '高額商品のため、担当者が対応いたします。',
      requiresHuman: true,
    };
  }

  // 期限切れ（7日超）
  if (daysSinceDelivery > 7) {
    return {
      eligible: false,
      reason: '到着から7日を過ぎておりまして、通常の返品受付期限を超えております。',
      requiresHuman: true,
    };
  }

  // 不良品・破損・誤配送は受付OK
  if (['defective', 'damaged', 'wrong_item'].includes(returnReason)) {
    return {
      eligible: true,
      reason: '返品を承ります。送料は当社負担でお送りいただけます。',
      requiresHuman: false,
    };
  }

  // お客様都合で開封済み
  if (condition === 'opened') {
    return {
      eligible: false,
      reason: '開封済みの商品は、お客様都合での返品を承れない場合がございます。',
      requiresHuman: true,
    };
  }

  // お客様都合・未開封
  return {
    eligible: true,
    reason: '返品を承ります。なお、送料はお客様負担となります。',
    requiresHuman: false,
  };
}

/**
 * 到着からの日数を計算
 */
export function calculateDaysSinceDelivery(shippedDate: string | null): number {
  if (!shippedDate) {
    return 0;
  }

  const shipped = new Date(shippedDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - shipped.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // 発送から到着まで1〜2日と仮定
  return Math.max(0, diffDays - 1);
}
