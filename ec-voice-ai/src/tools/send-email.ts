/**
 * メール送信ツール
 * 注文時のメールアドレスに追跡URL・返品フォーム等を送信
 */

import { RealtimeTool, SmsTemplate } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { emailService } from '../services/email.js';

/** ツール定義 */
export const sendEmailTool: RealtimeTool = {
  type: 'function',
  name: 'send_email',
  description: 'お客様の注文時のメールアドレスにメールを送信します。追跡情報のURL、返品フォームのリンク、折り返し連絡の確認などを送れます。メールアドレスは注文情報から自動取得されるため、お客様に確認する必要はありません。',
  parameters: {
    type: 'object',
    properties: {
      template: {
        type: 'string',
        enum: ['tracking', 'return_form', 'callback'],
        description: 'メールテンプレート: tracking(配送追跡URL), return_form(返品フォーム), callback(折り返し連絡)',
      },
    },
    required: ['template'],
  },
};

/** ツール実行コンテキスト */
export interface SendEmailContext {
  customerEmail?: string;
  customerName?: string;
  orderId?: string;
  trackingUrl?: string;
  trackingNumber?: string;
  carrier?: string;
  shopName?: string;
}

/** メールテンプレート（件名 + 本文） */
interface EmailTemplate {
  subject: string;
  body: string;
}

/**
 * テンプレートからメール内容を生成
 */
function generateEmailContent(
  template: SmsTemplate,
  context: SendEmailContext
): EmailTemplate {
  const shopName = context.shopName || 'ECショップ';
  const customerName = context.customerName || 'お客様';

  switch (template) {
    case 'tracking':
      return {
        subject: `【${shopName}】配送状況のご案内`,
        body: [
          `${customerName} 様`,
          '',
          'いつもご利用ありがとうございます。',
          'お問い合わせいただいた配送状況についてご案内いたします。',
          '',
          context.orderId ? `注文番号: ${context.orderId}` : '',
          context.carrier ? `配送業者: ${context.carrier}` : '',
          context.trackingNumber ? `追跡番号: ${context.trackingNumber}` : '',
          context.trackingUrl ? `追跡URL: ${context.trackingUrl}` : '',
          '',
          'ご不明な点がございましたら、お気軽にお電話ください。',
          '',
          `${shopName} カスタマーサポート`,
        ].filter(Boolean).join('\n'),
      };

    case 'return_form':
      return {
        subject: `【${shopName}】返品・交換のご案内`,
        body: [
          `${customerName} 様`,
          '',
          'お電話でのお問い合わせありがとうございます。',
          '返品・交換のお手続きについてご案内いたします。',
          '',
          '下記URLより返品申請フォームにアクセスしてください。',
          'https://shop.example.com/return',
          '',
          context.orderId ? `対象注文番号: ${context.orderId}` : '',
          '',
          '※返品・交換の条件については、フォーム内の説明をご確認ください。',
          '',
          `${shopName} カスタマーサポート`,
        ].filter(Boolean).join('\n'),
      };

    case 'callback':
      return {
        subject: `【${shopName}】折り返しのご連絡について`,
        body: [
          `${customerName} 様`,
          '',
          'お電話ありがとうございました。',
          '担当者より改めてご連絡させていただきます。',
          '',
          'お急ぎの場合は、下記までお電話ください。',
          '電話番号: 050-xxxx-xxxx',
          '',
          `${shopName} カスタマーサポート`,
        ].filter(Boolean).join('\n'),
      };

    default:
      return {
        subject: `【${shopName}】お問い合わせについて`,
        body: `${customerName} 様\n\nお電話ありがとうございました。\n\n${shopName} カスタマーサポート`,
      };
  }
}

/**
 * メール送信を実行
 */
export async function executeSendEmail(
  args: { template: SmsTemplate },
  context: SendEmailContext
): Promise<string> {
  const { template } = args;

  if (!context.customerEmail) {
    return 'お客様のメールアドレスが見つかりませんでした。お手数ですが、メールアドレスをお伺いしてもよろしいでしょうか。';
  }

  const emailContent = generateEmailContent(template, context);

  const result = await emailService.send(
    context.customerEmail,
    emailContent.subject,
    emailContent.body
  );

  if (result.success) {
    logger.info(`メール送信完了: ${context.customerEmail} - template: ${template}`);
    return getSuccessMessage(template);
  } else {
    logger.error(`メール送信失敗: ${result.error}`);
    return 'メールの送信に失敗しました。後ほど再度お試しください。';
  }
}

/**
 * 成功メッセージ
 */
function getSuccessMessage(template: SmsTemplate): string {
  switch (template) {
    case 'tracking':
      return 'ご注文時のメールアドレスに配送追跡情報をお送りしました。ご確認ください。';
    case 'return_form':
      return 'ご注文時のメールアドレスに返品申請フォームのURLをお送りしました。';
    case 'callback':
      return '折り返しのご連絡について、ご注文時のメールアドレスにお送りしました。担当者よりお電話いたします。';
    default:
      return 'ご注文時のメールアドレスにメールをお送りしました。';
  }
}
