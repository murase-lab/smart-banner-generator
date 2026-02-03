/**
 * 返品登録ツール
 */

import { RealtimeTool, RegisterReturnArgs } from '../types/index.js';
import { NextEngineService } from '../services/nextengine.js';
import {
  checkReturnEligibility,
  calculateDaysSinceDelivery,
  getReturnReasonText,
} from '../utils/status-mapper.js';

/** ツール定義 */
export const registerReturnTool: RealtimeTool = {
  type: 'function',
  name: 'register_return',
  description: '返品・交換の受付を登録します。必ず返品理由と商品状態を確認してから呼び出してください。高額商品や期限切れの場合は自動的に担当者へ転送されます。',
  parameters: {
    type: 'object',
    properties: {
      order_id: {
        type: 'string',
        description: '返品対象の注文番号',
      },
      reason: {
        type: 'string',
        enum: ['defective', 'damaged', 'wrong_item', 'size_issue', 'image_different', 'other'],
        description: '返品理由: defective(不良品), damaged(破損), wrong_item(誤配送), size_issue(サイズ違い), image_different(イメージ違い), other(その他)',
      },
      condition: {
        type: 'string',
        enum: ['unopened', 'opened'],
        description: '商品の状態: unopened(未開封), opened(開封済み)',
      },
      request: {
        type: 'string',
        enum: ['refund', 'exchange'],
        description: 'ご希望: refund(返金), exchange(交換)',
      },
    },
    required: ['order_id', 'reason', 'condition', 'request'],
  },
};

/** ツール実行コンテキスト */
export interface RegisterReturnContext {
  neService: NextEngineService;
}

/** 返品登録の結果 */
export interface RegisterReturnResult {
  success: boolean;
  message: string;
  requiresTransfer?: boolean;
}

/**
 * 返品登録を実行
 */
export async function executeRegisterReturn(
  args: RegisterReturnArgs,
  context: RegisterReturnContext
): Promise<string | RegisterReturnResult> {
  const { order_id, reason, condition, request } = args;

  try {
    // 注文情報を取得
    const order = await context.neService.getOrder(order_id);

    if (!order) {
      return '該当する注文が見つかりません。注文番号をご確認いただけますでしょうか。';
    }

    // 配達からの日数を計算
    const daysSinceDelivery = calculateDaysSinceDelivery(order.shippedDate);

    // 返品可否判定
    const eligibility = checkReturnEligibility(order, reason, condition, daysSinceDelivery);

    if (!eligibility.eligible) {
      if (eligibility.requiresHuman) {
        return {
          success: false,
          message: eligibility.reason,
          requiresTransfer: true,
        };
      }
      return eligibility.reason;
    }

    // ネクストエンジンに返品登録
    const result = await context.neService.registerReturn({
      orderId: order_id,
      reason,
      condition,
      request,
    });

    if (!result.success) {
      return {
        success: false,
        message: 'システムエラーが発生しました。担当者におつなぎいたします。',
        requiresTransfer: true,
      };
    }

    // 成功メッセージを構築
    const reasonText = getReturnReasonText(reason);
    const requestText = request === 'refund' ? '返金' : '交換';

    let message = `${reasonText}による${requestText}のご依頼を承りました。`;
    message += `返品受付番号は${result.returnId}でございます。`;
    message += eligibility.reason; // 送料負担についての説明

    // 返送方法の案内
    message += '返送方法については、後ほどメールでご案内いたします。';

    return message;
  } catch (error) {
    return {
      success: false,
      message: 'システムの都合により、返品登録に失敗しました。担当者におつなぎいたします。',
      requiresTransfer: true,
    };
  }
}
