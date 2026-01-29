import { useState } from 'react'

export default function BannerPreview({ banner, formData, onRegenerate, onReset, isLoading }) {
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)

  const handleRegenerate = () => {
    if (feedback.trim()) {
      onRegenerate(feedback)
      setFeedback('')
      setShowFeedback(false)
    } else {
      onRegenerate(null) // Simple regeneration without feedback
    }
  }

  const handleDownload = () => {
    if (banner?.imageData) {
      const link = document.createElement('a')
      link.href = `data:image/png;base64,${banner.imageData}`
      link.download = `banner-${formData?.platformDetails?.id || 'output'}-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Display info about reference images used
  const referenceInfo = []
  if (banner?.referenceImagesCount > 0) {
    referenceInfo.push(`商品画像${banner.referenceImagesCount}枚参照`)
  }
  if (banner?.logoIncluded) {
    referenceInfo.push('ロゴ参照')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">生成されたバナー</h2>
        <div className="flex items-center gap-3">
          {referenceInfo.length > 0 && (
            <span className="text-xs px-2 py-1 bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded">
              {referenceInfo.join(' / ')}
            </span>
          )}
          <span className="text-sm text-[var(--color-text-muted)]">
            プラットフォーム: {formData?.platformDetails?.name}
          </span>
        </div>
      </div>

      {/* Banner Display */}
      <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
        <div className="flex justify-center">
          {banner?.imageData ? (
            <img
              src={`data:image/png;base64,${banner.imageData}`}
              alt="Generated Banner"
              className="max-w-full max-h-[600px] rounded-lg shadow-2xl"
            />
          ) : (
            <div className="w-full h-64 bg-[var(--color-background)] rounded-lg flex items-center justify-center text-[var(--color-text-muted)]">
              画像が生成されていません
            </div>
          )}
        </div>

        {banner?.textResponse && (
          <div className="mt-4 p-4 bg-[var(--color-background)] rounded-lg">
            <p className="text-sm text-[var(--color-text-muted)]">{banner.textResponse}</p>
          </div>
        )}
      </div>

      {/* Feedback Section */}
      {showFeedback && (
        <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
          <h3 className="font-semibold mb-3">再生成リクエスト</h3>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="変更したい内容を記入してください（例：「色をもっと明るく」「コントラストを強く」「背景を変えて」など）..."
            rows={4}
            className="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition resize-none"
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              className="px-6 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 rounded-lg font-medium transition flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  再生成中...
                </>
              ) : (
                '変更を適用して再生成'
              )}
            </button>
            <button
              onClick={() => setShowFeedback(false)}
              className="px-6 py-2 bg-[var(--color-surface-hover)] hover:bg-[var(--color-border)] rounded-lg font-medium transition"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => setShowFeedback(true)}
          disabled={isLoading}
          className="py-4 px-6 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl font-semibold transition flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          再生成
        </button>

        <button
          onClick={handleDownload}
          disabled={!banner?.imageData || isLoading}
          className="py-4 px-6 bg-[var(--color-secondary)] hover:opacity-90 disabled:opacity-50 rounded-xl font-semibold transition flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          ダウンロード
        </button>

        <button
          onClick={onReset}
          disabled={isLoading}
          className="py-4 px-6 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl font-semibold transition flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          新規作成
        </button>
      </div>

      {/* Generation Info */}
      <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
        <h3 className="text-sm font-semibold mb-2">生成情報</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-[var(--color-text-muted)]">
          <div>
            <span className="block text-xs">プラットフォーム</span>
            <span>{formData?.platformDetails?.name}</span>
          </div>
          <div>
            <span className="block text-xs">サイズ</span>
            <span>{formData?.platformDetails?.size}</span>
          </div>
          <div>
            <span className="block text-xs">アスペクト比</span>
            <span>{formData?.platformDetails?.ratio}</span>
          </div>
          <div>
            <span className="block text-xs">商品</span>
            <span>{formData?.productName}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
