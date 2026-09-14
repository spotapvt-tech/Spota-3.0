import './GemWizardProgress.css';

const STEP_LABELS = ['Capture', 'Pin', 'Name', 'Rate', 'Vibe'];

export default function GemWizardProgress({ currentStep, totalSteps = 5 }) {
  return (
    <div className="wizard-progress-bar">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isDone = currentStep > stepNum;
        const isActive = currentStep === stepNum;
        return (
          <div key={i} className="wizard-progress-segment">
            <div className={`wizard-progress-dot ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`} />
            <span className={`wizard-progress-label ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
              {STEP_LABELS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
