/**
 * ツール定義と実行関数のエクスポート
 */

import { RealtimeTool, ToolName } from '../types/index.js';
import { NextEngineService } from '../services/nextengine.js';
import { LatestOrderSummary } from '../types/index.js';

// ツール定義のインポート
import { checkOrderStatusTool, executeCheckOrderStatus } from './check-order-status.js';
import { registerReturnTool, executeRegisterReturn, RegisterReturnResult } from './register-return.js';
import { sendEmailTool, executeSendEmail } from './send-email.js';
import { transferToHumanTool, executeTransferToHuman, TransferAction } from './transfer-to-human.js';

/** ツール定義（OpenAI Realtime APIへ送信） */
export const toolDefinitions: RealtimeTool[] = [
  checkOrderStatusTool,
  registerReturnTool,
  sendEmailTool,
  transferToHumanTool,
];

/** ツール実行に必要なコンテキスト */
export interface ToolExecutionContext {
  neService: NextEngineService;
  customerPhone: string;
  callSid: string;
  customerName?: string;
  customerEmail?: string;
  latestOrder?: LatestOrderSummary;
  shopName?: string;
}

/** ツール実行結果 */
export type ToolExecutionResult = string | RegisterReturnResult | TransferAction;

/**
 * ツールを実行
 */
export async function executeTool(
  toolName: ToolName,
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case 'check_order_status':
      return executeCheckOrderStatus(
        args as { phone_number?: string; order_id?: string },
        {
          neService: context.neService,
          customerPhone: context.customerPhone,
        }
      );

    case 'register_return':
      return executeRegisterReturn(
        args as {
          order_id: string;
          reason: 'defective' | 'damaged' | 'wrong_item' | 'size_issue' | 'image_different' | 'other';
          condition: 'unopened' | 'opened';
          request: 'refund' | 'exchange';
        },
        {
          neService: context.neService,
        }
      );

    case 'send_email':
      return executeSendEmail(
        args as { template: 'tracking' | 'return_form' | 'callback' },
        {
          customerEmail: context.customerEmail,
          customerName: context.customerName,
          orderId: context.latestOrder?.orderId,
          trackingUrl: undefined,
          trackingNumber: context.latestOrder?.trackingNumber || undefined,
          carrier: context.latestOrder?.carrier || undefined,
          shopName: context.shopName,
        }
      );

    case 'transfer_to_human':
      return executeTransferToHuman(
        args as { reason: string; summary?: string; priority?: 'normal' | 'high' | 'urgent' },
        {
          callSid: context.callSid,
          customerName: context.customerName,
          customerPhone: context.customerPhone,
        }
      );

    default:
      return `不明なツール: ${toolName}`;
  }
}

/**
 * 転送アクションかどうかを判定
 */
export function isTransferAction(result: ToolExecutionResult): result is TransferAction {
  return typeof result === 'object' && 'action' in result && result.action === 'transfer';
}

/**
 * 人間への転送が必要かどうかを判定
 */
export function requiresHumanTransfer(result: ToolExecutionResult): boolean {
  if (isTransferAction(result)) {
    return true;
  }
  if (typeof result === 'object' && 'requiresTransfer' in result) {
    return result.requiresTransfer === true;
  }
  return false;
}

// 個別ツールもエクスポート
export {
  checkOrderStatusTool,
  executeCheckOrderStatus,
  registerReturnTool,
  executeRegisterReturn,
  sendEmailTool,
  executeSendEmail,
  transferToHumanTool,
  executeTransferToHuman,
};
