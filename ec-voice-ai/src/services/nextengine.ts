/**
 * ネクストエンジンAPI連携サービス
 * 顧客検索、注文検索、返品登録を提供
 */

import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  Order,
  OrderItem,
  CustomerContext,
  LatestOrderSummary,
  NextEngineOrderSearchResponse,
  NextEngineOrderData,
  ReturnRegistration,
  Platform,
} from '../types/index.js';
import {
  mapStatus,
  getStatusName,
  getStatusMessage,
  getTrackingUrl,
} from '../utils/status-mapper.js';

/** ネクストエンジンAPIのベースURL */
const NE_API_BASE = 'https://api.next-engine.org';

/** トークン情報 */
interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * ネクストエンジンAPIサービス
 */
export class NextEngineService {
  private client: AxiosInstance;
  private tokenInfo: TokenInfo | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: NE_API_BASE,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  /**
   * アクセストークンを取得（必要に応じて更新）
   */
  async getAccessToken(): Promise<string> {
    // トークンがない、または期限切れの場合は更新
    if (!this.tokenInfo || new Date() >= this.tokenInfo.expiresAt) {
      await this.refreshAccessToken();
    }
    return this.tokenInfo!.accessToken;
  }

  /**
   * アクセストークンを更新
   */
  async refreshAccessToken(): Promise<void> {
    logger.debug('ネクストエンジン: トークン更新開始');

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.neClientId,
        client_secret: env.neClientSecret,
        refresh_token: this.tokenInfo?.refreshToken || env.neRefreshToken,
      });

      const response = await this.client.post('/api_neauth', params.toString());

      if (response.data.result === 'error') {
        throw new Error(response.data.message || 'トークン更新失敗');
      }

      // 有効期限を計算（通常24時間、安全のため23時間で設定）
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 23);

      this.tokenInfo = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt,
      };

      logger.apiCall('NextEngine', 'token_refresh', true);
    } catch (error) {
      logger.apiCall('NextEngine', 'token_refresh', false);
      logger.error('ネクストエンジン トークン更新エラー:', error);
      throw error;
    }
  }

  /**
   * 電話番号を正規化（国際形式→国内形式）
   */
  normalizePhoneForSearch(phone: string): string {
    // +81xxxxxxxxxx → 0xxxxxxxxxx
    if (phone.startsWith('+81')) {
      return '0' + phone.slice(3);
    }
    // 81xxxxxxxxxx → 0xxxxxxxxxx（国コードのみ、+なし）
    if (phone.startsWith('81') && phone.length >= 11) {
      return '0' + phone.slice(2);
    }
    // ハイフン除去
    return phone.replace(/-/g, '');
  }

  /**
   * 電話番号で顧客を検索（先回り対応用）
   */
  async searchCustomerByPhone(phone: string): Promise<CustomerContext> {
    const normalizedPhone = this.normalizePhoneForSearch(phone);
    logger.debug(`顧客検索: ${logger.maskPhone(normalizedPhone)}`);

    try {
      const orders = await this.searchOrders({ phone: normalizedPhone });

      if (orders.length === 0) {
        return {
          found: false,
          greeting: 'お電話ありがとうございます。お名前をお聞かせいただけますでしょうか。',
        };
      }

      // 最新の注文から顧客名を取得
      const latestOrder = orders[0];
      const customerName = latestOrder.customerName;

      // 最新注文の要約を作成
      const latestOrderSummary: LatestOrderSummary = {
        orderId: latestOrder.orderId,
        orderDate: latestOrder.orderDate,
        status: latestOrder.status,
        statusMessage: getStatusMessage(latestOrder),
        trackingNumber: latestOrder.trackingNumber,
        carrier: latestOrder.carrier,
        items: latestOrder.items.map(item => item.name),
      };

      logger.customerIdentified(customerName, orders.length);

      return {
        found: true,
        customerName,
        greeting: `お電話ありがとうございます。${customerName}様でいらっしゃいますね。`,
        orders,
        latestOrder: latestOrderSummary,
      };
    } catch (error) {
      logger.error('顧客検索エラー:', error);
      return {
        found: false,
        greeting: 'お電話ありがとうございます。',
        error: true,
      };
    }
  }

  /**
   * 注文を検索
   */
  async searchOrders(params: {
    phone?: string;
    orderId?: string;
    limit?: number;
  }): Promise<Order[]> {
    const accessToken = await this.getAccessToken();

    // 検索条件を構築
    const searchParams: Record<string, string> = {
      access_token: accessToken,
      wait_flag: '1', // 同期実行
      fields: [
        'receive_order_id',
        'receive_order_purchaser_name',
        'receive_order_purchaser_tel',
        'receive_order_purchaser_mail_address',
        'receive_order_date',
        'receive_order_confirm_ids',
        'receive_order_delivery_name',
        'receive_order_delivery_slip_number',
        'receive_order_total_amount',
        'receive_order_send_date',
        'receive_order_shop_id',
        'receive_order_row_goods_name',
        'receive_order_row_quantity',
        'receive_order_row_unit_price',
      ].join(','),
    };

    // 検索条件
    const conditions: string[] = [];

    if (params.phone) {
      // 電話番号で検索（部分一致）
      conditions.push(`receive_order_purchaser_tel-like-${params.phone}`);
    }

    if (params.orderId) {
      // 注文IDで検索
      conditions.push(`receive_order_id-eq-${params.orderId}`);
    }

    if (conditions.length > 0) {
      searchParams['receive_order_purchaser_tel-like'] = params.phone || '';
    }

    // 最新順で取得
    searchParams['offset'] = '0';
    searchParams['limit'] = String(params.limit || 10);

    try {
      const urlParams = new URLSearchParams(searchParams);

      // 検索条件を追加
      if (params.phone) {
        urlParams.append('receive_order_purchaser_tel-like', params.phone);
      }
      if (params.orderId) {
        urlParams.append('receive_order_id-eq', params.orderId);
      }

      const response = await this.client.post<NextEngineOrderSearchResponse>(
        '/api_v1_receiveorder_base/search',
        urlParams.toString()
      );

      if (response.data.result === 'error') {
        throw new Error(response.data.message || '注文検索失敗');
      }

      logger.apiCall('NextEngine', 'order_search', true, response.data.count);

      // APIレスポンスを内部形式に変換
      return (response.data.data || []).map(order => this.convertOrder(order));
    } catch (error) {
      logger.apiCall('NextEngine', 'order_search', false);
      logger.error('注文検索エラー:', error);
      throw error;
    }
  }

  /**
   * 単一の注文を取得
   */
  async getOrder(orderId: string): Promise<Order | null> {
    const orders = await this.searchOrders({ orderId, limit: 1 });
    return orders.length > 0 ? orders[0] : null;
  }

  /**
   * 返品を登録
   */
  async registerReturn(data: ReturnRegistration): Promise<{
    success: boolean;
    returnId?: string;
    message: string;
  }> {
    const accessToken = await this.getAccessToken();

    try {
      // 注文にメモを追加（返品リクエストとして記録）
      const returnNote = [
        `【返品リクエスト】`,
        `理由: ${data.reason}`,
        `状態: ${data.condition}`,
        `希望: ${data.request}`,
        data.description ? `詳細: ${data.description}` : '',
        `登録日時: ${new Date().toLocaleString('ja-JP')}`,
      ].filter(Boolean).join('\n');

      const params = new URLSearchParams({
        access_token: accessToken,
        receive_order_id: data.orderId,
        receive_order_note: returnNote,
      });

      const response = await this.client.post(
        '/api_v1_receiveorder_base/update',
        params.toString()
      );

      if (response.data.result === 'error') {
        throw new Error(response.data.message || '返品登録失敗');
      }

      // 返品IDを生成（日時ベース）
      const returnId = `RET-${Date.now()}`;

      logger.apiCall('NextEngine', 'register_return', true);
      logger.info(`返品登録完了: ${returnId} (注文: ${data.orderId})`);

      return {
        success: true,
        returnId,
        message: '返品リクエストを受け付けました。',
      };
    } catch (error) {
      logger.apiCall('NextEngine', 'register_return', false);
      logger.error('返品登録エラー:', error);
      return {
        success: false,
        message: 'システムエラーが発生しました。',
      };
    }
  }

  /**
   * ネクストエンジンの注文データを内部形式に変換
   */
  private convertOrder(neOrder: NextEngineOrderData): Order {
    const status = mapStatus(neOrder.receive_order_confirm_ids);
    const carrier = this.extractCarrier(neOrder.receive_order_delivery_name);
    const trackingNumber = neOrder.receive_order_delivery_slip_number || null;

    return {
      orderId: neOrder.receive_order_id,
      customerPhone: neOrder.receive_order_purchaser_tel,
      customerName: neOrder.receive_order_purchaser_name,
      customerEmail: neOrder.receive_order_purchaser_mail_address,
      status,
      statusName: getStatusName(status),
      orderDate: neOrder.receive_order_date,
      shippedDate: neOrder.receive_order_send_date || null,
      carrier,
      trackingNumber,
      trackingUrl: getTrackingUrl(carrier, trackingNumber),
      items: this.parseOrderItems(neOrder),
      totalAmount: parseInt(neOrder.receive_order_total_amount, 10) || 0,
      platform: this.detectPlatform(neOrder.receive_order_shop_id),
    };
  }

  /**
   * 配送業者名を抽出
   */
  private extractCarrier(deliveryName: string | null): string | null {
    if (!deliveryName) return null;

    if (deliveryName.includes('ヤマト')) return 'ヤマト運輸';
    if (deliveryName.includes('佐川')) return '佐川急便';
    if (deliveryName.includes('郵便') || deliveryName.includes('ゆうパック')) return '日本郵便';
    if (deliveryName.includes('西濃')) return '西濃運輸';
    if (deliveryName.includes('福山')) return '福山通運';

    return deliveryName;
  }

  /**
   * 注文アイテムをパース
   */
  private parseOrderItems(neOrder: NextEngineOrderData): OrderItem[] {
    // ネクストエンジンのAPIレスポンスには商品行が含まれる場合がある
    // 簡易実装：商品名がある場合は1つのアイテムとして返す
    const order = neOrder as unknown as Record<string, unknown>;

    if (order.receive_order_row_goods_name) {
      return [{
        name: String(order.receive_order_row_goods_name),
        quantity: Number(order.receive_order_row_quantity) || 1,
        price: Number(order.receive_order_row_unit_price) || 0,
      }];
    }

    // 商品情報がない場合は空配列
    return [];
  }

  /**
   * ショップIDからプラットフォームを推定
   */
  private detectPlatform(shopId: string): Platform {
    // ショップIDのパターンでプラットフォームを判定
    // 実際の判定ロジックは要調整
    if (shopId.includes('rakuten') || shopId.startsWith('1')) {
      return 'rakuten';
    }
    if (shopId.includes('amazon') || shopId.startsWith('2')) {
      return 'amazon';
    }
    return 'shopify';
  }
}

// シングルトンインスタンス
export const nextEngineService = new NextEngineService();
