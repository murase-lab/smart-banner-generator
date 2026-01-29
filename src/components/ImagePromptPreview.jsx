import { useState } from 'react'

export default function ImagePromptPreview({ prompt, asciiResult, onApprove, onBack, isLoading }) {
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)

  const handleApprove = () => {
    onApprove(null)
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
          レイアウトに戻る
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Image Generation Prompt */}
        <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
          <h2 className="text-xl font-semibold mb-4">画像生成プロンプト</h2>

          <div className="space-y-4">
            {prompt?.concept && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-primary)] mb-2">
                  全体コンセプト
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">{prompt.concept}</p>
              </div>
            )}

            {prompt?.atmosphere && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-primary)] mb-2">
                  雰囲気・ムード
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">{prompt.atmosphere}</p>
              </div>
            )}

            {prompt?.materials && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-primary)] mb-2">
                  素材・カラー
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">{prompt.materials}</p>
              </div>
            )}

            {prompt?.elements && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-primary)] mb-2">
                  視覚要素
                </h3>
                <ul className="text-sm text-[var(--color-text-muted)] list-disc list-inside space-y-1">
                  {prompt.elements.map((el, i) => (
                    <li key={i}>{el}</li>
                  ))}
                </ul>
              </div>
            )}

            {prompt?.textRendering && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-primary)] mb-2">
                  テキストレンダリング
                </h3>
                <div className="space-y-1">
                  {prompt.textRendering.map((text, i) => (
                    <p key={i} className="text-sm text-[var(--color-text-muted)] font-mono">
                      "{text}"
                    </p>
                  ))}
                </div>
              </div>
            )}

            {prompt?.technicalSpecs && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-primary)] mb-2">
                  技術仕様
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">{prompt.technicalSpecs}</p>
              </div>
            )}
          </div>
        </div>

        {/* Full Prompt Text */}
        <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
          <h2 className="text-xl font-semibold mb-4">完全なプロンプト（英語）</h2>

          <div className="bg-[var(--color-background)] rounded-lg p-4 max-h-[500px] overflow-auto">
            <pre className="text-sm text-[var(--color-text-muted)] whitespace-pre-wrap font-mono">
              {prompt?.fullPrompt || 'プロンプトが生成されていません'}
            </pre>
          </div>

          <button
            onClick={() => navigator.clipboard.writeText(prompt?.fullPrompt || '')}
            className="mt-4 px-4 py-2 text-sm bg-[var(--color-surface-hover)] hover:bg-[var(--color-border)] rounded-lg transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            プロンプトをコピー
          </button>
        </div>
      </div>

      {/* Feedback Section */}
      {showFeedback && (
        <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
          <h3 className="font-semibold mb-3">プロンプト修正リクエスト</h3>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="変更したい内容を記入してください（例：「色をもっと鮮やかに」「商品をもっと強調して」「照明を温かい雰囲気に」など）..."
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
          プロンプトを修正
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
              バナー生成中...
            </>
          ) : (
            <>
              バナーを生成
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
