/**
 * 注文状況確認ツール
 */

import { RealtimeTool, CheckOrderStatusArgs, Order } from '../types/index.js';
import { NextEngineService } from '../services/nextengine.js';
import { getStatusMessage } from '../utils/status-mapper.js';

/** ツール定義 */
export const checkOrderStatusTool: RealtimeTool = {
  type: 'function',
  name: 'check_order_status',
  description: '顧客の注文状況を確認します。電話番号または注文番号で検索できます。引数なしで呼び出すと、現在通話中のお客様の最新注文を検索します。',
  parameters: {
    type: 'object',
    properties: {
      phone_number: {
        type: 'string',
        description: '顧客の電話番号（ハイフンなし）',
      },
      order_id: {
        type: 'string',
        description: '注文番号',
      },
    },
  },
};

/** ツール実行コンテキスト */
export interface CheckOrderStatusContext {
  neService: NextEngineService;
  customerPhone: string;
}

/**
 * 注文状況確認を実行
 */
export async function executeCheckOrderStatus(
  args: CheckOrderStatusArgs,
  context: CheckOrderStatusContext
): Promise<string> {
  // 引数がなければ、現在の通話の電話番号で検索
  const phone = args.phone_number || context.customerPhone;
  const orderId = args.order_id;

  try {
    const orders = await context.neService.searchOrders({
      phone: orderId ? undefined : phone,
      orderId,
      limit: 3,
    });

    if (orders.length === 0) {
      if (orderId) {
        return `注文番号 ${orderId} に該当する注文が見つかりませんでした。注文番号をご確認いただけますでしょうか。`;
      }
      return '該当する注文が見つかりませんでした。お電話番号またはご注文番号をお聞かせいただけますでしょうか。';
    }

    // 検索結果をフォーマット
    return formatOrderResults(orders);
  } catch (error) {
    return 'システムの都合により、注文情報の検索に失敗しました。少々お待ちいただけますでしょうか。';
  }
}

/**
 * 注文検索結果をフォーマット
 */
function formatOrderResults(orders: Order[]): string {
  if (orders.length === 1) {
    const order = orders[0];
    return formatSingleOrder(order);
  }

  // 複数件の場合
  const summaries = orders.map((order, index) => {
    const items = order.items.map(i => i.name).join('、') || '商品';
    return `${index + 1}件目: ${order.orderDate}のご注文（${items}）- ${getStatusMessage(order)}`;
  });

  return `${orders.length}件のご注文がございます。\n${summaries.join('\n')}\nどのご注文についてお調べしましょうか？`;
}

/**
 * 単一注文のフォーマット
 */
function formatSingleOrder(order: Order): string {
  const items = order.items.map(i => i.name).join('、') || '商品';
  const statusMessage = getStatusMessage(order);

  let result = `${order.orderDate}にご注文いただいた${items}についてですね。${statusMessage}`;

  // 追跡番号がある場合
  if (order.trackingNumber && order.carrier) {
    result += `追跡番号は${order.trackingNumber}でございます。`;
  }

  return result;
}
