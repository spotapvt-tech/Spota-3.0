# Spota — Gem Drop Wizard: Implementation Plan

**Feature:** 5-Step Gem Drop Wizard Redesign  
**Version:** 2.0  
**Date:** 2026-07-28  
**Status:** Ready for Development

---

## 1. Problem Statement

The current `AddGemView.jsx` presents all gem-dropping fields in a single long scrollable form. This creates three core UX failures:

1. **No progressive disclosure** — users see everything at once, creating cognitive overload before they've committed to dropping a gem.
2. **Weak photo experience** — the photo upload is buried mid-form, but it should be the emotional hook that opens the flow.
3. **Clinical vibe inputs** — 1–5 number sliders feel like a survey form, not a creative act of place discovery.

---

## 2. Proposed Solution: Gem Drift Wizard

Replace the single-form view with a **5-step wizard** that guides the user through a progressive, emotionally engaging flow:

| Step | Title | Core Action |
|------|-------|-------------|
| 1 | Capture the Vibe | Photo-first camera or gallery upload |
| 2 | Drop the Pin | Auto GPS detect + search + map tap |
| 3 | Name Your Gem | AI-suggested name + manual override + category |
| 4 | Rate the Vibe | Emoji-based presets + per-dimension emoji sliders |
| 5 | AI Vibe Write | AI typewriter description + tag selection |
| ✅ | Gem Dropped! | Full-screen confetti + gem counter + badge reveal |

---

## 3. Architecture Overview

### 3.1 New Component Tree

```
AddGemView.jsx  (orchestrator — holds all state, step routing)
├── GemWizardProgress.jsx     (step dots / progress bar)
├── steps/
│   ├── StepCapture.jsx       (Step 1: Photo + quick filter)
│   ├── StepPin.jsx           (Step 2: GPS banner + search + map)
│   ├── StepName.jsx          (Step 3: AI name + category)
│   ├── StepRate.jsx          (Step 4: Vibe presets + emoji sliders)
│   ├── StepVibe.jsx          (Step 5: AI typewriter + tags)
│   └── StepCelebrate.jsx     (Success: confetti + sharing)
├── GemWizardCTA.jsx          (Sticky bottom bar: Back + Next/Submit)
└── AddGemView.css            (updated styles)
```

### 3.2 Shared Wizard State (in AddGemView.jsx)

```js
const [wizardStep, setWizardStep] = useState(1);          // 1–6
const [photoFile, setPhotoFile] = useState(null);          // File object
const [photoPreview, setPhotoPreview] = useState(null);    // data URL
const [photoFilter, setPhotoFilter] = useState(null);      // 'warm'|'moody'|'bright'|'natural'
const [location, setLocation] = useState({
  lat: null,
  lng: null,
  placeName: '',
  address: '',
  source: null,           // 'gps' | 'search' | 'map'
});
const [gemName, setGemName] = useState('');
const [aiNameSuggestion, setAiNameSuggestion] = useState('');
const [category, setCategory] = useState(null);
const [vibePreset, setVibePreset] = useState(null);        // 'work'|'zen'|'social'|'insta'
const [vibeRatings, setVibeRatings] = useState({});        // { cozy: 2, lively: 3, zen: 3, insta: 4 }
const [description, setDescription] = useState('');
const [aiDescription, setAiDescription] = useState('');
const [selectedTags, setSelectedTags] = useState([]);
const [droppedGem, setDroppedGem] = useState(null);        // returned Supabase row
```

---

## 4. Step-by-Step Implementation

### Step 1 — StepCapture.jsx

**Purpose:** Make the photo the emotional entry point; open camera on mount on mobile.

**Key behaviours:**
- On mobile (Capacitor), auto-open device camera using `@capacitor/camera` on step entry.
- On web, show a large tap-target camera zone + "Upload from Gallery" secondary option.
- Quick vibe filter chips (Warm / Moody / Bright / Natural) apply a CSS `filter` overlay on the preview — stored as `photoFilter` string.
- Validation: step cannot advance without `photoFile`.

**Relevant existing code to reuse:** `analyzeImageColor()` in `AddGemView.jsx` — run on photo selection to pre-seed the vibe category suggestion.

**Files changed:**
- `src/pages/steps/StepCapture.jsx` — new file
- `src/pages/AddGemView.css` — add `.step-capture-*` classes

---

### Step 2 — StepPin.jsx

**Purpose:** Let the user confirm or correct their location with zero friction.

**Key behaviours:**

**A. Auto GPS on step entry**
```js
useEffect(() => {
  if (!location.lat) {
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const result = await reverseGeocode(lat, lng);  // Nominatim
        setLocation({ lat, lng, placeName: result.name, address: result.display_name, source: 'gps' });
        setGpsStatus('success');
      },
      () => setGpsStatus('denied'),
      { timeout: 8000, maximumAge: 30000 }
    );
  }
}, []);
```

