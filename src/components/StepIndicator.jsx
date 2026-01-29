export default function StepIndicator({ steps, currentStep }) {
  return (
    <div className="flex items-center justify-center">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className="flex items-center">
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition
                ${currentStep >= step.id
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
                }
              `}
            >
              {currentStep > step.id ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.id
              )}
            </div>
            <div className="ml-3 hidden sm:block">
              <p className={`text-sm font-medium ${currentStep >= step.id ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>
                {step.name}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {step.description}
              </p>
            </div>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-12 sm:w-24 h-1 mx-4 rounded ${
                currentStep > step.id
                  ? 'bg-[var(--color-primary)]'
                  : 'bg-[var(--color-border)]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
