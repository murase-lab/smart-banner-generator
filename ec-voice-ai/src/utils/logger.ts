/**
 * シンプルなロギングユーティリティ
 */

import { LogLevel } from '../types/index.js';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** 現在のログレベル */
let currentLevel: LogLevel = 'info';

/**
 * ログレベルを設定
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * タイムスタンプを取得（日本時間）
 */
function getTimestamp(): string {
  return new Date().toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * ログを出力
 */
function log(level: LogLevel, message: string, ...args: unknown[]): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) {
    return;
  }

  const timestamp = getTimestamp();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  switch (level) {
    case 'debug':
      console.debug(prefix, message, ...args);
      break;
    case 'info':
      console.info(prefix, message, ...args);
      break;
    case 'warn':
      console.warn(prefix, message, ...args);
      break;
    case 'error':
      console.error(prefix, message, ...args);
      break;
  }
}

/**
 * ロガーオブジェクト
 */
export const logger = {
  debug: (message: string, ...args: unknown[]) => log('debug', message, ...args),
  info: (message: string, ...args: unknown[]) => log('info', message, ...args),
  warn: (message: string, ...args: unknown[]) => log('warn', message, ...args),
  error: (message: string, ...args: unknown[]) => log('error', message, ...args),

  /**
   * 電話番号をマスクして表示
   */
  maskPhone: (phone: string): string => {
    if (phone.length <= 4) return '****';
    return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
  },

  /**
   * 通話開始ログ
   */
  callStart: (callSid: string, from: string) => {
    log('info', `📞 着信: ${logger.maskPhone(from)} [CallSid: ${callSid.slice(-8)}]`);
  },

  /**
   * 通話終了ログ
   */
  callEnd: (callSid: string, duration?: number) => {
    const durationStr = duration ? ` (${duration}秒)` : '';
    log('info', `📞 通話終了 [CallSid: ${callSid.slice(-8)}]${durationStr}`);
  },

  /**
   * 顧客特定ログ
   */
  customerIdentified: (name: string, orderCount: number) => {
    log('info', `👤 顧客特定: ${name}様 (注文${orderCount}件)`);
  },

  /**
   * API呼び出しログ
   */
  apiCall: (service: string, endpoint: string, success: boolean, count?: number) => {
    const status = success ? '✅' : '❌';
    const countStr = count !== undefined ? ` (${count}件)` : '';
    log('info', `${status} API: ${service} - ${endpoint}${countStr}`);
  },

  /**
   * ツール実行ログ
   */
  toolExecution: (toolName: string, args: unknown) => {
    log('debug', `🔧 ツール実行: ${toolName}`, args);
  },

  /**
   * WebSocket接続ログ
   */
  wsConnect: (service: string) => {
    log('info', `🔌 WebSocket接続: ${service}`);
  },

  /**
   * WebSocket切断ログ
   */
  wsDisconnect: (service: string) => {
    log('info', `🔌 WebSocket切断: ${service}`);
  },
};
