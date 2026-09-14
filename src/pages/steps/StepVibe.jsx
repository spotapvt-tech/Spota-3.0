import { useState, useEffect, useRef } from 'react';
import { getSuggestedDescription, RECOMMENDED_TAGS_MAP } from '../../lib/gemWizardData';
import './StepVibe.css';

export default function StepVibe({ description, setDescription, selectedTags, setSelectedTags, category, colorProfile }) {
  const [aiText, setAiText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const timerRef = useRef(null);

  const suggestedDescription = getSuggestedDescription(category, colorProfile);
  const suggestedTags = RECOMMENDED_TAGS_MAP[category] || RECOMMENDED_TAGS_MAP.default;

  // Typewriter reveal on mount or category change
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setAiText('');
    setIsTyping(true);
    setAiUsed(false);
    let i = 0;
    timerRef.current = setInterval(() => {
      i++;
      setAiText(suggestedDescription.slice(0, i));
      if (i >= suggestedDescription.length) {
        clearInterval(timerRef.current);
        setIsTyping(false);
      }
    }, 22);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, colorProfile]);

  const applyAiText = () => {
    setDescription(aiText);
    setAiUsed(true);
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      if (prev.length >= 10) return prev;
      return [...prev, tag];
    });
  };

  const addCustomTag = () => {
    const clean = customTag.replace(/[^a-z0-9_]/gi, '').toLowerCase().trim();
    if (clean && !selectedTags.includes(clean) && selectedTags.length < 10) {
      setSelectedTags(prev => [...prev, clean]);
    }
    setCustomTag('');
  };

  return (
    <div className="step-vibe wizard-step">
      <div className="step-header">
        <h2>Write the Vibe ✍️</h2>
        <p>What makes this place special?</p>
      </div>

      {/* AI typewriter card */}
      <div className="vibe-ai-card">
        <div className="vibe-ai-header">
          <span className="vibe-ai-badge">✨ AI Vibe Check</span>
          {isTyping && <span className="vibe-ai-typing-dot" />}
        </div>
        <p className="vibe-ai-text">
          {aiText}
          {isTyping && <span className="vibe-cursor">|</span>}
        </p>
        {!isTyping && !aiUsed && (
          <div className="vibe-ai-actions">
            <button type="button" className="vibe-action-btn primary" onClick={applyAiText}>
              ✓ Use This
            </button>
            <button type="button" className="vibe-action-btn secondary" onClick={() => { setDescription(aiText); setAiUsed(true); }}>
              ✏️ Edit
            </button>
          </div>
        )}
      </div>

      {/* Manual textarea */}
      <div className="vibe-manual-section">
        <label className="vibe-label">Your Vibe Check</label>
        <textarea
          className="vibe-textarea"
          placeholder="What makes this place magical? Write a short, authentic review…"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={600}
        />
        <span className="vibe-char-count">{description.length}/600</span>
      </div>

      {/* Tag selection */}
      <div className="vibe-tags-section">
        <label className="vibe-label">Aesthetic Tags <span className="vibe-tag-count">({selectedTags.length}/10)</span></label>
        <div className="vibe-tag-chips">
          {suggestedTags.map(tag => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                className={`vibe-tag-chip ${active ? 'active' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                #{tag}
              </button>
            );
          })}
        </div>

        {/* Custom tag input */}
        <div className="vibe-custom-tag-row">
          <input
            type="text"
            className="vibe-custom-tag-input"
            placeholder="Add custom tag…"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
            maxLength={20}
          />
          <button type="button" className="vibe-custom-tag-add" onClick={addCustomTag}>
            + Add
          </button>
        </div>

        {/* Selected tags */}
        {selectedTags.length > 0 && (
          <div className="vibe-selected-tags">
            {selectedTags.map(tag => (
              <span key={tag} className="vibe-selected-pill">
                #{tag}
                <button type="button" onClick={() => toggleTag(tag)} className="vibe-remove-tag">×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