**B. Nominatim reverse geocode helper** (extract from existing `AddGemView.jsx`)
```js
// src/lib/geocoding.js  (new file — extracted + extended)
export async function reverseGeocode(lat, lng) {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    { headers: { 'Accept-Language': 'en' } }
  );
  const d = await r.json();
  return { name: d.address?.suburb || d.address?.city || d.name, display_name: d.display_name };
}

export async function searchPlaces(query) {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8`,
    { headers: { 'Accept-Language': 'en' } }
  );
  return r.json();
}
```

**C. Location search** — debounced 380ms input calls `searchPlaces()`, results shown in dropdown with place name + address. On select → updates `location` state and moves map pin.

**D. Map pin** — small embedded Leaflet map (no controls), pin drops with a short CSS translate-Y animation on GPS success or search select. User can also tap-on-map to set coords, which triggers a reverse geocode call to update the address banner.

**GPS banner states:**
- `loading` → spinner + "Detecting your location…"
- `success` → green banner with place name, full address, "↻ Refresh" button
- `denied` → yellow banner "GPS denied — search or tap the map"

**Files changed:**
- `src/pages/steps/StepPin.jsx` — new file
- `src/lib/geocoding.js` — new file (extracted from AddGemView)

---

### Step 3 — StepName.jsx

**Purpose:** Reduce typing friction with AI-suggested names; collect category.

**Key behaviours:**
- On step entry, derive a name suggestion from `AI_SUGGESTIONS_MAP[category][color]` (existing map in `AddGemView.jsx`) combining the photo-analysed dominant color with the category set so far (or a default).
- Show suggestion card with "✓ Use" and "✏️ Edit" actions.
- Manual name input shown below suggestion.
- Category grid (12 categories from `categoryConfig.js`) — tapping a category re-runs the name suggestion if name hasn't been manually edited.

**Files changed:**
- `src/pages/steps/StepName.jsx` — new file

---

### Step 4 — StepRate.jsx

**Purpose:** Replace clinical number sliders with playful emoji-based rating.

**Quick Presets (choose one to auto-fill all sliders):**

| Preset | Cozy | Lively | Zen | Insta |
|--------|------|--------|-----|-------|
| 💻 Work Spot | 3 | 2 | 3 | 2 |
| 🧘 Zen Mode | 5 | 1 | 5 | 2 |
| 🎉 Social | 3 | 5 | 1 | 4 |
| 📸 Insta-worthy | 4 | 3 | 2 | 5 |

**Emoji sliders** — each vibe dimension has 5 emoji options (index 0–4 maps to score 1–5). Tapping an emoji selects it and highlights the option. This replaces `<input type="range">`.

**Mapping to existing schema:** `vibeRatings` is stored exactly as the current `vibe_ratings` JSON column in Supabase — no schema migration needed.

**Files changed:**
- `src/pages/steps/StepRate.jsx` — new file

---

### Step 5 — StepVibe.jsx

**Purpose:** AI-generated description with a typewriter reveal that feels like discovery.

**Key behaviours:**

**A. Typewriter AI reveal**
```js
useEffect(() => {
  const full = AI_SUGGESTIONS_MAP[category]?.[dominantColor] || fallback;
  setAiDescription('');
  let i = 0;
  const timer = setInterval(() => {
    setAiDescription(full.slice(0, i + 1));
    i++;
    if (i >= full.length) clearInterval(timer);
  }, 28);
  return () => clearInterval(timer);
}, [category]);
```

**B. "✓ Use This" / "✏️ Edit"** — accepting copies AI text into `description` state.

**C. Tag selection** — `RECOMMENDED_TAGS_MAP[category]` (existing) shown as toggle chips. Custom tag input also available. Max 10 tags enforced.

**Files changed:**
- `src/pages/steps/StepVibe.jsx` — new file

---

### Step 6 — StepCelebrate.jsx

**Purpose:** Make dropping a gem feel like an achievement, not a form submission.

**Key behaviours:**

- Full-screen confetti via `canvas-confetti` npm package (already a common lightweight choice; if not installed: `npm install canvas-confetti`).
- Gem counter — animate from 0 to `spot.area_gem_count` using `requestAnimationFrame`.
- Badge reveal — call existing `checkAndAwardBadge()` logic from `AddGemView.jsx` on mount; show awarded badge if any.
- Share card — reuse existing canvas-based share card generation from `AddGemView.jsx`.
- "See on Map" navigates to `MapView` and centres on the new gem's coordinates.

**Files changed:**
- `src/pages/steps/StepCelebrate.jsx` — new file

---

## 5. AddGemView.jsx Refactor

The 1784-line monolith gets slimmed to an orchestrator:

```jsx
// src/pages/AddGemView.jsx (after refactor — ~200 lines)
export default function AddGemView() {
  // all wizard state (see §3.2)

  const handleSubmit = async () => {
    // existing Supabase insert logic, extracted verbatim
    // on success: setDroppedGem(result); setWizardStep(6);
  };

  const stepProps = { location, setLocation, gemName, setGemName, /* ...all state */ };

  return (
    <div className="add-gem-wizard">
      <GemWizardProgress currentStep={wizardStep} totalSteps={5} />
      {wizardStep === 1 && <StepCapture {...stepProps} />}
      {wizardStep === 2 && <StepPin {...stepProps} />}
      {wizardStep === 3 && <StepName {...stepProps} />}
      {wizardStep === 4 && <StepRate {...stepProps} />}
      {wizardStep === 5 && <StepVibe {...stepProps} onSubmit={handleSubmit} />}
      {wizardStep === 6 && <StepCelebrate gem={droppedGem} />}
      {wizardStep < 6 && (
        <GemWizardCTA
          step={wizardStep}
          onBack={() => setWizardStep(s => s - 1)}
          onNext={() => setWizardStep(s => s + 1)}
          canAdvance={stepValid(wizardStep)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
```

**Key preserved logic (move, don't rewrite):**
- `analyzeImageColor()` → move to `src/lib/imageUtils.js`
- `AI_SUGGESTIONS_MAP` + `RECOMMENDED_TAGS_MAP` + `VIBE_PRESETS` → move to `src/lib/gemWizardData.js`
- Supabase insert + image upload → extract to `src/lib/gemService.js`
- Badge check → keep in `AddGemView.jsx` or `src/lib/gemService.js`
- Pioneer zone detection → keep in `gemService.js`

---

## 6. CSS Changes

### New classes needed in `AddGemView.css`

```css
/* Wizard shell */
.add-gem-wizard { height: 100dvh; display: flex; flex-direction: column; }

/* Progress bar */
.wizard-progress { display: flex; gap: 6px; padding: 12px 20px; }
.wizard-progress-dot { flex: 1; height: 3px; border-radius: 2px; background: var(--border); transition: background 0.3s; }
.wizard-progress-dot.active { background: var(--color-accent); }
.wizard-progress-dot.done { background: var(--color-accent); opacity: 0.4; }

/* Step panels */
.wizard-step { flex: 1; overflow-y: auto; padding: 16px 20px 80px; }

/* Sticky CTA */
.wizard-cta { position: fixed; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: var(--bg-glass); backdrop-filter: blur(12px); border-top: 1px solid var(--border); }
.wizard-cta-next { background: var(--color-accent); color: white; border: none; border-radius: 12px; padding: 12px 24px; font-weight: 600; cursor: pointer; }
.wizard-cta-next.danger { background: #E07A5F; }
.wizard-cta-next:disabled { opacity: 0.4; cursor: not-allowed; }

/* GPS banner variants */
.gps-banner { border-radius: 12px; padding: 12px 16px; display: flex; gap: 10px; align-items: flex-start; }
.gps-banner.loading { background: rgba(108,140,116,0.12); border: 1px solid var(--border); }
.gps-banner.success { background: rgba(22,50,34,0.9); border: 1px solid rgba(40,90,55,0.6); }
.gps-banner.denied { background: rgba(200,150,80,0.1); border: 1px solid rgba(200,150,80,0.3); }

/* Emoji slider row */
.emoji-slider { display: flex; gap: 4px; }
.emoji-option { flex: 1; padding: 6px 0; border-radius: 8px; border: 1px solid var(--border); background: var(--card-bg); text-align: center; cursor: pointer; transition: all 0.15s; }
.emoji-option.selected { background: rgba(24,54,36,1); border-color: var(--color-accent); }

/* Typewriter cursor */
.typewriter-text::after { content: '|'; animation: blink 1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }

/* Celebration */
.celebrate-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100dvh; text-align: center; padding: 24px; }
.celebrate-gem-icon { font-size: 72px; animation: gem-drop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes gem-drop { from { transform: scale(0) translateY(-40px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
```

Remove: `.add-gem-split-layout`, `.add-gem-form-panel`, `.add-gem-preview-panel` (no longer used).

---

## 7. New Files Summary

| File | Purpose |
|------|---------|
| `src/pages/steps/StepCapture.jsx` | Step 1 component |
| `src/pages/steps/StepPin.jsx` | Step 2 component |
| `src/pages/steps/StepName.jsx` | Step 3 component |
| `src/pages/steps/StepRate.jsx` | Step 4 component |
| `src/pages/steps/StepVibe.jsx` | Step 5 component |
| `src/pages/steps/StepCelebrate.jsx` | Step 6 success screen |
| `src/components/GemWizardProgress.jsx` | Progress bar |
| `src/components/GemWizardCTA.jsx` | Sticky bottom bar |
| `src/lib/geocoding.js` | Nominatim reverse + search (extracted) |
| `src/lib/imageUtils.js` | `analyzeImageColor` (extracted) |
| `src/lib/gemWizardData.js` | `AI_SUGGESTIONS_MAP`, `RECOMMENDED_TAGS_MAP`, `VIBE_PRESETS` |
| `src/lib/gemService.js` | Supabase insert, image upload, badge check |

---

## 8. Supabase Schema — No Migration Required

All data maps to existing columns:

| Wizard field | Supabase column |
|---|---|
| `photoFile` | `image_url` (uploaded to Storage) |
| `location.lat/lng` | `latitude`, `longitude` |
| `location.placeName` | `location_name` |
| `location.address` | `address` |
| `gemName` | `title` |
| `category` | `category` |
| `vibeRatings` | `vibe_ratings` (JSONB) |
| `description` | `description` |
| `selectedTags` | `tags` (text[]) |

---

## 9. Dependencies

| Package | Reason | Action |
|---------|--------|--------|
| `canvas-confetti` | Celebration screen | `npm install canvas-confetti` |
| `@capacitor/camera` | Native camera on Step 1 (mobile) | Already likely installed; verify |
| All others | Leaflet, Supabase, React already installed | No change |

---

## 10. Sprint Breakdown

### Week 1–2 — Wizard Shell + Navigation
- Refactor `AddGemView.jsx` into orchestrator (~200 lines)
- Extract `gemWizardData.js`, `gemService.js`, `imageUtils.js`, `geocoding.js`
- Build `GemWizardProgress.jsx` and `GemWizardCTA.jsx`
- Implement step routing with validation guards
- Wire `StepCapture.jsx` with photo upload + filter chips

**Definition of Done:** User can advance from step 1→5 and submit a gem; all existing functionality preserved.

### Week 3 — Map + GPS
- Build `StepPin.jsx` with full GPS auto-detect on entry
- Nominatim reverse geocode integration
- Debounced place search with dropdown
- Tap-on-map pin placement
- GPS banner states (loading / success / denied)

**Definition of Done:** GPS captures on step 2 entry; place name + address shown; search and map-tap both work.

### Week 4 — AI Name + Emoji Vibe
- Build `StepName.jsx` with AI suggestion card
- Build `StepRate.jsx` replacing sliders with emoji selectors
- Build `StepVibe.jsx` with typewriter AI reveal + tag chips
- Update CSS for new components

**Definition of Done:** Full wizard flow works end-to-end; vibe ratings recorded correctly in Supabase.

### Week 5–6 — Celebration + Polish
- Build `StepCelebrate.jsx` with `canvas-confetti`, gem counter animation, badge reveal
- Share card export (reuse existing canvas logic)
- E2E testing on web + Capacitor iOS/Android
- Accessibility audit (touch targets ≥ 44px, contrast ratios)
- Offline fallback: if Supabase write fails, queue to `localStorage` via `useOfflineSpots`

**Definition of Done:** Full flow shipped; offline queueing works; share card exports correctly.

---

## 11. Offline Fallback

Per project guidelines, all Supabase writes must have a local fallback:

```js
// in gemService.js
export async function dropGem(gemData) {
  if (!navigator.onLine) {
    const pending = JSON.parse(localStorage.getItem('spota_pending_gems') || '[]');
    pending.push({ ...gemData, _pendingAt: Date.now() });
    localStorage.setItem('spota_pending_gems', JSON.stringify(pending));
    return { offline: true };
  }
  // normal Supabase insert...
}
```

The existing `useOfflineSpots` hook sync logic can pick up `spota_pending_gems` and flush on reconnect.

---

## 12. Acceptance Criteria

- [ ] Full wizard renders on mobile (< 390px viewport) without horizontal scroll
- [ ] GPS auto-detects on Step 2 entry in ≤ 8 seconds or shows denied state
- [ ] Place name + formatted address shown in GPS banner after detection
- [ ] Search input debounces at 380ms; results appear within 1 second
- [ ] Emoji vibe selections save correctly to `vibe_ratings` JSONB column
- [ ] AI typewriter animation completes in ≤ 3 seconds for longest description
- [ ] Confetti fires on gem drop success
- [ ] Gem drops correctly when offline (queued to localStorage)
- [ ] Existing share card export still functions
- [ ] No regressions in `MapView.jsx` or `SpotDetailsModal`

---

*Built on the Gem Drift design philosophy — patient discovery, depth as structure, color as accent.*
