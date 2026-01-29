import { useState } from 'react'

const TEXT_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '最新・高速・推奨' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '安定版' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '高品質' },
]

const IMAGE_MODELS = [
  { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro', description: '最高品質・4K対応・推奨', supports4K: true },
  { id: 'gemini-2.5-flash-image', name: 'Nano Banana', description: '高速・高品質', supports4K: false },
  { id: 'gemini-2.0-flash-exp-image-generation', name: 'Gemini 2.0 Flash Image', description: '旧モデル', supports4K: false },
]

const RESOLUTIONS = [
  { id: '1K', name: '1K', description: '標準解像度（約1024px）', all: true },
  { id: '2K', name: '2K', description: '高解像度（約2048px）', all: true },
  { id: '4K', name: '4K', description: '最高解像度（約4096px）', proOnly: true },
]

export default function ModelSelector({ models, onChange }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleTextModelChange = (modelId) => {
    onChange({ ...models, text: modelId })
  }

  const handleImageModelChange = (modelId) => {
    const selectedModel = IMAGE_MODELS.find(m => m.id === modelId)
    // If switching to a model that doesn't support 4K and current resolution is 4K, reset to 2K
    if (!selectedModel?.supports4K && models.resolution === '4K') {
      onChange({ ...models, image: modelId, resolution: '2K' })
    } else {
      onChange({ ...models, image: modelId })
    }
  }

  const handleResolutionChange = (resolutionId) => {
    onChange({ ...models, resolution: resolutionId })
  }

  const selectedImageModel = IMAGE_MODELS.find(m => m.id === models.image)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] transition text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="hidden sm:inline">モデル設定</span>
        <span className="text-xs text-[var(--color-text-muted)] hidden md:inline">
          ({selectedImageModel?.name || 'N/A'} / {models.resolution || '1K'})
        </span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-96 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl z-20 p-4 max-h-[80vh] overflow-y-auto">
            <h3 className="font-semibold mb-4">モデル設定</h3>

            <div className="space-y-4">
              {/* Text Model */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-2">
                  テキスト生成モデル（レイアウト・プロンプト生成）
                </label>
                <div className="space-y-2">
                  {TEXT_MODELS.map((model) => (
                    <label
                      key={model.id}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition
                        ${models.text === model.id
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                          : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="textModel"
                        value={model.id}
                        checked={models.text === model.id}
                        onChange={() => handleTextModelChange(model.id)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        models.text === model.id ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'
                      }`}>
                        {models.text === model.id && (
                          <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{model.name}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{model.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Image Model */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-2">
                  画像生成モデル（バナー生成）
                </label>
                <div className="space-y-2">
                  {IMAGE_MODELS.map((model) => (
                    <label
                      key={model.id}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition
                        ${models.image === model.id
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                          : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="imageModel"
                        value={model.id}
                        checked={models.image === model.id}
                        onChange={() => handleImageModelChange(model.id)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        models.image === model.id ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'
                      }`}>
                        {models.image === model.id && (
                          <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{model.name}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{model.description}</div>
                      </div>
                      {model.id.includes('gemini-3') && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">New</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Resolution */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-2">
                  出力解像度
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {RESOLUTIONS.map((res) => {
                    const isDisabled = res.proOnly && !selectedImageModel?.supports4K
                    return (
                      <label
                        key={res.id}
                        className={`
                          flex flex-col items-center p-3 rounded-lg border cursor-pointer transition text-center
                          ${models.resolution === res.id
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                            : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                          }
                          ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
                        `}
                      >
                        <input
                          type="radio"
                          name="resolution"
                          value={res.id}
                          checked={models.resolution === res.id}
                          onChange={() => !isDisabled && handleResolutionChange(res.id)}
                          disabled={isDisabled}
                          className="sr-only"
                        />
                        <span className="text-lg font-bold">{res.name}</span>
                        <span className="text-xs text-[var(--color-text-muted)] mt-1">{res.description}</span>
                        {res.proOnly && (
                          <span className="text-xs text-yellow-400 mt-1">Pro専用</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
