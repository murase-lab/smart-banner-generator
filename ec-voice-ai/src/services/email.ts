/**
 * メール送信サービス（Resend）
 */

import { Resend } from 'resend';
import { logger } from '../utils/logger.js';

/** メール送信結果 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * メール送信サービス
 */
class EmailService {
  private client: Resend | null = null;
  private enabled: boolean = false;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev';

    if (apiKey) {
      this.client = new Resend(apiKey);
      this.enabled = true;
      logger.info(`✅ メール送信サービス: 有効（送信元: ${this.fromEmail}）`);
    } else {
      logger.warn('⚠️ メール送信サービス: 無効（RESEND_API_KEY未設定）');
    }
  }

  /**
   * メールを送信
   */
  async send(to: string, subject: string, body: string): Promise<EmailSendResult> {
    if (!this.enabled || !this.client) {
      logger.info(`[メール送信スキップ] ${to}: ${subject}`);
      return { success: true, messageId: 'dev-skip' };
    }

    try {
      logger.info(`📧 メール送信中: ${to} - ${subject}`);

      const { data, error } = await this.client.emails.send({
        from: this.fromEmail,
        to: [to],
        subject,
        text: body,
      });

      if (error) {
        logger.error(`❌ メール送信失敗: ${error.message}`);
        return { success: false, error: error.message };
      }

      logger.info(`✅ メール送信完了: ID=${data?.id}`);
      return { success: true, messageId: data?.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`❌ メール送信例外: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }
}

// シングルトン
export const emailService = new EmailService();
