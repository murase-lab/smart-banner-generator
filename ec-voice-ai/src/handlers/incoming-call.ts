/**
 * Twilio着信Webhookハンドラ
 * 電話着信時に先回り検索を実行し、TwiMLを返す
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { TwilioCallData, CustomerContext } from '../types/index.js';
import { NextEngineService } from '../services/nextengine.js';
import { logger } from '../utils/logger.js';

/** ネクストエンジンサービス（シングルトン） */
const neService = new NextEngineService();

/**
 * 着信Webhookを処理
 */
export async function handleIncomingCall(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Twilioからのリクエストデータを取得
  const body = request.body as Partial<TwilioCallData> | undefined;
  const query = request.query as Record<string, string>;

  // 電話情報を抽出
  const callSid = body?.CallSid || query.CallSid || `call-${Date.now()}`;
  const callerPhone = body?.From || query.From || 'unknown';

  logger.callStart(callSid, callerPhone);

  // 1. 先回り検索: 発信者番号でネクストエンジンを検索
  let customerContext: CustomerContext;
  try {
    customerContext = await neService.searchCustomerByPhone(callerPhone);

    if (customerContext.found) {
      logger.customerIdentified(
        customerContext.customerName!,
        customerContext.orders?.length || 0
      );
    } else {
      logger.debug('顧客特定できず（新規または未登録）');
    }
  } catch (error) {
    logger.error('ネクストエンジン検索エラー:', error);
    customerContext = {
      found: false,
      greeting: 'お電話ありがとうございます。',
      error: true,
    };
  }

  // 2. 顧客コンテキストをBase64エンコード（WebSocketへ渡す）
  const contextParam = Buffer.from(JSON.stringify(customerContext)).toString('base64');

  // 3. WebSocket URLを生成
  const host = request.headers.host || 'localhost:3000';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  const wsProtocol = isLocalhost ? 'ws' : 'wss';
  const wsUrl = `${wsProtocol}://${host}/media-stream`;

  // 4. TwiML生成（双方向ストリーム）
  const twiml = generateTwiML(wsUrl, {
    customerContext: contextParam,
    callerPhone,
    callSid,
  });

  // 5. レスポンス送信
  reply.type('text/xml').send(twiml);
  logger.info(`📞 TwiML応答完了 [CallSid: ${callSid.slice(-8)}]`);
}

/**
 * TwiMLを生成
 */
function generateTwiML(
  wsUrl: string,
  params: {
    customerContext: string;
    callerPhone: string;
    callSid: string;
  }
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="customerContext" value="${params.customerContext}" />
      <Parameter name="callerPhone" value="${params.callerPhone}" />
      <Parameter name="callSid" value="${params.callSid}" />
    </Stream>
  </Connect>
</Response>`;
}

/**
 * 電話を転送するTwiMLを生成
 */
export function generateTransferTwiML(
  transferNumber: string,
  message?: string
): string {
  const sayElement = message
    ? `<Say language="ja-JP">${escapeXml(message)}</Say>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${sayElement}
  <Dial timeout="30" action="/call-status">
    <Number>${transferNumber}</Number>
  </Dial>
</Response>`;
}

/**
 * 保留音楽付きTwiMLを生成
 */
export function generateHoldTwiML(message?: string): string {
  const sayElement = message
    ? `<Say language="ja-JP">${escapeXml(message)}</Say>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${sayElement}
  <Play loop="10">https://api.twilio.com/cowbell.mp3</Play>
</Response>`;
}

/**
 * XMLエスケープ
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
