import './GemWizardCTA.css';

export default function GemWizardCTA({ step, onBack, onNext, canAdvance, onSubmit, isSubmitting }) {
  const isLastStep = step === 5;

  return (
    <div className="wizard-cta">
      <button
        type="button"
        className="wizard-cta-back"
        onClick={onBack}
        disabled={step <= 1}
      >
        ← Back
      </button>

      <div className="wizard-cta-step-indicator">
        {step} / 5
      </div>

      {isLastStep ? (
        <button
          type="button"
          className="wizard-cta-next danger"
          onClick={onSubmit}
          disabled={!canAdvance || isSubmitting}
        >
          {isSubmitting ? '⏳ Dropping...' : 'Drop Gem 💎'}
        </button>
      ) : (
        <button
          type="button"
          className="wizard-cta-next"
          onClick={onNext}
          disabled={!canAdvance}
        >
          Next →
        </button>
      )}
    </div>
  );
}
