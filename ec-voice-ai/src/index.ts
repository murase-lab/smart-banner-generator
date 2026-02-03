/**
 * EC電話対応AI - エントリーポイント
 *
 * 電話がかかってきた瞬間に発信者番号でネクストエンジンを検索し、
 * お客様が名乗る前に「〇〇様ですね」と呼びかける「先回り対応」システム
 */

import { startServer } from './server.js';
import { env, printEnvStatus } from './config/env.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  console.log(`
╔═══════════════════════════════════════════╗
║         EC電話対応AI システム             ║
║     〜先回り対応で顧客満足度向上〜         ║
╚═══════════════════════════════════════════╝
`);

  // 環境変数の状況を表示
  printEnvStatus(env);

  try {
    // サーバー起動
    const server = await startServer();

    // グレースフルシャットダウン
    const shutdown = async (signal: string) => {
      logger.info(`${signal} シグナル受信、シャットダウン開始...`);

      try {
        await server.close();
        logger.info('サーバー正常終了');
        process.exit(0);
      } catch (error) {
        logger.error('シャットダウンエラー:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // 未処理のPromise拒否をキャッチ
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未処理のPromise拒否:', reason);
      logger.error('Promise:', promise);
    });

    // 未処理の例外をキャッチ
    process.on('uncaughtException', (error) => {
      logger.error('未処理の例外:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('起動失敗:', error);
    process.exit(1);
  }
}

// メイン関数を実行
main();
