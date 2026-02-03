/**
 * 会話履歴保存サービス
 * Supabaseに通話履歴・会話内容を保存
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

/** 通話レコード */
interface CallRecord {
  id: string;
  call_sid: string;
  caller_phone: string | null;
  customer_name: string | null;
  customer_identified: boolean;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
}

/** メッセージレコード */
interface MessageRecord {
  id: string;
  call_id: string;
  speaker: 'ai' | 'user' | 'system';
  content: string;
  timestamp: string;
}


/**
 * 会話履歴サービス
 */
export class ConversationHistoryService {
  private client: SupabaseClient | null = null;
  private enabled: boolean = false;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    logger.info(`会話履歴サービス初期化: URL=${supabaseUrl ? '設定済み' : '未設定'}, KEY=${supabaseKey ? '設定済み' : '未設定'}`);

    if (supabaseUrl && supabaseKey) {
      try {
        this.client = createClient(supabaseUrl, supabaseKey);
        this.enabled = true;
        logger.info('✅ 会話履歴サービス: 有効（Supabase接続成功）');
      } catch (error) {
        logger.error('会話履歴サービス: Supabaseクライアント作成エラー:', error);
      }
    } else {
      logger.warn('⚠️ 会話履歴サービス: 無効（SUPABASE_URL/SUPABASE_ANON_KEY未設定）');
    }
  }

  /**
   * 通話開始を記録
   */
  async startCall(params: {
    callSid: string;
    callerPhone?: string;
    customerName?: string;
    customerIdentified?: boolean;
  }): Promise<string | null> {
    logger.info(`📝 startCall呼び出し: enabled=${this.enabled}, client=${!!this.client}`);

    if (!this.enabled || !this.client) {
      logger.warn('会話履歴: サービス無効のためスキップ');
      return null;
    }

    try {
      logger.info(`📝 Supabase insert実行中: callSid=${params.callSid}`);

      const { data, error } = await this.client
        .from('calls')
        .insert({
          call_sid: params.callSid,
          caller_phone: params.callerPhone || null,
          customer_name: params.customerName || null,
          customer_identified: params.customerIdentified || false,
          status: 'active',
        })
        .select('id')
        .single();

      if (error) {
        logger.error('❌ 通話開始記録エラー:', error.message, error.details, error.hint);
        return null;
      }

      logger.info(`✅ 通話記録開始成功: ${data.id}`);
      return data.id;
    } catch (error) {
      logger.error('❌ 通話開始記録例外:', error);
      return null;
    }
  }

  /**
   * 通話終了を記録
   */
  async endCall(callId: string, durationSeconds: number): Promise<void> {
    if (!this.enabled || !this.client || !callId) return;

    try {
      const { error } = await this.client
        .from('calls')
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          status: 'completed',
        })
        .eq('id', callId);

      if (error) {
        logger.error('通話終了記録エラー:', error);
        return;
      }

      logger.debug(`通話記録終了: ${callId} (${durationSeconds}秒)`);
    } catch (error) {
      logger.error('通話終了記録例外:', error);
    }
  }

  /**
   * メッセージを記録
   */
  async addMessage(params: {
    callId: string;
    speaker: 'ai' | 'user' | 'system';
    content: string;
  }): Promise<void> {
    if (!this.enabled || !this.client || !params.callId) return;

    try {
      const { error } = await this.client
        .from('messages')
        .insert({
          call_id: params.callId,
          speaker: params.speaker,
          content: params.content,
        });

      if (error) {
        logger.error('メッセージ記録エラー:', error);
        return;
      }

      logger.debug(`メッセージ記録: [${params.speaker}] ${params.content.slice(0, 30)}...`);
    } catch (error) {
      logger.error('メッセージ記録例外:', error);
    }
  }

  /**
   * ツール呼び出しを記録
   */
  async addToolCall(params: {
    callId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }): Promise<void> {
    if (!this.enabled || !this.client || !params.callId) return;

    try {
      const { error } = await this.client
        .from('tool_calls')
        .insert({
          call_id: params.callId,
          tool_name: params.toolName,
          arguments: params.arguments,
          result: params.result,
        });

      if (error) {
        logger.error('ツール呼び出し記録エラー:', error);
        return;
      }

      logger.debug(`ツール記録: ${params.toolName}`);
    } catch (error) {
      logger.error('ツール呼び出し記録例外:', error);
    }
  }

  /**
   * 通話履歴を取得（最新N件）
   */
  async getRecentCalls(limit: number = 20): Promise<CallRecord[]> {
    if (!this.enabled || !this.client) return [];

    try {
      const { data, error } = await this.client
        .from('calls')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('通話履歴取得エラー:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('通話履歴取得例外:', error);
      return [];
    }
  }

  /**
   * 特定通話のメッセージを取得
   */
  async getCallMessages(callId: string): Promise<MessageRecord[]> {
    if (!this.enabled || !this.client) return [];

    try {
      const { data, error } = await this.client
        .from('messages')
        .select('*')
        .eq('call_id', callId)
        .order('timestamp', { ascending: true });

      if (error) {
        logger.error('メッセージ取得エラー:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('メッセージ取得例外:', error);
      return [];
    }
  }
}

// シングルトンインスタンス
export const conversationHistory = new ConversationHistoryService();
