import { useState, useRef, useEffect } from 'react'

export default function AsciiPreview({ result, formData, onApprove, onBack, isLoading }) {
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const canvasRef = useRef(null)
  const [asciiImageUrl, setAsciiImageUrl] = useState(null)

  // Convert ASCII to PNG image using canvas
  useEffect(() => {
    if (!result?.ascii || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const lines = result.ascii.split('\n')
    const charWidth = 8
    const charHeight = 14
    const padding = 20

    const maxLineLength = Math.max(...lines.map((l) => l.length))
    canvas.width = maxLineLength * charWidth + padding * 2
    canvas.height = lines.length * charHeight + padding * 2

    // Background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Text
    ctx.font = '12px "Courier New", monospace'
    ctx.fillStyle = '#00ff00'

    lines.forEach((line, i) => {
      ctx.fillText(line, padding, padding + (i + 1) * charHeight)
    })

    setAsciiImageUrl(canvas.toDataURL('image/png'))
  }, [result?.ascii])

  const handleApprove = () => {
    // Pass ASCII image along with approval
    const asciiImageBase64 = asciiImageUrl ? asciiImageUrl.split(',')[1] : null
    onApprove(null, asciiImageBase64) // null feedback means approved, pass image
  }

  const handleRequestChanges = () => {
    if (feedback.trim()) {
      onApprove(feedback)
      setFeedback('')
      setShowFeedback(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          入力に戻る
        </button>
        <span className="text-sm text-[var(--color-text-muted)]">
          プラットフォーム: {formData?.platformDetails?.name}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ASCII Art Display */}
        <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
          <h2 className="text-xl font-semibold mb-4">ASCIIレイアウトデザイン</h2>
          <div className="ascii-display overflow-auto max-h-[500px]">
            {result?.ascii || 'ASCIIが生成されていません'}
          </div>

          {/* Hidden canvas for PNG conversion */}
          <canvas ref={canvasRef} className="hidden" />

          {asciiImageUrl && (
            <div className="mt-4">
              <p className="text-sm text-[var(--color-text-muted)] mb-2">プレビュー画像（画像生成AIに送信されます）:</p>
              <img
                src={asciiImageUrl}
                alt="ASCII Preview"
                className="border border-[var(--color-border)] rounded-lg max-w-full"
              />
            </div>
          )}
        </div>

        {/* Design Notes */}
        <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
          <h2 className="text-xl font-semibold mb-4">デザイン戦略</h2>

          {result?.designNotes && (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="space-y-4 text-[var(--color-text-muted)]">
                {result.designNotes.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}

          {result?.copyText && (
            <div className="mt-6 p-4 bg-[var(--color-background)] rounded-lg">
              <h3 className="text-sm font-semibold text-[var(--color-secondary)] mb-2">
                コピー案
              </h3>
              <div className="space-y-2">
                {result.copyText.map((text, i) => (
                  <p key={i} className="text-sm">"{text}"</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Section */}
      {showFeedback && (
        <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
          <h3 className="font-semibold mb-3">修正リクエスト</h3>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="変更したい内容を記入してください（例：「テキストを上に移動」「商品画像を大きく」「余白を増やして」など）..."
            rows={4}
            className="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition resize-none"
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleRequestChanges}
              disabled={isLoading || !feedback.trim()}
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
                '変更を適用'
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
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => setShowFeedback(true)}
          disabled={isLoading}
          className="flex-1 py-4 px-6 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl font-semibold transition flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          修正をリクエスト
        </button>
        <button
          onClick={handleApprove}
          disabled={isLoading}
          className="flex-1 py-4 px-6 bg-[var(--color-secondary)] hover:opacity-90 disabled:opacity-50 rounded-xl font-semibold transition flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              処理中...
            </>
          ) : (
            <>
              承認して次へ
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
