import { VIBE_PRESETS, VIBE_EMOJI_MAP, VIBE_LABELS } from '../../lib/gemWizardData';
import './StepRate.css';

const DIMENSIONS = ['cozy', 'insta_worthy', 'lively', 'zen', 'workspace'];
const DIM_LABELS = {
  cozy: 'Cozy ☕',
  insta_worthy: 'Insta-Worthy 📸',
  lively: 'Lively ⚡',
  zen: 'Zen 🍃',
  workspace: 'Workspace 💻',
};

export default function StepRate({ vibeRatings, setVibeRatings }) {
  const applyPreset = (preset) => {
    setVibeRatings({ ...preset.ratings });
  };

  const isPresetActive = (preset) => {
    return DIMENSIONS.every(k => vibeRatings[k] === preset.ratings[k]);
  };

  const setDimension = (dim, score) => {
    setVibeRatings(prev => ({ ...prev, [dim]: score }));
  };

  return (
    <div className="step-rate wizard-step">
      <div className="step-header">
        <h2>Rate the Vibe 🎭</h2>
        <p>How does this place feel?</p>
      </div>

      {/* Quick presets */}
      <div className="rate-presets">
        <span className="rate-section-label">Quick Presets</span>
        <div className="rate-preset-chips">
          {Object.entries(VIBE_PRESETS).map(([key, preset]) => {
            const active = isPresetActive(preset);
            return (
              <button
                key={key}
                type="button"
                className={`rate-preset-chip ${active ? 'active' : ''}`}
                onClick={() => applyPreset(preset)}
              >
                <span className="rate-preset-emoji">{preset.emoji}</span>
                <span className="rate-preset-label">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Per-dimension emoji sliders */}
      <div className="rate-dimensions">
        <span className="rate-section-label">Fine-Tune</span>
        {DIMENSIONS.map(dim => {
          const emojis = VIBE_EMOJI_MAP[dim] || ['1','2','3','4','5'];
          const currentScore = vibeRatings[dim] ?? 3; // 1-indexed

          return (
            <div key={dim} className="rate-dimension-row">
              <div className="rate-dim-header">
                <span className="rate-dim-name">{DIM_LABELS[dim]}</span>
                <span className="rate-dim-description">{VIBE_LABELS[dim][currentScore - 1]}</span>
              </div>
              <div className="rate-emoji-row">
                {emojis.map((emoji, idx) => {
                  const score = idx + 1;
                  const selected = currentScore === score;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`rate-emoji-btn ${selected ? 'selected' : ''}`}
                      onClick={() => setDimension(dim, score)}
                      title={VIBE_LABELS[dim][idx]}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
