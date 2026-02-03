/**
 * OpenAI Realtime API セッション管理
 * WebSocket接続、音声送受信、イベントハンドリングを提供
 */

import WebSocket from 'ws';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { RealtimeSessionConfig, RealtimeTool } from '../types/index.js';

/** OpenAI Realtime APIのWebSocket URL */
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';

/** OpenAI Realtimeイベント型 */
export type RealtimeServerEvent =
  | 'session.created'
  | 'session.updated'
  | 'response.created'
  | 'response.done'
  | 'response.audio.delta'
  | 'response.audio.done'
  | 'response.audio_transcript.delta'
  | 'response.audio_transcript.done'
  | 'response.text.delta'
  | 'response.text.done'
  | 'response.function_call_arguments.delta'
  | 'response.function_call_arguments.done'
  | 'input_audio_buffer.speech_started'
  | 'input_audio_buffer.speech_stopped'
  | 'input_audio_buffer.committed'
  | 'conversation.item.created'
  | 'conversation.item.truncated'
  | 'error';

/** イベントハンドラの型 */
type EventHandler = (data: unknown) => void;

/**
 * OpenAI Realtime APIセッション
 */
export class OpenAIRealtimeSession {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private eventHandlers: Map<string, EventHandler[]> = new Map();

  /**
   * OpenAI Realtime APIに接続
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.debug('OpenAI Realtime API: 接続開始');

      this.ws = new WebSocket(OPENAI_REALTIME_URL, {
        headers: {
          'Authorization': `Bearer ${env.openaiApiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      this.ws.on('open', () => {
        logger.info('OpenAI Realtime API: 接続完了');
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        logger.error('OpenAI Realtime API エラー:', error);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        logger.info(`OpenAI Realtime API: 切断 (code: ${code}, reason: ${reason.toString()})`);
        this.ws = null;
        this.sessionId = null;
      });
    });
  }

  /**
   * 接続を切断
   */
  disconnect(): void {
    if (this.ws) {
      logger.debug('OpenAI Realtime API: 切断開始');
      this.ws.close();
      this.ws = null;
      this.sessionId = null;
    }
  }

