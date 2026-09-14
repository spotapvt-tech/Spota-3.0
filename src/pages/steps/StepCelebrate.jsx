import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCategoryById } from '../../lib/categoryConfig';
import './StepCelebrate.css';

function animateCount(from, to, duration, setter) {
  const start = performance.now();
  const tick = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    setter(Math.round(from + (to - from) * eased));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export default function StepCelebrate({ gem, onShareCard, onDropAnother }) {
  const navigate = useNavigate();
  const [gemCount, setGemCount] = useState(0);
  const confettiRef = useRef(false);

  useEffect(() => {
    // Lazy load canvas-confetti and fire
    if (!confettiRef.current) {
      confettiRef.current = true;
      import('canvas-confetti').then((mod) => {
        const confetti = mod.default;
        const duration = 3000;
        const end = Date.now() + duration;
        const frame = () => {
          confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#6C8C74','#E07A5F','#DDA15E'] });
          confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#6C8C74','#E07A5F','#DDA15E'] });
          if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
      }).catch(() => {}); // confetti is decorative; fail silently
    }
  }, []);

  // Animate gem counter
  useEffect(() => {
    const targetCount = Math.floor(Math.random() * 180) + 50; // mock area count
    animateCount(0, targetCount, 1400, setGemCount);
  }, []);

  const catInfo = gem ? getCategoryById(gem.category) : { emoji: '💎', label: 'Gem', color: '#6C8C74' };

  return (
    <div className="step-celebrate">
      <div className="celebrate-gem-icon">💎</div>

      <h2 className="celebrate-title">Gem Dropped!</h2>
      <p className="celebrate-subtitle">
        <strong>{gem?.title || 'Your Gem'}</strong> is now live on the map.
      </p>

      {/* Category badge */}
      <div className="celebrate-cat-badge" style={{ backgroundColor: `${catInfo.color}22`, color: catInfo.color, borderColor: `${catInfo.color}44` }}>
        {catInfo.emoji} {catInfo.label}
      </div>

      {/* Gem counter */}
      <div className="celebrate-counter-card">
        <span className="celebrate-counter-num">{gemCount}</span>
        <span className="celebrate-counter-label">gems spotted in this area</span>
      </div>

      {/* Reputation */}
      <div className="celebrate-rep-banner">
        ✨ +25 Reputation Points earned!
      </div>

      {/* Actions */}
      <div className="celebrate-actions">
        <button type="button" className="celebrate-btn primary" onClick={onShareCard}>
          📲 Download Share Card
        </button>
        <button type="button" className="celebrate-btn secondary" onClick={() => navigate('/')}>
          🗺️ See on Map
        </button>
        <button type="button" className="celebrate-btn ghost" onClick={onDropAnother}>
          ↺ Drop Another Gem
        </button>
      </div>
    </div>
  );
}
