/**
 * 人間オペレーター転送ツール
 */

import { RealtimeTool, TransferToHumanArgs, TransferPriority } from '../types/index.js';
import { logger } from '../utils/logger.js';

/** ツール定義 */
export const transferToHumanTool: RealtimeTool = {
  type: 'function',
  name: 'transfer_to_human',
  description: 'お客様の問い合わせを人間のオペレーターに転送します。AIでは対応できない場合、お客様が希望された場合、または高額商品の返品など特別な対応が必要な場合に使用します。',
  parameters: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description: '転送理由（オペレーターへの引き継ぎ事項）',
      },
      summary: {
        type: 'string',
        description: 'これまでの会話の要約',
      },
      priority: {
        type: 'string',
        enum: ['normal', 'high', 'urgent'],
        description: '優先度: normal(通常), high(高), urgent(緊急)',
      },
    },
    required: ['reason'],
  },
};

/** ツール実行コンテキスト */
export interface TransferToHumanContext {
  callSid: string;
  customerName?: string;
  customerPhone?: string;
}

/** 転送アクション結果 */
export interface TransferAction {
  action: 'transfer';
  data: TransferData;
}

/** 転送データ */
export interface TransferData {
  reason: string;
  summary?: string;
  priority: TransferPriority;
  callSid: string;
  customerName?: string;
  customerPhone?: string;
  timestamp: string;
}

/**
 * 転送を実行
 * 注: 実際の転送処理はmedia-stream.tsで行う
 * このツールは転送アクションを返すのみ
 */
export async function executeTransferToHuman(
  args: TransferToHumanArgs,
  context: TransferToHumanContext
): Promise<TransferAction> {
  const { reason, summary, priority = 'normal' } = args;

  const transferData: TransferData = {
    reason,
    summary,
    priority,
    callSid: context.callSid,
    customerName: context.customerName,
    customerPhone: context.customerPhone,
    timestamp: new Date().toISOString(),
  };

  logger.info(`🔄 転送リクエスト: ${reason} [優先度: ${priority}]`);

  if (context.customerName) {
    logger.info(`   顧客: ${context.customerName}様`);
  }

  // 転送アクションを返す
  // 実際の転送処理（Twilio <Dial>など）はmedia-stream.tsで実行
  return {
    action: 'transfer',
    data: transferData,
  };
}

/**
 * 転送前のお客様向けメッセージを生成
 */
export function getTransferMessage(priority: TransferPriority): string {
  switch (priority) {
    case 'urgent':
      return '大変お待たせいたしました。至急担当者におつなぎいたします。少々お待ちください。';
    case 'high':
      return '担当者におつなぎいたします。少々お待ちください。';
    case 'normal':
    default:
      return '担当者におつなぎいたします。少々お待ちくださいませ。';
  }
}
