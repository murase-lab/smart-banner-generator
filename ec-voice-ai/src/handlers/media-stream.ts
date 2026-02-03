/**
 * Twilio Media Stream WebSocketハンドラ
 * Twilio ↔ OpenAI Realtime API の双方向音声ストリーミング橋渡し
 */

import { WebSocket as WsSocket } from 'ws';
import { TwilioStreamMessage, CustomerContext, ToolName } from '../types/index.js';
import { OpenAIRealtimeSession, createDefaultSessionConfig } from '../services/openai-realtime.js';
import { NextEngineService } from '../services/nextengine.js';
import { generateSystemPrompt } from '../prompts/system-prompt.js';
import { toolDefinitions, executeTool, isTransferAction, requiresHumanTransfer, ToolExecutionContext } from '../tools/index.js';
import { getTransferMessage } from '../tools/transfer-to-human.js';
import { logger } from '../utils/logger.js';
import { conversationHistory } from '../services/conversation-history.js';

/** ストリームコンテキスト */
interface StreamContext {
  streamSid: string;
  callSid: string;
  callerPhone: string;
  customerContext: CustomerContext;
  openaiSession: OpenAIRealtimeSession;
  neService: NextEngineService;
  callStartTime: Date;
  isInitialized: boolean;
  isResponseActive: boolean; // 応答生成中フラグ
  isEchoCooldown: boolean;   // 再生直後のエコー抑制中フラグ
  echoCooldownTimer: ReturnType<typeof setTimeout> | null; // クールダウンタイマー
  historyCallId: string | null; // 会話履歴用ID
}

/**
 * Media Streamを処理
 */
export function handleMediaStream(connection: WsSocket): void {
  let context: StreamContext | null = null;

  connection.on('message', async (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString()) as TwilioStreamMessage;

      switch (data.event) {
        case 'connected':
          logger.debug('Twilio WebSocket: 接続完了');
          break;

        case 'start':
          // ストリーム開始 - コンテキスト初期化
          context = await initializeStream(data, connection);
          break;

        case 'media':
          // 音声データ - OpenAIへ転送
          // AI再生直後のクールダウン中のみスキップ（残響エコー防止）
          // AI再生中は送信を続ける（バージイン対応 + 耳当てモードの音声認識維持）
          if (context?.openaiSession.isConnected() && context.isInitialized && !context.isEchoCooldown) {
            context.openaiSession.sendAudio(data.media!.payload);
          }
          break;

        case 'stop':
          // ストリーム終了
          if (context) {
            const duration = Math.round(
              (Date.now() - context.callStartTime.getTime()) / 1000
            );
            logger.callEnd(context.callSid, duration);
            context.openaiSession.disconnect();
            // 会話履歴: 通話終了を記録
            if (context.historyCallId) {
              conversationHistory.endCall(context.historyCallId, duration);
            }
          }
          break;

        case 'mark':
          // マーカー（Twilioが音声再生を完了した通知）
          logger.info(`Mark受信: ${data.mark?.name}`);
          if (data.mark?.name === 'audio-complete' && context) {
            // Twilioで実際に再生が完了した後、短いクールダウンで残響を除去
            logger.info('Twilio再生完了 → エコー抑制クールダウン開始');
            const ctx = context;
            if (ctx.echoCooldownTimer) {
              clearTimeout(ctx.echoCooldownTimer);
            }
            ctx.isEchoCooldown = true;
            ctx.echoCooldownTimer = setTimeout(() => {
              ctx.isEchoCooldown = false;
              ctx.echoCooldownTimer = null;
              logger.info('エコー抑制解除 → ユーザー音声受付再開');
            }, 400);
          }
          break;
      }
    } catch (error) {
      logger.error('WebSocketメッセージ処理エラー:', error);
    }
  });

  connection.on('close', () => {
    logger.wsDisconnect('Twilio');
    if (context) {
      context.openaiSession.disconnect();
    }
  });

  connection.on('error', (error) => {
    logger.error('Twilio WebSocketエラー:', error);
  });
}

/**
 * ストリームを初期化
 */