  /**
   * 接続状態を確認
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * セッション設定を更新
   */
  async updateSession(config: RealtimeSessionConfig): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('OpenAI Realtime API: 未接続');
    }

    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: config.modalities,
        instructions: config.instructions,
        voice: config.voice,
        input_audio_format: config.input_audio_format,
        output_audio_format: config.output_audio_format,
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: config.turn_detection,
        tools: config.tools,
        tool_choice: config.tool_choice,
      },
    };

    this.send(sessionUpdate);
    logger.debug('OpenAI Realtime API: セッション設定送信');
  }

  /**
   * 音声データを送信（Twilioからの音声をOpenAIへ）
   */
  sendAudio(base64Audio: string): void {
    if (!this.isConnected()) {
      return;
    }

    this.send({
      type: 'input_audio_buffer.append',
      audio: base64Audio,
    });
  }

  /**
   * 応答生成をトリガー
   */
  createResponse(): void {
    if (!this.isConnected()) {
      return;
    }

    this.send({
      type: 'response.create',
    });
    logger.debug('OpenAI Realtime API: 応答生成リクエスト');
  }

  /**
   * 応答を中断（バージイン対応）
   */
  cancelResponse(): void {
    if (!this.isConnected()) {
      return;
    }

    this.send({
      type: 'response.cancel',
    });
    logger.debug('OpenAI Realtime API: 応答キャンセル');
  }

  /**
   * 音声入力バッファをクリア
   */
  clearInputAudio(): void {
    if (!this.isConnected()) {
      return;
    }

    this.send({
      type: 'input_audio_buffer.clear',
    });
  }

  /**
   * 音声入力バッファをコミット
   */
  commitInputAudio(): void {
    if (!this.isConnected()) {
      return;
    }

    this.send({
      type: 'input_audio_buffer.commit',
    });
  }

  /**
   * ツール実行結果を送信
   */
  sendToolResult(callId: string, result: unknown): void {
    if (!this.isConnected()) {
      return;
    }

    // 会話アイテムとしてツール結果を追加
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: typeof result === 'string' ? result : JSON.stringify(result),
      },
    });

    // 応答を再開
    this.createResponse();
    logger.debug(`OpenAI Realtime API: ツール結果送信 [callId: ${callId}]`);
  }

  /**
   * テキストメッセージを送信（デバッグ用）
   */
  sendTextMessage(text: string): void {
    if (!this.isConnected()) {
      return;
    }

    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text,
          },
        ],
      },
    });

    this.createResponse();
  }

  /**
   * イベントハンドラを登録
   */
  on(event: RealtimeServerEvent | string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * イベントハンドラを削除
   */
  off(event: RealtimeServerEvent | string, handler?: EventHandler): void {
    if (!handler) {
      this.eventHandlers.delete(event);
      return;
    }

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * WebSocketメッセージを送信
   */
  private send(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * 受信メッセージを処理
   */
  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      const eventType = message.type as string;

      // 重要なイベントをINFOレベルでログ
      const importantEvents = [
        'session.created',
        'session.updated',
        'response.created',
        'response.done',
        'response.audio.done',
        'input_audio_buffer.speech_started',
        'input_audio_buffer.speech_stopped',
        'conversation.item.created',
      ];

      if (importantEvents.includes(eventType)) {
        logger.info(`OpenAI イベント: ${eventType}`);
      } else if (eventType !== 'response.audio.delta') {
        // 音声データ以外はデバッグログ
        logger.debug(`OpenAI イベント: ${eventType}`);
      }

      // セッションID保存
      if (eventType === 'session.created') {
        this.sessionId = message.session?.id;
        logger.info(`OpenAI Realtime API: セッション作成 [${this.sessionId}]`);
      }

      // エラーハンドリング
      if (eventType === 'error') {
        // response_cancel_not_active は警告レベルに下げる
        if (message.error?.code === 'response_cancel_not_active') {
          logger.debug('OpenAI: キャンセル対象の応答なし（無視）');
        } else {
          logger.error('OpenAI Realtime API エラー:', message.error);
        }
      }

      // 音声テキストのログ出力
      if (eventType === 'response.audio_transcript.done') {
        logger.info(`AI発話: ${message.transcript}`);
      }

      // 応答完了時の詳細ログ
      if (eventType === 'response.done') {
        const response = message.response;
        if (response?.status === 'failed') {
          logger.error('OpenAI 応答失敗の詳細:', {
            status: response.status,
            status_details: response.status_details,
            output: response.output,
          });
        }
      }

      // 登録されたハンドラを実行
      this.emitEvent(eventType, message);
    } catch (error) {
      logger.error('OpenAI メッセージ解析エラー:', error);
    }
  }

  /**
   * イベントを発火
   */
  private emitEvent(event: string, data: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          logger.error(`イベントハンドラエラー [${event}]:`, error);
        }
      });
    }

    // ワイルドカードハンドラ
    const wildcardHandlers = this.eventHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler({ type: event, ...data as object });
        } catch (error) {
          logger.error(`ワイルドカードハンドラエラー:`, error);
        }
      });
    }
  }
}

/**
 * デフォルトのセッション設定を生成
 */
export function createDefaultSessionConfig(
  instructions: string,
  tools: RealtimeTool[]
): RealtimeSessionConfig {
  return {
    modalities: ['text', 'audio'],
    instructions,
    voice: 'shimmer', // 日本語対応の自然な声
    input_audio_format: 'g711_ulaw',
    output_audio_format: 'g711_ulaw',
    input_audio_transcription: {
      model: 'whisper-1', // ユーザー音声をテキスト化
    },
    turn_detection: {
      type: 'server_vad',
      threshold: 0.8,           // スピーカーモード対応（0.7→0.8）エコー誤検出防止
      prefix_padding_ms: 600,   // 発話開始前に600ms必要（エコー除外）
      silence_duration_ms: 1000, // 沈黙1秒で発話終了と判断
    },
    tools,
    tool_choice: 'auto',
  };
}
