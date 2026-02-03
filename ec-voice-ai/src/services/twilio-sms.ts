/**
 * Twilio SMS送信サービス
 */

import twilio from 'twilio';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/** SMS送信結果 */
export interface SmsSendResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

/**
 * Twilio SMS送信サービス
 */
class TwilioSmsService {
  private client: twilio.Twilio | null = null;
  private enabled: boolean = false;

  constructor() {
    const { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = env;

    // プレースホルダーでなければ有効化
    if (
      twilioAccountSid &&
      twilioAuthToken &&
      twilioPhoneNumber &&
      !twilioAccountSid.includes('placeholder')
    ) {
      this.client = twilio(twilioAccountSid, twilioAuthToken);
      this.enabled = true;
      logger.info('✅ Twilio SMSサービス: 有効');
    } else {
      logger.warn('⚠️ Twilio SMSサービス: 無効（認証情報未設定）');
    }
  }

  /**
   * SMSを送信
   */
  async send(to: string, body: string): Promise<SmsSendResult> {
    // 電話番号を国際形式に正規化
    const normalizedTo = this.normalizePhoneNumber(to);

    if (!this.enabled || !this.client) {
      logger.info(`[SMS送信スキップ] ${logger.maskPhone(normalizedTo)}: ${body.slice(0, 50)}...`);
      return { success: true, messageSid: 'dev-skip' };
    }

    try {
      logger.info(`📱 SMS送信中: ${logger.maskPhone(normalizedTo)}`);

      const message = await this.client.messages.create({
        body,
        from: env.twilioPhoneNumber,
        to: normalizedTo,
      });

      logger.info(`✅ SMS送信完了: SID=${message.sid}`);
      return { success: true, messageSid: message.sid };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`❌ SMS送信失敗: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 電話番号を国際形式に正規化
   * 0xxx → +81xxx
   */
  private normalizePhoneNumber(phone: string): string {
    let normalized = phone.replace(/[-\s()]/g, '');

    if (normalized.startsWith('0')) {
      normalized = '+81' + normalized.slice(1);
    }

    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }

    return normalized;
  }
}

// シングルトン
export const twilioSms = new TwilioSmsService();
