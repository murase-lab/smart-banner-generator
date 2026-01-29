import { useState, useRef, useEffect } from 'react'
import { getSavedLogos, processAndSaveLogo, deleteLogo } from '../utils/brandAssets'

const PLATFORMS = [
  // Instagram - 最新仕様 (2024-2026)
  { id: 'instagram_feed', name: 'Instagram フィード', ratio: '4:5', size: '1080x1350', description: 'じっくり読ませる・比較させる' },
  { id: 'instagram_reels', name: 'Instagram リール / ストーリーズ', ratio: '9:16', size: '1080x1920', description: '完全フルスクリーン必須' },
  { id: 'instagram_carousel', name: 'Instagram カルーセル', ratio: '1:1', size: '1080x1080', description: '複数枚スワイプ形式' },
  // Other platforms
  { id: 'tiktok', name: 'TikTok', ratio: '9:16', size: '1080x1920', description: '縦型フルスクリーン' },
  { id: 'x_post', name: 'X (Twitter) 投稿', ratio: '1.91:1', size: '1200x628', description: 'タイムライン表示最適化' },
  { id: 'rakuten', name: '楽天市場 商品画像', ratio: '1:1', size: '1080x1080', description: '商品一覧・詳細ページ' },
  { id: 'lp_header', name: 'LP ヘッダー', ratio: '16:9', size: '1920x1080', description: 'ランディングページ用' },
]

const DESIGN_GOALS = [
  '認知度向上',
  '商品販売',
  'クリック率向上',
  '高級感・プレミアム感',
  'セール・プロモーション',
  '信頼性・安心感',
  'その他',
]

const MAX_PRODUCT_IMAGES = 10

