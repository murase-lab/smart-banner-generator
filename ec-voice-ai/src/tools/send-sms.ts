/**
 * SMS送信ツール
 * Twilio + Supabase SMSテンプレート連携
 */

import { RealtimeTool, SendSmsArgs, SmsTemplate, Order } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { twilioSms } from '../services/twilio-sms.js';

/** ツール定義 */
export const sendSmsTool: RealtimeTool = {
  type: 'function',
  name: 'send_sms',
  description: '顧客の電話番号にSMSを送信します。追跡情報のURL、返品フォームのリンク、折り返し連絡の確認などを送れます。',
  parameters: {
    type: 'object',
    properties: {
      phone_number: {
        type: 'string',
        description: '送信先の電話番号（国際形式 +81xxx または国内形式 0xxx）',
      },
      template: {
        type: 'string',
        enum: ['tracking', 'return_form', 'callback'],
        description: 'SMSテンプレート: tracking(追跡URL), return_form(返品フォーム), callback(折り返し連絡)',
      },
      custom_message: {
        type: 'string',
        description: 'カスタムメッセージ（テンプレートを使わない場合）',
      },
    },
    required: ['phone_number'],
  },
};

/** ツール実行コンテキスト */
export interface SendSmsContext {
  latestOrder?: Order;
  shopName?: string;
}

/** デフォルトSMSテンプレート */
const DEFAULT_TEMPLATES: Record<SmsTemplate, (context: SendSmsContext) => string> = {
  tracking: (context) => {
    const shopName = context.shopName || 'ECショップ';
    const trackingUrl = context.latestOrder?.trackingUrl || '準備中';
    return `【${shopName}】配送状況はこちらからご確認いただけます: ${trackingUrl}`;
  },
  return_form: (context) => {
    const shopName = context.shopName || 'ECショップ';
    return `【${shopName}】返品申請フォームはこちらです: https://shop.example.com/return`;
  },
  callback: (context) => {
    const shopName = context.shopName || 'ECショップ';
    return `【${shopName}】折り返しのご連絡をご希望ですね。担当者より30分以内にお電話いたします。`;
  },
};

/**
 * Supabaseからテンプレートを取得し、変数を展開
 */
async function getTemplateMessage(
  template: SmsTemplate,
  context: SendSmsContext
): Promise<string> {
  // Supabaseからカスタムテンプレートを取得を試行
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // テンプレート名のマッピング
      const templateNames: Record<SmsTemplate, string> = {
        tracking: '配送追跡URL',
        return_form: '返品フォーム',
        callback: '折り返し連絡',
      };

      const { data } = await supabase
        .from('sms_templates')
        .select('content')
        .eq('name', templateNames[template])
        .single();

      if (data?.content) {
        // 変数を展開
        let message = data.content;
        message = message.replace('{customer_name}', context.latestOrder?.customerName || 'お客様');
        message = message.replace('{order_id}', context.latestOrder?.orderId || '');
        message = message.replace('{tracking_url}', context.latestOrder?.trackingUrl || '準備中');
        message = message.replace('{return_url}', 'https://shop.example.com/return');
        message = message.replace('{support_phone}', '050-xxxx-xxxx');
        logger.info(`SMSテンプレート取得成功（Supabase）: ${templateNames[template]}`);
        return message;
      }
    }
  } catch (error) {
    logger.debug('Supabaseテンプレート取得スキップ（デフォルト使用）');
  }

  // デフォルトテンプレートを使用
  return DEFAULT_TEMPLATES[template](context);
}

/**
 * SMS送信を実行
 */
export async function executeSendSms(
  args: SendSmsArgs,
  context: SendSmsContext
): Promise<string> {
  const { phone_number, template } = args;
  const customMessage = (args as { custom_message?: string }).custom_message;

  let message: string;

  if (customMessage) {
    // カスタムメッセージ
    message = customMessage;
  } else if (template) {
    // テンプレートからメッセージ生成
    message = await getTemplateMessage(template, context);
  } else {
    return 'テンプレートまたはカスタムメッセージを指定してください。';
  }

  // Twilio SMS送信
  const result = await twilioSms.send(phone_number, message);

  if (result.success) {
    logger.info(`SMS送信完了: ${logger.maskPhone(phone_number)} - template: ${template || 'custom'}`);
    return getSmsSuccessMessage(template);
  } else {
    logger.error(`SMS送信失敗: ${result.error}`);
    return 'SMSの送信に失敗しました。後ほど再度お試しください。';
  }
}

/**
 * SMS送信成功メッセージを取得
 */
function getSmsSuccessMessage(template?: SmsTemplate): string {
  switch (template) {
    case 'tracking':
      return '追跡URLをSMSでお送りしました。ご確認ください。';
    case 'return_form':
      return '返品申請フォームのURLをSMSでお送りしました。';
    case 'callback':
      return '折り返しのご連絡について、SMSでお送りしました。担当者よりお電話いたします。';
    default:
      return 'SMSをお送りしました。';
  }
}
