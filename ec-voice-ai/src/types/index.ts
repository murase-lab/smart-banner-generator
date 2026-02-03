/**
 * EC電話対応AI 型定義
 */

// ======================
// 注文関連
// ======================

/** 注文アイテム */
export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

/** 注文ステータス */
export type OrderStatus =
  | 'pending'      // 起票済み
  | 'preparing'    // 出荷準備中
  | 'confirmed'    // 出荷確定
  | 'shipped'      // 出荷済み
  | 'delivered'    // 配達完了
  | 'cancelled'    // キャンセル
  | 'returned';    // 返品済み

/** プラットフォーム */
export type Platform = 'rakuten' | 'amazon' | 'shopify';

/** 注文情報 */
export interface Order {
  orderId: string;
  customerPhone: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  statusName: string;
  orderDate: string;
  shippedDate: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  items: OrderItem[];
  totalAmount: number;
  platform: Platform;
}

// ======================
// 顧客コンテキスト（先回り検索結果）
// ======================

/** 最新注文の要約 */
export interface LatestOrderSummary {
  orderId: string;
  orderDate: string;
  status: OrderStatus;
  statusMessage: string;
  trackingNumber: string | null;
  carrier: string | null;
  items: string[];
}

/** 顧客コンテキスト（先回り検索結果） */
export interface CustomerContext {
  found: boolean;
  customerName?: string;
  greeting: string;
  orders?: Order[];
  latestOrder?: LatestOrderSummary;
  error?: boolean;
}

// ======================
// 返品・交換関連
// ======================

/** 返品理由 */
export type ReturnReason =
  | 'defective'       // 不良品
  | 'damaged'         // 破損
  | 'wrong_item'      // 誤配送
  | 'size_issue'      // サイズ違い
  | 'image_different' // イメージ違い
  | 'other';          // その他

/** 商品状態 */
export type ProductCondition = 'unopened' | 'opened';

/** 返品・交換リクエスト */
export type ReturnRequest = 'refund' | 'exchange';

/** 返品受付情報 */
export interface ReturnRegistration {
  orderId: string;
  reason: ReturnReason;
  condition: ProductCondition;
  request: ReturnRequest;
  description?: string;
}

// ======================
// ツール関連（Function Calling）
// ======================

/** ツール名 */
export type ToolName =
  | 'check_order_status'
  | 'register_return'
  | 'send_email'
  | 'transfer_to_human';

/** SMSテンプレート種類 */
export type SmsTemplate = 'tracking' | 'return_form' | 'callback';

/** 転送優先度 */
export type TransferPriority = 'normal' | 'high' | 'urgent';

/** 注文確認ツールの引数 */
export interface CheckOrderStatusArgs {
  phone_number?: string;
  order_id?: string;
}

/** 返品登録ツールの引数 */
export interface RegisterReturnArgs {
  order_id: string;
  reason: ReturnReason;
  condition: ProductCondition;
  request: ReturnRequest;
}

/** SMS送信ツールの引数 */
export interface SendSmsArgs {
  phone_number: string;
  template: SmsTemplate;
}

/** 人へ転送ツールの引数 */
export interface TransferToHumanArgs {
  reason: string;
  summary?: string;
  priority?: TransferPriority;
}

/** ツール引数の共用体型 */
export type ToolArgs =
  | CheckOrderStatusArgs
  | RegisterReturnArgs
  | SendSmsArgs
  | TransferToHumanArgs;

// ======================
// OpenAI Realtime API関連
// ======================

/** セッション設定 */
export interface RealtimeSessionConfig {
  modalities: string[];
  instructions: string;
  voice: string;
  input_audio_format: string;
  output_audio_format: string;
  input_audio_transcription?: {
    model: string;
  };
  turn_detection: {
    type: string;
    threshold: number;
    prefix_padding_ms?: number;
    silence_duration_ms: number;
  };
  tools: RealtimeTool[];
  tool_choice: string;
}

/** Realtimeツール定義 */
export interface RealtimeTool {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ======================
// Twilio関連
// ======================

/** Twilio着信データ */
export interface TwilioCallData {
  CallSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  AccountSid: string;
}

/** Twilioメディアストリームイベント */
export type TwilioStreamEvent =
  | 'connected'
  | 'start'
  | 'media'
  | 'stop'
  | 'mark';

/** Twilioストリームメッセージ */
export interface TwilioStreamMessage {
  event: TwilioStreamEvent;
  sequenceNumber?: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters?: Record<string, string>;
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
  mark?: {
    name: string;
  };
}

/** Twilio送信メッセージ */
export interface TwilioOutboundMessage {
  event: 'media' | 'clear' | 'mark';
  streamSid: string;
  media?: {
    payload: string;
  };
  mark?: {
    name: string;
  };
}

/** 転送データ */
export interface TransferData {
  reason: string;
  summary?: string;
  priority: TransferPriority;
  callSid: string;
  customerName?: string;
  customerPhone?: string;
  timestamp: string;
}

// ======================
// ログ関連
// ======================

/** ログレベル */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** 会話ログエントリ */
export interface ConversationLogEntry {
  timestamp: Date;
  speaker: 'AI' | 'customer';
  content: string;
}

// ======================
// ネクストエンジンAPI関連
// ======================

/** ネクストエンジンAPIレスポンス基本形 */
export interface NextEngineBaseResponse {
  result: 'success' | 'error';
  message?: string;
}

/** ネクストエンジン注文検索レスポンス */
export interface NextEngineOrderSearchResponse extends NextEngineBaseResponse {
  count?: number;
  data?: NextEngineOrderData[];
}

/** ネクストエンジン注文データ（APIレスポンス形式） */
export interface NextEngineOrderData {
  receive_order_id: string;
  receive_order_shop_cut_form_id: string;
  receive_order_purchaser_name: string;
  receive_order_purchaser_tel: string;
  receive_order_purchaser_mail_address: string;
  receive_order_date: string;
  receive_order_confirm_ids: string;
  receive_order_delivery_cut_form_id: string;
  receive_order_delivery_name: string;
  receive_order_delivery_slip_number: string;
  receive_order_gruoping_key: string;
  receive_order_total_amount: string;
  receive_order_shop_id: string;
  receive_order_send_date?: string;
  receive_order_note?: string;
}