export default function InputForm({
  onSubmit,
  isLoading,
  initialData,
  onSaveProject,
  currentProjectId,
  currentProjectName
}) {
  const [formData, setFormData] = useState({
    platform: 'instagram_feed',
    productName: '',
    productDescription: '',
    targetAudience: '',
    designGoal: '商品販売',
    vibe: '',
    additionalNotes: '',
  })

  const [productImages, setProductImages] = useState([]) // Array of { base64, mimeType, fileName, preview }
  const [copyMode, setCopyMode] = useState('ai') // 'ai' or 'manual'
  const [manualCopy, setManualCopy] = useState({
    headline: '',
    subtext: '',
    cta: '',
  })
  const [savedLogos, setSavedLogos] = useState([])
  const [selectedLogo, setSelectedLogo] = useState(null)
  const [newLogoName, setNewLogoName] = useState('')
  const [showLogoManager, setShowLogoManager] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveProjectName, setSaveProjectName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef(null)
  const logoInputRef = useRef(null)

  // Load saved logos on mount
  useEffect(() => {
    setSavedLogos(getSavedLogos())
  }, [])

  // Load initial data when project is selected
  useEffect(() => {
    if (initialData) {
      setFormData({
        platform: 'instagram_feed', // Platform is not saved in project
        productName: initialData.productName || '',
        productDescription: initialData.productDescription || '',
        targetAudience: initialData.targetAudience || '',
        designGoal: initialData.designGoal || '商品販売',
        vibe: initialData.vibe || '',
        additionalNotes: initialData.additionalNotes || '',
      })

      // Load product images with preview URLs
      if (initialData.productImages && initialData.productImages.length > 0) {
        const imagesWithPreview = initialData.productImages.map((img, index) => ({
          ...img,
          id: img.id || Date.now() + index,
          preview: img.preview || `data:${img.mimeType};base64,${img.base64}`,
        }))
        setProductImages(imagesWithPreview)
      } else {
        setProductImages([])
      }

      // Load brand logo if specified
      if (initialData.brandLogoName) {
        const logos = getSavedLogos()
        const logo = logos.find(l => l.name === initialData.brandLogoName)
        if (logo) {
          setSelectedLogo(logo)
        }
      } else {
        setSelectedLogo(null)
      }
    }
  }, [initialData])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Check if adding these files would exceed the limit
    if (productImages.length + files.length > MAX_PRODUCT_IMAGES) {
      alert(`商品画像は最大${MAX_PRODUCT_IMAGES}枚までアップロードできます`)
      return
    }

    files.forEach((file) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} は画像ファイルではありません`)
        return
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} のファイルサイズは10MB以下にしてください`)
        return
      }

      // Read file as base64
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64Full = event.target.result
        const newImage = {
          id: Date.now() + Math.random(), // Unique ID for key
          base64: base64Full.split(',')[1], // Remove data:image/...;base64, prefix
          mimeType: file.type,
          fileName: file.name,
          preview: base64Full,
        }
        setProductImages((prev) => [...prev, newImage])
      }
      reader.readAsDataURL(file)
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveImage = (imageId) => {
    setProductImages((prev) => prev.filter((img) => img.id !== imageId))
  }

  const handleManualCopyChange = (e) => {
    const { name, value } = e.target
    setManualCopy((prev) => ({ ...prev, [name]: value }))
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const name = newLogoName.trim() || file.name.replace(/\.[^/.]+$/, '')
    try {
      const logo = await processAndSaveLogo(file, name)
      setSavedLogos(getSavedLogos())
      setSelectedLogo(logo)
      setNewLogoName('')
      setShowLogoManager(false)
    } catch (error) {
      alert('ロゴの保存に失敗しました: ' + error.message)
    }
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  const handleDeleteLogo = (name) => {
    if (confirm(`「${name}」を削除しますか？`)) {
      deleteLogo(name)
      setSavedLogos(getSavedLogos())
      if (selectedLogo?.name === name) {
        setSelectedLogo(null)
      }
    }
  }

  // Get current form data for saving
  const getCurrentFormData = () => ({
    ...formData,
    productImages: productImages,
    brandLogo: selectedLogo,
    copyMode: copyMode,
    manualCopy: copyMode === 'manual' ? manualCopy : null,
  })

  // Handle save project
  const handleSaveProject = async () => {
    if (!onSaveProject) return

    const name = saveProjectName.trim() || formData.productName || '無題のプロジェクト'
    setIsSaving(true)

    try {
      const result = await onSaveProject(getCurrentFormData(), name)
      if (result.success) {
        setShowSaveDialog(false)
        setSaveProjectName('')
        alert('プロジェクトを保存しました')
      } else {
        alert('保存に失敗しました: ' + result.error)
      }
    } catch (err) {
      alert('保存に失敗しました: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle quick save (update existing project)
  const handleQuickSave = async () => {
    if (!onSaveProject || !currentProjectId) return

    setIsSaving(true)
    try {
      const result = await onSaveProject(getCurrentFormData(), currentProjectName)
      if (result.success) {
        alert('プロジェクトを更新しました')
      } else {
        alert('更新に失敗しました: ' + result.error)
      }
    } catch (err) {
      alert('更新に失敗しました: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const selectedPlatform = PLATFORMS.find((p) => p.id === formData.platform)
    onSubmit({
      ...formData,
      platformDetails: selectedPlatform,
      productImages: productImages.length > 0 ? productImages : null,
      // For backwards compatibility, also provide single productImage if available
      productImage: productImages.length > 0 ? productImages[0] : null,
      imageApproach: productImages.length > 0 ? 'reference' : null,
      copyMode: copyMode,
      manualCopy: copyMode === 'manual' ? manualCopy : null,
      brandLogo: selectedLogo,
    })
  }

  const selectedPlatform = PLATFORMS.find((p) => p.id === formData.platform)

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Project Save Bar */}
      {onSaveProject && (
        <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {currentProjectId ? (
              <span className="text-sm">
                プロジェクト: <strong>{currentProjectName}</strong>
              </span>
            ) : (
              <span className="text-sm text-[var(--color-text-muted)]">
                新規プロジェクト（未保存）
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentProjectId && (
              <button
                type="button"
                onClick={handleQuickSave}
                disabled={isSaving}
                className="px-4 py-2 bg-[var(--color-surface-hover)] hover:bg-[var(--color-border)] rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                {isSaving ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                )}
                上書き保存
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSaveProjectName(currentProjectName || formData.productName || '')
                setShowSaveDialog(true)
              }}
              disabled={isSaving}
              className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg text-sm font-medium transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {currentProjectId ? '名前を付けて保存' : '保存'}
            </button>
          </div>
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md border border-[var(--color-border)]">
            <h3 className="text-lg font-semibold mb-4">プロジェクトを保存</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">プロジェクト名</label>
                <input
                  type="text"
                  value={saveProjectName}
                  onChange={(e) => setSaveProjectName(e.target.value)}
                  placeholder="例：春の新商品キャンペーン"
                  className="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 bg-[var(--color-surface-hover)] hover:bg-[var(--color-border)] rounded-lg font-medium transition"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleSaveProject}
                  disabled={isSaving}
                  className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg font-medium transition flex items-center gap-2"
                >
                  {isSaving && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
        <h2 className="text-xl font-semibold mb-6">ターゲットプラットフォーム</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLATFORMS.map((platform) => (
            <label
              key={platform.id}
              className={`
                relative flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all
                ${formData.platform === platform.id
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                  : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                }
              `}
            >
              <input
                type="radio"
                name="platform"
                value={platform.id}
                checked={formData.platform === platform.id}
                onChange={handleChange}
                className="sr-only"
              />
              <span className="font-medium text-sm">{platform.name}</span>
              <span className="text-xs text-[var(--color-text-muted)] mt-1">
                {platform.ratio} ({platform.size})
              </span>
              <span className="text-xs text-[var(--color-text-muted)] mt-0.5 opacity-75">
                {platform.description}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Product Image Upload */}
      <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
        <h2 className="text-xl font-semibold mb-2">商品画像（任意・参照生成推奨）</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          商品画像をアップロードすると、より正確なバナーを生成できます（最大{MAX_PRODUCT_IMAGES}枚）
        </p>

        {/* Recommendation Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-300 mb-1">推奨：白背景の商品画像</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                白背景で撮影した商品画像を、異なる角度から複数枚アップロードすると、
                AIがより正確に商品を認識し、一貫性のあるバナーを生成できます。
              </p>
            </div>
          </div>
        </div>

        {/* Image Upload Area */}
        <div
          onClick={() => productImages.length < MAX_PRODUCT_IMAGES && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            productImages.length >= MAX_PRODUCT_IMAGES
              ? 'border-[var(--color-border)] opacity-50 cursor-not-allowed'
              : 'border-[var(--color-border)] cursor-pointer hover:border-[var(--color-primary)]'
          }`}
        >
          <svg className="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-[var(--color-text-muted)] mb-2">
            {productImages.length >= MAX_PRODUCT_IMAGES
              ? `最大${MAX_PRODUCT_IMAGES}枚に達しました`
              : 'クリックして画像をアップロード（複数選択可）'
            }
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">PNG, JPG, WEBP（各最大10MB）</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {/* Image Previews */}
        {productImages.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              アップロード済み: {productImages.length}/{MAX_PRODUCT_IMAGES}枚
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {productImages.map((image) => (
                <div key={image.id} className="relative group">
                  <img
                    src={image.preview}
                    alt={image.fileName}
                    className="w-full aspect-square object-cover rounded-lg border border-[var(--color-border)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(image.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-sm transition opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate" title={image.fileName}>
                    {image.fileName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
        <h2 className="text-xl font-semibold mb-6">商品情報</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              商品名・サービス名 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="productName"
              value={formData.productName}
              onChange={handleChange}
              required
              placeholder="例：プレミアム美容クリーム"
              className="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              商品説明・特徴 <span className="text-red-400">*</span>
            </label>
            <textarea
              name="productDescription"
              value={formData.productDescription}
              onChange={handleChange}
              required
              rows={4}
              placeholder="商品の特徴、メリット、独自のセールスポイントなどを記入してください..."
              className="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              ターゲット層
            </label>
            <input
              type="text"
              name="targetAudience"
              value={formData.targetAudience}
              onChange={handleChange}
              placeholder="例：25〜40代女性、スキンケアに関心のある方"
              className="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* Copy Text Mode */}
      <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
        <h2 className="text-xl font-semibold mb-2">コピーテキスト</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          バナーに表示するテキストの入力方法を選択
        </p>

        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={() => setCopyMode('ai')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
              copyMode === 'ai'
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI自動生成
            </span>
          </button>
          <button
            type="button"
            onClick={() => setCopyMode('manual')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
              copyMode === 'manual'
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              手動入力
            </span>
          </button>
        </div>

        {copyMode === 'ai' ? (
          <p className="text-sm text-[var(--color-text-muted)] bg-[var(--color-background)] p-4 rounded-lg">
            商品情報を元に、AIがコンバージョン率の高いコピーを自動生成します。
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                ヘッドライン（キャッチコピー）
              </label>
              <input
                type="text"
                name="headline"
                value={manualCopy.headline}
                onChange={handleManualCopyChange}
                placeholder="例：今だけ50%OFF"
                className="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                サブテキスト（補足説明）
              </label>
              <input
                type="text"
                name="subtext"
                value={manualCopy.subtext}
                onChange={handleManualCopyChange}
                placeholder="例：期間限定キャンペーン実施中"
                className="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                CTAボタンテキスト
              </label>
              <input
                type="text"
                name="cta"
                value={manualCopy.cta}
                onChange={handleManualCopyChange}
                placeholder="例：今すぐ購入"
                className="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition"
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
        <h2 className="text-xl font-semibold mb-6">デザイン設定</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              デザインの目的 <span className="text-red-400">*</span>
            </label>
            <select
              name="designGoal"
              value={formData.designGoal}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition"
            >
              {DESIGN_GOALS.map((goal) => (
                <option key={goal} value={goal}>{goal}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              ブランドの雰囲気・トンマナ
            </label>
            <input
              type="text"
              name="vibe"
              value={formData.vibe}
              onChange={handleChange}
              placeholder="例：モダン、ミニマル、高級感、または参考URLなど"
              className="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              その他の要望
            </label>
            <textarea
              name="additionalNotes"
              value={formData.additionalNotes}
              onChange={handleChange}
              rows={3}
              placeholder="使用したい色、避けたい色、コピー案など、その他のご要望があれば記入してください"
              className="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition resize-none"
            />
          </div>
        </div>
      </div>

      {/* Brand Logo */}
      <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">ブランドロゴ（任意）</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              ロゴを登録すると、バナー生成時に参照画像として使用されます
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLogoManager(!showLogoManager)}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            {showLogoManager ? '閉じる' : '管理'}
          </button>
        </div>

        {/* Selected Logo Display */}
        {selectedLogo && (
          <div className="flex items-center gap-3 p-3 bg-[var(--color-background)] rounded-lg mb-4">
            <img
              src={selectedLogo.dataUrl}
              alt={selectedLogo.name}
              className="w-12 h-12 object-contain rounded border border-[var(--color-border)]"
            />
            <div className="flex-1">
              <p className="font-medium text-sm">{selectedLogo.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">選択中（生成時に参照されます）</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedLogo(null)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              解除
            </button>
          </div>
        )}

        {/* Saved Logos List */}
        {savedLogos.length > 0 && !showLogoManager && !selectedLogo && (
          <div className="flex flex-wrap gap-2">
            {savedLogos.map((logo) => (
              <button
                key={logo.name}
                type="button"
                onClick={() => setSelectedLogo(logo)}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] transition"
              >
                <img
                  src={logo.dataUrl}
                  alt={logo.name}
                  className="w-6 h-6 object-contain"
                />
                <span className="text-sm">{logo.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Logo Manager */}
        {showLogoManager && (
          <div className="space-y-4">
            {/* Upload New Logo */}
            <div className="p-4 bg-[var(--color-background)] rounded-lg">
              <label className="block text-sm font-medium mb-2">新しいロゴを追加</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLogoName}
                  onChange={(e) => setNewLogoName(e.target.value)}
                  placeholder="ロゴ名（任意）"
                  className="flex-1 px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg text-sm font-medium transition"
                >
                  アップロード
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Saved Logos Management */}
            {savedLogos.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">保存済みロゴ</label>
                {savedLogos.map((logo) => (
                  <div
                    key={logo.name}
                    className="flex items-center gap-3 p-3 bg-[var(--color-background)] rounded-lg"
                  >
                    <img
                      src={logo.dataUrl}
                      alt={logo.name}
                      className="w-10 h-10 object-contain rounded border border-[var(--color-border)]"
                    />
                    <span className="flex-1 text-sm">{logo.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedLogo(logo)}
                      className="px-3 py-1 text-xs bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded hover:bg-[var(--color-primary)]/30 transition"
                    >
                      選択
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLogo(logo.name)}
                      className="px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}

            {savedLogos.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
                保存されたロゴはありません
              </p>
            )}
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
        <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">
          出力プレビュー
        </h3>
        <div className="flex items-center gap-4">
          <div
            className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg flex items-center justify-center text-[var(--color-text-muted)] text-xs"
            style={{
              width: selectedPlatform?.ratio === '9:16' ? '80px' : selectedPlatform?.ratio === '1.91:1' ? '160px' : selectedPlatform?.ratio === '4:5' ? '100px' : '120px',
              height: selectedPlatform?.ratio === '9:16' ? '142px' : selectedPlatform?.ratio === '1.91:1' ? '84px' : selectedPlatform?.ratio === '4:5' ? '125px' : '120px',
            }}
          >
            {selectedPlatform?.ratio}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            <p><strong>{selectedPlatform?.name}</strong></p>
            <p>サイズ: {selectedPlatform?.size}</p>
            <p className="text-xs opacity-75 mt-1">{selectedPlatform?.description}</p>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !formData.productName || !formData.productDescription}
        className="w-full py-4 px-6 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-lg transition flex items-center justify-center gap-3"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            レイアウト生成中...
          </>
        ) : (
          <>
            デザインレイアウトを生成
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </>
        )}
      </button>
    </form>
  )
}
