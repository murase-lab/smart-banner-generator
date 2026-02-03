/**
 * 環境変数の読み込み・検証
 */

import { config } from 'dotenv';
import { LogLevel } from '../types/index.js';

// .envファイルを読み込み
config();

/** 環境変数の設定 */
export interface EnvConfig {
  // アプリケーション
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: LogLevel;

  // OpenAI
  openaiApiKey: string;

  // Twilio
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;

  // ネクストエンジン
  neClientId: string;
  neClientSecret: string;
  neRefreshToken: string;
}

/**
 * 環境変数を取得（必須）
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`環境変数 ${key} が設定されていません`);
  }
  return value;
}

/**
 * 環境変数を取得（オプション、デフォルト値あり）
 */
function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * 環境変数の検証とロード
 * 開発時は一部の環境変数がなくても起動可能
 */
export function loadEnvConfig(): EnvConfig {
  const nodeEnv = getOptionalEnv('NODE_ENV', 'development') as EnvConfig['nodeEnv'];
  const isDev = nodeEnv === 'development';

  // 開発モードではダミー値を許容
  const safeGetEnv = (key: string, devDefault: string): string => {
    if (isDev) {
      return getOptionalEnv(key, devDefault);
    }
    return getRequiredEnv(key);
  };

  return {
    // アプリケーション
    port: parseInt(getOptionalEnv('PORT', '3000'), 10),
    nodeEnv,
    logLevel: getOptionalEnv('LOG_LEVEL', 'info') as LogLevel,

    // OpenAI
    openaiApiKey: safeGetEnv('OPENAI_API_KEY', 'sk-dev-placeholder'),

    // Twilio
    twilioAccountSid: safeGetEnv('TWILIO_ACCOUNT_SID', 'AC-dev-placeholder'),
    twilioAuthToken: safeGetEnv('TWILIO_AUTH_TOKEN', 'dev-placeholder'),
    twilioPhoneNumber: safeGetEnv('TWILIO_PHONE_NUMBER', '+815000000000'),

    // ネクストエンジン
    neClientId: safeGetEnv('NE_CLIENT_ID', 'dev-placeholder'),
    neClientSecret: safeGetEnv('NE_CLIENT_SECRET', 'dev-placeholder'),
    neRefreshToken: safeGetEnv('NE_REFRESH_TOKEN', 'dev-placeholder'),
  };
}

/**
 * 環境変数の設定状況を表示（機密情報はマスク）
 */
export function printEnvStatus(config: EnvConfig): void {
  const mask = (value: string): string => {
    if (value.length <= 8) return '****';
    return value.substring(0, 4) + '****' + value.substring(value.length - 4);
  };

  const checkEnv = (key: string): string => {
    const value = process.env[key];
    if (!value) return '❌ 未設定';
    return `✅ ${mask(value)}`;
  };

  console.log('=== 環境変数設定状況 ===');
  console.log(`NODE_ENV: ${config.nodeEnv}`);
  console.log(`PORT: ${config.port}`);
  console.log(`LOG_LEVEL: ${config.logLevel}`);
  console.log(`OPENAI_API_KEY: ${mask(config.openaiApiKey)}`);
  console.log(`TWILIO_ACCOUNT_SID: ${mask(config.twilioAccountSid)}`);
  console.log(`TWILIO_PHONE_NUMBER: ${config.twilioPhoneNumber}`);
  console.log(`NE_CLIENT_ID: ${mask(config.neClientId)}`);
  console.log('--- Supabase (会話履歴) ---');
  console.log(`SUPABASE_URL: ${checkEnv('SUPABASE_URL')}`);
  console.log(`SUPABASE_ANON_KEY: ${checkEnv('SUPABASE_ANON_KEY')}`);
  console.log('========================');
}

// シングルトンでエクスポート
export const env = loadEnvConfig();
