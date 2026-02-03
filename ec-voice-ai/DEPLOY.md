# EC Voice AI デプロイガイド

## 必要な環境変数

本番環境では以下の環境変数が**必須**です:

| 変数名 | 説明 | 取得元 |
|--------|------|--------|
| `OPENAI_API_KEY` | OpenAI APIキー | https://platform.openai.com/api-keys |
| `TWILIO_ACCOUNT_SID` | TwilioアカウントSID | https://console.twilio.com |
| `TWILIO_AUTH_TOKEN` | Twilio認証トークン | https://console.twilio.com |
| `TWILIO_PHONE_NUMBER` | Twilio電話番号 (+81xxx形式) | Twilioコンソール |
| `NE_CLIENT_ID` | ネクストエンジン クライアントID | https://developer.next-engine.com |
| `NE_CLIENT_SECRET` | ネクストエンジン クライアントシークレット | 同上 |
| `NE_REFRESH_TOKEN` | ネクストエンジン リフレッシュトークン | 同上 |

オプション:
- `PORT` (デフォルト: 3000)
- `NODE_ENV` (デフォルト: production)
- `LOG_LEVEL` (デフォルト: info)

---

## Railway でデプロイ（推奨）

Railway は WebSocket をネイティブサポートし、設定が簡単です。

### 1. Railway アカウント作成
https://railway.app/ でアカウントを作成

### 2. 新規プロジェクト作成
```bash
# Railway CLI インストール
npm install -g @railway/cli

# ログイン
railway login

# プロジェクト初期化
cd ec-voice-ai
railway init
```

### 3. 環境変数設定
Railway Dashboard または CLI で設定:
```bash
railway variables set OPENAI_API_KEY=sk-xxx
railway variables set TWILIO_ACCOUNT_SID=ACxxx
railway variables set TWILIO_AUTH_TOKEN=xxx
railway variables set TWILIO_PHONE_NUMBER=+815012345678
railway variables set NE_CLIENT_ID=xxx
railway variables set NE_CLIENT_SECRET=xxx
railway variables set NE_REFRESH_TOKEN=xxx
```

### 4. デプロイ
```bash
railway up
```

### 5. ドメイン取得
Railway Dashboard → Settings → Domains で公開URLを取得
例: `ec-voice-ai-production.up.railway.app`

---

## Fly.io でデプロイ

### 1. Fly.io CLI インストール
```bash
# macOS
brew install flyctl

# Windows (PowerShell)
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### 2. ログイン・初期化
```bash
fly auth login
cd ec-voice-ai
fly launch --name ec-voice-ai --region nrt --no-deploy
```

### 3. シークレット設定
```bash
fly secrets set OPENAI_API_KEY=sk-xxx
fly secrets set TWILIO_ACCOUNT_SID=ACxxx
fly secrets set TWILIO_AUTH_TOKEN=xxx
fly secrets set TWILIO_PHONE_NUMBER=+815012345678
fly secrets set NE_CLIENT_ID=xxx
fly secrets set NE_CLIENT_SECRET=xxx
fly secrets set NE_REFRESH_TOKEN=xxx
```

### 4. デプロイ
```bash
fly deploy
```

### 5. URL確認
```bash
fly status
# URL: https://ec-voice-ai.fly.dev
```

---

## Render でデプロイ

### 1. Render アカウント作成
https://render.com/ でアカウント作成

### 2. 新規 Web Service 作成
- GitHub リポジトリを接続
- Runtime: Docker
- Region: Singapore (sgp1) - 日本に近い

### 3. 環境変数設定
Render Dashboard → Environment で設定

### 4. デプロイ
GitHub にプッシュすると自動デプロイ

---

## Twilio Webhook 設定

デプロイ後、Twilio コンソールで電話番号の Webhook を更新:

1. https://console.twilio.com → Phone Numbers → Manage → Active Numbers
2. 該当番号をクリック
3. Voice & Fax → A CALL COMES IN:
   - **Webhook URL**: `https://your-domain.com/incoming-call`
   - **HTTP Method**: POST

---

## 動作確認

### ヘルスチェック
```bash
curl https://your-domain.com/health
```

期待するレスポンス:
```json
{
  "status": "ok",
  "timestamp": "2024-xx-xxTxx:xx:xx.xxxZ",
  "version": "2.0.0",
  "environment": "production"
}
```

### テスト電話
Twilio に設定した電話番号に発信して動作確認

---

## トラブルシューティング

### WebSocket 接続エラー
- Railway/Fly.io は WebSocket をネイティブサポート
- Render の場合は Web Service（Docker）を選択

### 音声が聞こえない
- OpenAI API キーが有効か確認
- OpenAI アカウントに残高があるか確認
- ログで `response.audio.delta` イベントが出ているか確認

### 通話がすぐ切れる
- Twilio Webhook URL が正しいか確認
- HTTPS が必須（HTTP は動作しない）
- サーバーログでエラーを確認

---

## コスト目安

| サービス | プラン | 目安コスト |
|----------|--------|-----------|
| Railway | Hobby | $5/月 + 使用量 |
| Fly.io | Free Tier | 無料枠あり |
| Render | Starter | $7/月 |
| OpenAI Realtime | 従量課金 | 音声時間による |
| Twilio | 従量課金 | 通話分数による |