async function initializeStream(
  startData: TwilioStreamMessage,
  twilioWs: WsSocket
): Promise<StreamContext> {
  const params = startData.start!.customParameters || {};

  // 顧客コンテキストをデコード
  let customerContext: CustomerContext;
  try {
    customerContext = params.customerContext
      ? JSON.parse(Buffer.from(params.customerContext, 'base64').toString())
      : { found: false, greeting: 'お電話ありがとうございます。' };
  } catch {
    customerContext = { found: false, greeting: 'お電話ありがとうございます。' };
  }

  const context: StreamContext = {
    streamSid: startData.start!.streamSid,
    callSid: startData.start!.callSid,
    callerPhone: params.callerPhone || '',
    customerContext,
    openaiSession: new OpenAIRealtimeSession(),
    neService: new NextEngineService(),
    callStartTime: new Date(),
    isInitialized: false,
    isResponseActive: false,
    isEchoCooldown: false,
    echoCooldownTimer: null,
    historyCallId: null,
  };

  logger.info(`📞 ストリーム開始 [${customerContext.found ? customerContext.customerName + '様' : '未特定'}]`);

  // 会話履歴: 通話開始を記録
  context.historyCallId = await conversationHistory.startCall({
    callSid: context.callSid,
    callerPhone: context.callerPhone,
    customerName: customerContext.customerName,
    customerIdentified: customerContext.found,
  });

  try {
    // OpenAI Realtime API接続
    await context.openaiSession.connect();

    // イベントハンドラを先に設定（イベントを逃さないため）
    setupEventHandlers(context, twilioWs);

    // セッション設定（顧客コンテキスト付きプロンプト）
    const systemPrompt = generateSystemPrompt(customerContext);
    const sessionConfig = createDefaultSessionConfig(systemPrompt, toolDefinitions);

    logger.info('OpenAI セッション設定を送信中...');

    // session.updated を待機するPromise
    const sessionUpdatedPromise = new Promise<void>((resolve) => {
      const handler = () => {
        logger.info('OpenAI セッション更新完了 - 応答生成開始');
        context.openaiSession.off('session.updated', handler);
        resolve();
      };
      context.openaiSession.on('session.updated', handler);
    });

    await context.openaiSession.updateSession(sessionConfig);

    // session.updated を待機（タイムアウト3秒）
    await Promise.race([
      sessionUpdatedPromise,
      new Promise<void>((resolve) => setTimeout(() => {
        logger.warn('session.updated タイムアウト - 応答生成を試行');
        resolve();
      }, 3000))
    ]);

    // 初期化完了フラグ
    context.isInitialized = true;

    // Twilio音声ストリームが安定するまで待機（冒頭切れ防止）
    await new Promise(resolve => setTimeout(resolve, 1200));

    // 最初の応答を生成（挨拶）
    logger.info('最初の応答を生成中...');
    context.isResponseActive = true;
    context.openaiSession.createResponse();

  } catch (error) {
    logger.error('ストリーム初期化エラー:', error);
    // エラー時はフォールバックメッセージ
    sendFallbackMessage(twilioWs, context.streamSid);
  }

  return context;
}

/**
 * OpenAIイベントハンドラを設定
 */
function setupEventHandlers(context: StreamContext, twilioWs: WsSocket): void {
  const { openaiSession } = context;

  // セッション作成完了
  openaiSession.on('session.created', () => {
    logger.info('OpenAI セッション作成完了');
  });

  // 応答生成開始
  openaiSession.on('response.created', () => {
    logger.info('OpenAI 応答生成開始');
    context.isResponseActive = true;
  });

  // 音声出力 → Twilioへ転送
  openaiSession.on('response.audio.delta', (data: unknown) => {
    const event = data as { delta: string };
    // 新しい音声出力が来たらクールダウンをリセット
    if (context.echoCooldownTimer) {
      clearTimeout(context.echoCooldownTimer);
      context.echoCooldownTimer = null;
      context.isEchoCooldown = false;
    }
    sendAudioToTwilio(twilioWs, context.streamSid, event.delta);
  });

  // 音声出力完了（OpenAI側の送信完了。Twilio再生はまだ続いている可能性あり）
  openaiSession.on('response.audio.done', () => {
    logger.info('OpenAI 音声出力完了');
    // Twilioへ再生完了マーカーを送信（Twilioが実際に再生し終わったらmarkイベントで通知される）
    sendMarkToTwilio(twilioWs, context.streamSid, 'audio-complete');
    // ※ isAudioPlaying はTwilioのmarkイベント受信後にクールダウンを経て解除
  });

  // ユーザー発話開始（バージイン検出）
  openaiSession.on('input_audio_buffer.speech_started', () => {
    logger.info('ユーザー発話開始（バージイン）');
    // 応答生成中の場合のみキャンセル
    if (context.isResponseActive) {
      openaiSession.cancelResponse();
      // Twilioの音声バッファをクリア
      clearTwilioAudioBuffer(twilioWs, context.streamSid);
    }
  });

  // ユーザー発話終了
  openaiSession.on('input_audio_buffer.speech_stopped', () => {
    logger.info('ユーザー発話終了');
  });

  // ツール呼び出し
  openaiSession.on('response.function_call_arguments.done', async (data: unknown) => {
    const event = data as { name: string; call_id: string; arguments: string };
    await handleToolCall(event, context, twilioWs);
  });

  // エラー（特定のエラーは無視）
  openaiSession.on('error', (data: unknown) => {
    const event = data as { error?: { message?: string; code?: string } };
    // response_cancel_not_active は無視（バージイン時に発生しうる）
    if (event.error?.code !== 'response_cancel_not_active') {
      logger.error('OpenAI エラー:', event.error?.message);
    }
  });

  // 応答完了
  openaiSession.on('response.done', (data: unknown) => {
    const event = data as { response?: { status?: string } };
    logger.info(`OpenAI 応答完了: ${event.response?.status}`);
    context.isResponseActive = false;
  });

  // AI発話のテキスト完了 → 会話履歴に保存
  openaiSession.on('response.audio_transcript.done', (data: unknown) => {
    const event = data as { transcript?: string };
    if (event.transcript && context.historyCallId) {
      conversationHistory.addMessage({
        callId: context.historyCallId,
        speaker: 'ai',
        content: event.transcript,
      });
    }
  });

  // ユーザー発話のテキスト（入力トランスクリプト完了）→ 会話履歴に保存
  openaiSession.on('conversation.item.input_audio_transcription.completed', (data: unknown) => {
    const event = data as { transcript?: string; item_id?: string };
    if (event.transcript && context.historyCallId) {
      logger.info(`ユーザー発話: ${event.transcript}`);
      conversationHistory.addMessage({
        callId: context.historyCallId,
        speaker: 'user',
        content: event.transcript,
      });
    }
  });
}

