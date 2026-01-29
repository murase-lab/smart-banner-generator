import { useState, useCallback } from 'react'
import InputForm from './components/InputForm'
import AsciiPreview from './components/AsciiPreview'
import ImagePromptPreview from './components/ImagePromptPreview'
import BannerPreview from './components/BannerPreview'
import ModelSelector from './components/ModelSelector'
import StepIndicator from './components/StepIndicator'
import ProjectSidebar from './components/ProjectSidebar'
import { getDeviceId } from './utils/deviceId'

const STEPS = [
  { id: 1, name: '入力', description: '商品情報を入力' },
  { id: 2, name: 'レイアウト', description: 'デザイン確認' },
  { id: 3, name: 'プロンプト', description: '生成指示を確認' },
  { id: 4, name: '生成', description: 'バナー生成' },
]

const DEFAULT_MODELS = {
  text: 'gemini-2.5-flash', // Latest and fastest
  image: 'gemini-3-pro-image-preview', // Nano Banana Pro (manual retry on failure)
  resolution: '1K', // Default to 1K for faster generation
}

function App() {
  const [currentStep, setCurrentStep] = useState(1)
  const [models, setModels] = useState(DEFAULT_MODELS)
  const [formData, setFormData] = useState(null)
  const [asciiResult, setAsciiResult] = useState(null)
  const [asciiImage, setAsciiImage] = useState(null) // ASCII art as base64 image
  const [imagePrompt, setImagePrompt] = useState(null)
  const [generatedBanner, setGeneratedBanner] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [canRetryBanner, setCanRetryBanner] = useState(false) // Flag to show retry button

  // Project management state
  const [currentProjectId, setCurrentProjectId] = useState(null)
  const [currentProjectName, setCurrentProjectName] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [projectFormData, setProjectFormData] = useState(null) // Data loaded from project
  const [sidebarKey, setSidebarKey] = useState(0) // Key to force sidebar refresh

  // Handle project selection from sidebar
  const handleSelectProject = useCallback(async (projectId) => {
    try {
      const deviceId = getDeviceId()
      const response = await fetch(
        `/api/projects/${projectId}?deviceId=${encodeURIComponent(deviceId)}`
      )
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const project = data.project

      // Set the project data for the form
      setProjectFormData({
        productName: project.productName || '',
        productDescription: project.productDescription || '',
        targetAudience: project.targetAudience || '',
        designGoal: project.designGoal || '商品販売',
        vibe: project.vibe || '',
        additionalNotes: project.additionalNotes || '',
        brandLogoName: project.brandLogoName || null,
        productImages: project.productImages || [],
      })

      setCurrentProjectId(projectId)
      setCurrentProjectName(project.name)

      // Reset to step 1 to show the form with loaded data
      setCurrentStep(1)
      setAsciiResult(null)
      setAsciiImage(null)
      setImagePrompt(null)
      setGeneratedBanner(null)
      setError(null)
    } catch (err) {
      console.error('Failed to load project:', err)
      alert('プロジェクトの読み込みに失敗しました')
    }
  }, [])

  // Handle new project
  const handleNewProject = useCallback(() => {
    setCurrentProjectId(null)
    setCurrentProjectName('')
    setProjectFormData(null)
    setCurrentStep(1)
    setFormData(null)
    setAsciiResult(null)
    setAsciiImage(null)
    setImagePrompt(null)
    setGeneratedBanner(null)
    setError(null)
  }, [])

  // Handle save project
  const handleSaveProject = useCallback(async (data, name) => {
    try {
      const deviceId = getDeviceId()
      const projectData = {
        name: name || data.productName || '無題のプロジェクト',
        productName: data.productName || '',
        productDescription: data.productDescription || '',
        targetAudience: data.targetAudience || '',
        designGoal: data.designGoal || '商品販売',
        vibe: data.vibe || '',
        additionalNotes: data.additionalNotes || '',
        brandLogoName: data.brandLogo?.name || null,
        productImages: data.productImages || [],
      }

      let response
      if (currentProjectId) {
        // Update existing project
        response = await fetch(`/api/projects/${currentProjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, project: projectData }),
        })
      } else {
        // Create new project
        response = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, project: projectData }),
        })
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      // Update current project state
      setCurrentProjectId(result.project.id)
      setCurrentProjectName(result.project.name)

      // Refresh sidebar
      setSidebarKey(prev => prev + 1)

      return { success: true, project: result.project }
    } catch (err) {
      console.error('Failed to save project:', err)
      return { success: false, error: err.message }
    }
  }, [currentProjectId])

  const handleFormSubmit = async (data) => {
    setFormData(data)
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/generate-ascii', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, model: models.text }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate ASCII layout')
      }

      const result = await response.json()
      setAsciiResult(result)
      setCurrentStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAsciiApprove = async (feedback, asciiImageBase64) => {
    // Store the ASCII image if provided
    if (asciiImageBase64) {
      setAsciiImage(asciiImageBase64)
    }

    if (feedback) {
      // Feedback loop - regenerate with modifications
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/refine-ascii', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formData,
            previousAscii: asciiResult,
            feedback,
            model: models.text,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to refine ASCII layout')
        }

        const result = await response.json()
        setAsciiResult(result)
      } catch (err) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
      return
    }

    // Generate image prompt
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/generate-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData,
          asciiResult,
          model: models.text,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate image prompt')
      }

      const result = await response.json()
      setImagePrompt(result)
      setCurrentStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePromptApprove = async (feedback) => {
    if (feedback) {
      // Refine the prompt
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/refine-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formData,
            asciiResult,
            previousPrompt: imagePrompt,
            feedback,
            model: models.text,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to refine prompt')
        }

        const result = await response.json()
        setImagePrompt(result)
      } catch (err) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
      return
    }

    // Generate final banner
    await generateBanner()
  }

  // Separate function for banner generation (allows retry)
  const generateBanner = async () => {
    setIsLoading(true)
    setError(null)
    setCanRetryBanner(false)

    // Timeout of 120 seconds for single attempt
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

    try {
      const response = await fetch('/api/generate-banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData,
          asciiResult,
          asciiImage,
          imagePrompt,
          model: models.image,
          resolution: models.resolution,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate banner')
      }

      const result = await response.json()
      setGeneratedBanner(result)
      setCurrentStep(4)
      setCanRetryBanner(false)
    } catch (err) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        setError('タイムアウトしました。リトライボタンで再試行してください。')
      } else {
        setError(err.message)
      }
      setCanRetryBanner(true) // Enable retry button
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerateBanner = async (feedback) => {
    setIsLoading(true)
    setError(null)
    setCanRetryBanner(false)

    // Timeout of 120 seconds for single attempt
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

    try {
      const response = await fetch('/api/generate-banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData,
          asciiResult,
          asciiImage,
          imagePrompt,
          feedback,
          model: models.image,
          resolution: models.resolution,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to regenerate banner')
      }

      const result = await response.json()
      setGeneratedBanner(result)
      setCanRetryBanner(false)
    } catch (err) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        setError('タイムアウトしました。リトライボタンで再試行してください。')
      } else {
        setError(err.message)
      }
      setCanRetryBanner(true) // Enable retry button
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setCurrentStep(1)
    setFormData(null)
    setAsciiResult(null)
    setAsciiImage(null)
    setImagePrompt(null)
    setGeneratedBanner(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex">
      {/* Sidebar */}
      <ProjectSidebar
        key={sidebarKey}
        onSelectProject={handleSelectProject}
        onNewProject={handleNewProject}
        currentProjectId={currentProjectId}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-[var(--color-text)]">
                  Smart Banner Generator
                </h1>
                {currentProjectName && (
                  <span className="px-2 py-1 text-sm bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded">
                    {currentProjectName}
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">
                AIによるSNS広告バナー自動生成
              </p>
            </div>
            <ModelSelector models={models} onChange={setModels} />
          </div>
        </header>

        {/* Step Indicator */}
        <div className="px-6 py-6">
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>

        {/* Main Content */}
        <main className="flex-1 px-6 pb-12 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
              <div className="flex items-center justify-between">
                <span>{error}</span>
                {canRetryBanner && !isLoading && (
                  <button
                    onClick={generateBanner}
                    className="ml-4 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg font-medium transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    リトライ
                  </button>
                )}
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <InputForm
              onSubmit={handleFormSubmit}
              isLoading={isLoading}
              initialData={projectFormData}
              onSaveProject={handleSaveProject}
              currentProjectId={currentProjectId}
              currentProjectName={currentProjectName}
            />
          )}

          {currentStep === 2 && asciiResult && (
            <AsciiPreview
              result={asciiResult}
              formData={formData}
              onApprove={handleAsciiApprove}
              onBack={() => setCurrentStep(1)}
              isLoading={isLoading}
            />
          )}

          {currentStep === 3 && imagePrompt && (
            <ImagePromptPreview
              prompt={imagePrompt}
              asciiResult={asciiResult}
              onApprove={handlePromptApprove}
              onBack={() => setCurrentStep(2)}
              isLoading={isLoading}
            />
          )}

          {currentStep === 4 && generatedBanner && (
            <BannerPreview
              banner={generatedBanner}
              formData={formData}
              onRegenerate={handleRegenerateBanner}
              onReset={handleReset}
              isLoading={isLoading}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
