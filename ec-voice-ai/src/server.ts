/**
 * Fastify サーバー設定
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyFormbody from '@fastify/formbody';
import { env } from './config/env.js';
import { logger, setLogLevel } from './utils/logger.js';
import { handleIncomingCall } from './handlers/incoming-call.js';
import { handleMediaStream } from './handlers/media-stream.js';

/**
 * Fastifyサーバーを作成
 */
export async function createServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false, // カスタムロガーを使用
  });

  // ログレベル設定
  setLogLevel(env.logLevel);

  // プラグイン登録
  await fastify.register(fastifyFormbody); // x-www-form-urlencoded パース
  await fastify.register(fastifyWebsocket);

  // ヘルスチェック
  fastify.get('/health', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: env.nodeEnv,
      features: {
        openaiRealtime: true,
        nextEngineIntegration: true,
        twilioMediaStream: true,
      },
    };
  });

  // ルート（情報表示）
  fastify.get('/', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      name: 'EC電話対応AI',
      description: '先回り対応で顧客満足度向上',
      version: '2.0.0',
      endpoints: {
        health: 'GET /health',
        incomingCall: 'POST /incoming-call (Twilio Webhook)',
        mediaStream: 'WebSocket /media-stream',
      },
      features: [
        '電話番号による顧客自動特定',
        'OpenAI Realtime APIによる音声対話',
        '注文状況確認',
        '返品・交換受付',
        'SMS送信',
        'オペレーター転送',
      ],
    };
  });

  // Twilio着信Webhook
  fastify.all('/incoming-call', handleIncomingCall);

  // WebSocket（音声ストリーム）
  fastify.register(async (app) => {
    app.get('/media-stream', { websocket: true }, (connection) => {
      logger.wsConnect('Twilio');
      handleMediaStream(connection);
    });
  });

  // エラーハンドラ
  fastify.setErrorHandler((error, request, reply) => {
    logger.error(`リクエストエラー [${request.method} ${request.url}]:`, error);
    reply.status(500).send({
      error: 'Internal Server Error',
      message: env.nodeEnv === 'development' ? error.message : undefined,
    });
  });

  // 404ハンドラ
  fastify.setNotFoundHandler((request, reply) => {
    logger.warn(`404 Not Found: ${request.method} ${request.url}`);
    reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  return fastify;
}

/**
 * サーバーを起動
 */
export async function startServer(): Promise<FastifyInstance> {
  const server = await createServer();

  try {
    await server.listen({
      port: env.port,
      host: '0.0.0.0',
    });

    logger.info(`🚀 サーバー起動: http://localhost:${env.port}`);
    logger.info(`📋 環境: ${env.nodeEnv}`);
    logger.info(`📋 ログレベル: ${env.logLevel}`);
    logger.info(`📋 機能: OpenAI Realtime API + ネクストエンジン連携`);

    return server;
  } catch (error) {
    logger.error('サーバー起動失敗:', error);
    throw error;
  }
}
