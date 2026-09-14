import { useEffect, useState } from 'react';
import { categories } from '../../lib/categoryConfig';
import { getSuggestedDescription, AI_SUGGESTIONS_MAP } from '../../lib/gemWizardData';
import './StepName.css';

// Generate a suggested name from category + color profile
function generateNameSuggestion(category, colorProfile) {
  const suggestions = {
    cafe:        ['Secret Matcha Sanctuary', 'The Hidden Brew', 'Cozy Corner Cafe', 'Whispering Latte'],
    viewpoint:   ['Golden Hour Overlook', 'The Secret Vista', 'Horizon Spot', 'Sunset Perch'],
    'street-art':['The Mural Wall', 'Hidden Canvas Alley', 'Color Block Secret', 'The Art Portal'],
    event:       ['The Pop-Up Spot', 'Hidden Stage', 'Market Find', 'The Secret Gig'],
    trail:       ['Forest Path Find', 'The Hidden Trail', 'Secret Summit Route', 'Green Canopy Walk'],
    campsite:    ['Star Camp', 'The Hidden Pitch', 'Forest Floor Camp', 'Remote Bivouac'],
    waterfall:   ['Hidden Falls', 'The Secret Cascade', 'Mist Pool Find', 'The Blue Drop'],
    mountain:    ['Summit Secret', 'The Hidden Peak', 'Cloud Level Spot', 'Alpine Find'],
    beach:       ['Secret Shore', 'The Hidden Cove', 'Sunset Beach Find', 'The Quiet Bay'],
    lake:        ['Mirror Lake', 'The Hidden Glasswater', 'Reflection Pool', 'The Still Water'],
    forest:      ['The Canopy Secret', 'Hidden Grove', 'Ancient Tree Spot', 'The Moss Floor'],
    cave:        ['Underground Find', 'The Hidden Cavern', 'The Dark Portal', 'Stone Chamber Secret'],
  };

  const list = suggestions[category] || ['Hidden Gem', 'Secret Spot', 'The Find', 'Local Secret'];
  // Use brightness/dominant color to pick index if available
  const idx = colorProfile ? (colorProfile.brightness === 'dark' ? 1 : colorProfile.dominant === 'green' ? 2 : colorProfile.dominant === 'blue' ? 3 : 0) : 0;
  return list[idx % list.length];
}

export default function StepName({
  gemName, setGemName,
  category, setCategory,
  colorProfile,
  description, setDescription,
}) {
  const [suggestion, setSuggestion] = useState('');
  const [usedSuggestion, setUsedSuggestion] = useState(false);

  useEffect(() => {
    const s = generateNameSuggestion(category, colorProfile);
    setSuggestion(s);
    if (!gemName) setUsedSuggestion(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, colorProfile]);

  const applySuggestion = () => {
    setGemName(suggestion);
    setUsedSuggestion(true);
  };

  const handleCategorySelect = (catId) => {
    setCategory(catId);
    // Update description suggestion dynamically if no custom description written yet
    if (!description || description === getSuggestedDescription(category, colorProfile)) {
      const newDesc = getSuggestedDescription(catId, colorProfile);
      setDescription(newDesc);
    }
  };

  return (
    <div className="step-name wizard-step">
      <div className="step-header">
        <h2>Name Your Gem 🏷️</h2>
        <p>Give this place its identity.</p>
      </div>

      {/* AI name suggestion */}
      {suggestion && !usedSuggestion && (
        <div className="name-suggestion-card">
          <div className="name-suggestion-label">✨ AI Suggestion</div>
          <div className="name-suggestion-text">{suggestion}</div>
          <div className="name-suggestion-actions">
            <button type="button" className="name-action-btn primary" onClick={applySuggestion}>
              ✓ Use This
            </button>
            <button type="button" className="name-action-btn secondary" onClick={() => {
              setGemName(suggestion);
              setUsedSuggestion(true);
            }}>
              ✏️ Edit
            </button>
          </div>
        </div>
      )}

      {/* Manual input */}
      <div className="name-input-group">
        <label className="name-label">Or type your own name</label>
        <input
          type="text"
          className="name-input"
          placeholder="e.g. Secret Matcha Sanctuary"
          value={gemName}
          onChange={(e) => { setGemName(e.target.value); setUsedSuggestion(true); }}
          maxLength={80}
        />
        <span className="name-char-count">{gemName.length}/80</span>
      </div>

      {/* Category grid */}
      <div className="name-category-section">
        <label className="name-label">Category</label>
        <div className="name-cat-grid">
          {categories.map(cat => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`name-cat-chip ${active ? 'active' : ''}`}
                style={{
                  '--cat-color': cat.color,
                  borderColor: active ? cat.color : 'var(--color-border)',
                  backgroundColor: active ? `${cat.color}22` : 'var(--color-bg-secondary)',
                  color: active ? cat.color : 'var(--color-text-secondary)',
                }}
                onClick={() => handleCategorySelect(cat.id)}
              >
                <span className="name-cat-emoji">{cat.emoji}</span>
                <span className="name-cat-label">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
