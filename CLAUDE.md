# Spota Developer Guidelines

This document outlines the commands, style guide, and workflow for developers and AI agents working on the Spota codebase.

## Build & Run Commands

| Task | Command | Description |
| :--- | :--- | :--- |
| **Start Dev Server** | `npm run dev` | Launch the local Vite development server. |
| **Production Build** | `npm run build` | Compile the production bundles. |
| **Lint Code** | `npm run lint` | Run ESLint checks across the codebase. |
| **Preview Build** | `npm run preview` | Serve the locally built production files. |

## Gem Drop Wizard — Agent Architecture (v2.0)

The gem-dropping flow has been redesigned as a 5-step wizard. All agents must follow this file map:

### Orchestrator
- `src/pages/AddGemView.jsx` — ~200-line orchestrator. Holds all wizard state, routes steps, calls `gemService.dropGem()` on submit.

### Step Components (`src/pages/steps/`)
| File | Step | Responsibility |
| :--- | :--- | :--- |
| `StepCapture.jsx` | 1 | Photo-first camera/gallery + quick filter chips |
| `StepPin.jsx` | 2 | Auto GPS on entry + search + draggable map pin |
| `StepName.jsx` | 3 | AI name suggestion + category selection |
| `StepRate.jsx` | 4 | Emoji vibe presets + per-dimension emoji sliders |
| `StepVibe.jsx` | 5 | AI typewriter reveal + tag chip selection |
| `StepCelebrate.jsx` | 6 | Canvas-confetti + gem counter + badge reveal + share card |

### Shared UI Components (`src/components/`)
- `GemWizardProgress.jsx` — step progress dots bar
- `GemWizardCTA.jsx` — sticky Back/Next/Submit bottom bar

### Extracted Libraries (`src/lib/`)
| File | Exports | Source |
| :--- | :--- | :--- |
| `gemWizardData.js` | `AI_SUGGESTIONS_MAP`, `RECOMMENDED_TAGS_MAP`, `VIBE_PRESETS`, `getSuggestedDescription()` | Extracted from old AddGemView |
| `imageUtils.js` | `analyzeImageColor()`, `compressImage()` | Extracted from old AddGemView |
| `geocoding.js` | `reverseGeocode()`, `searchPlaces()` | Extracted + extended from old AddGemView |
| `gemService.js` | `dropGem()` — Supabase insert + image upload + offline queue | Extracted from old AddGemView |

### Key Agent Rules
1. **Never re-introduce the old split-panel layout.** The wizard replaces `add-gem-split-layout` entirely.
2. **GPS fires on Step 2 entry** via `useEffect([], [])` — not on button click.
3. **Vibe ratings use emoji selectors** (index 0–4 → score 1–5), not `<input type="range">`.
4. **Supabase columns are unchanged** — no schema migration needed. `vibe_ratings` table still accepts `{cozy, insta_worthy, lively, zen, workspace}`.
5. **canvas-confetti** is the only new npm dependency (`npm install canvas-confetti`).
6. **Offline queue**: if `navigator.onLine` is false, `gemService.dropGem()` pushes to `localStorage` key `spota_pending_gems`.

## Development Workflow Guidelines

1.  **Think First**: Analyze changes against the product specs in `docs/Spota_PRD_Enhancement.md` and check how they impact mobile (Capacitor) vs. web users.
2.  **Implementation Plan**: For any major architectural changes or schemas, draft or update the implementation plan under `gem_drop_implementation_plan.md`.
3.  **Strict Styling Constraints**:
    *   Use vanilla CSS. Avoid importing third-party UI framework utilities unless explicitly approved.
    *   Maintain the glassmorphic aesthetics (`glass-panel` classes) and the custom HSL palette defined in `src/index.css`.
4.  **Local Fallback Support**:
    *   Always write a fallback to `localStorage` or local cached states if database writes/reads to Supabase fail, so the app remains demoable offline and during mock tests.
5.  **Offline-Friendly Design**:
    *   Verify offline state using `navigator.onLine` and the `useOfflineSpots` hook.