/**
 * ツール呼び出しを処理
 */
async function handleToolCall(
  event: { name: string; call_id: string; arguments: string },
  context: StreamContext,
  _twilioWs: WsSocket
): Promise<void> {
  const { name, call_id, arguments: argsJson } = event;

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson);
  } catch {
    args = {};
  }

  logger.toolExecution(name, args);

  // ツール実行コンテキスト
  // 注文データからメールアドレスを取得
  const customerEmail = context.customerContext.orders?.[0]?.customerEmail;
  const toolContext: ToolExecutionContext = {
    neService: context.neService,
    customerPhone: context.callerPhone,
    callSid: context.callSid,
    customerName: context.customerContext.customerName,
    customerEmail,
    latestOrder: context.customerContext.latestOrder,
  };

  try {
    const result = await executeTool(name as ToolName, args, toolContext);

    // 会話履歴: ツール呼び出しを記録
    if (context.historyCallId) {
      conversationHistory.addToolCall({
        callId: context.historyCallId,
        toolName: name,
        arguments: args,
        result: result,
      });
    }

    // 転送アクションの場合
    if (isTransferAction(result)) {
      logger.info(`🔄 人間へ転送: ${result.data.reason}`);
      // TODO: 実際のTwilio転送処理を実装
      // 現在は転送メッセージを返すのみ
      const transferMessage = getTransferMessage(result.data.priority);
      context.openaiSession.sendToolResult(call_id, transferMessage);
      return;
    }

    // 人間への転送が必要な場合
    if (requiresHumanTransfer(result)) {
      const message = typeof result === 'object' && 'message' in result
        ? result.message
        : '担当者におつなぎいたします。';
      context.openaiSession.sendToolResult(call_id, message);
      return;
    }

    // 通常の結果を送信
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
    context.openaiSession.sendToolResult(call_id, resultStr);
  } catch (error) {
    logger.error(`ツール実行エラー [${name}]:`, error);
    context.openaiSession.sendToolResult(call_id, 'システムエラーが発生しました。');
  }
}

/**
 * Twilioへ音声を送信
 */
function sendAudioToTwilio(ws: WsSocket, streamSid: string, audioBase64: string): void {
  if (ws.readyState !== WsSocket.OPEN) {
    return;
  }

  ws.send(JSON.stringify({
    event: 'media',
    streamSid,
    media: {
      payload: audioBase64,
    },
  }));
}

/**
 * Twilioへマーカーを送信
 */
function sendMarkToTwilio(ws: WsSocket, streamSid: string, name: string): void {
  if (ws.readyState !== WsSocket.OPEN) {
    return;
  }

  ws.send(JSON.stringify({
    event: 'mark',
    streamSid,
    mark: {
      name,
    },
  }));
}

/**
 * Twilioの音声バッファをクリア（バージイン用）
 */
function clearTwilioAudioBuffer(ws: WsSocket, streamSid: string): void {
  if (ws.readyState !== WsSocket.OPEN) {
    return;
  }

  ws.send(JSON.stringify({
    event: 'clear',
    streamSid,
  }));
}

/**
 * エラー時のフォールバックメッセージ
 */
function sendFallbackMessage(_ws: WsSocket, _streamSid: string): void {
  // 注: Twilioへの直接音声送信はOpenAI経由でないとできないため、
  // エラー時は接続を閉じて、Twilioのフォールバック処理に任せる
  logger.warn('フォールバック: OpenAI接続失敗');
}
