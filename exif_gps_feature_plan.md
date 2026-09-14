# EXIF GPS Auto-Extraction — Feature Enhancement Plan
**Spota · Gem Drop Wizard v2.1**

---

## 1. Problem Statement

In the current wizard, Step 2 (StepPin) always tries to detect the user's **current device GPS** — regardless of when or where the photo was taken. This creates friction and inaccuracy:

- User took a photo yesterday at a café → wizard pins today's location (wrong)
- User uploads from gallery while at home → GPS pins home address (wrong)
- GPS is denied or unavailable → user must search manually (extra work)

**Opportunity:** Photos taken on smartphones embed GPS coordinates in EXIF metadata. If the image has that data, we can auto-fill the location with **zero extra user effort** — the most accurate location possible, because it's where the photo was actually taken.

---

## 2. What is EXIF GPS?

EXIF (Exchangeable Image File Format) is metadata embedded in image files by cameras and smartphones. It includes:

| Tag | Example |
|-----|---------|
| `GPSLatitude` | `[28, 36, 42.5]` (degrees, minutes, seconds) |
| `GPSLatitudeRef` | `"N"` or `"S"` |
| `GPSLongitude` | `[77, 12, 30.1]` |
| `GPSLongitudeRef` | `"E"` or `"W"` |
| `GPSAltitude` | `210.4` (meters) |
| `DateTimeOriginal` | `"2024:08:15 14:32:11"` |

**Supported image formats:** JPEG ✓ · HEIC/HEIF ✓ (iOS) · TIFF ✓ · WebP (partial)

---

## 3. Critical Discovery: EXIF is Stripped by Canvas Compression

**This is the most important technical finding in this plan.**

In the current `StepCapture.jsx` → `handleFileSelect()`:
```js
const compressed = await compressImage(file);  // ← canvas strips EXIF
setPhotoFile(compressed);
```

`compressImage()` draws the image onto an HTML5 Canvas and exports as a new Blob. Canvas operations **do not preserve EXIF metadata**. Once compressed, the GPS data is gone permanently.

**Fix required:** Extract GPS from the **original `file`** BEFORE calling `compressImage()`.

---

## 4. Library Choice: `exifr`

**Recommended:** [`exifr`](https://www.npmjs.com/package/exifr)

| Criterion | `exifr` | `exif-js` | `piexifjs` |
|-----------|---------|-----------|------------|
| Browser support | ✓ Full | ✓ | ✓ |
| HEIC (iOS photos) | ✓ | ✗ | ✗ |
| Tree-shakeable | ✓ | ✗ | ✗ |
| Async / non-blocking | ✓ | ✗ (callback) | ✗ |
| Bundle size | ~25KB gz | ~18KB gz | ~10KB gz |
| GPS parsing | Built-in decimal | Manual DMS→decimal | Manual |
| Active maintenance | ✓ (2024) | ✗ (archived) | ✓ |

**Install:** `npm install exifr`

**Usage (minimal GPS-only parse):**
```js
import { gps } from 'exifr';
const coords = await gps(file); // { latitude: 28.61, longitude: 77.20 } or undefined
```

This is the lightest import — only loads the GPS-parsing module, not the full EXIF decoder.

---

## 5. Platform-Specific Behavior

| Platform | Image Source | EXIF Available? | Strategy |
|----------|-------------|-----------------|----------|
| Web browser | `<input type="file">` gallery | ✓ (most phones) | Extract with `exifr` |
| Web browser | `<input capture="camera">` | ✗ (live capture, no EXIF GPS) | Fall back to device GPS |
| Native iOS/Android (Capacitor) | `Camera.getPhoto()` Base64 | ✗ (Capacitor strips EXIF) | Fall back to device GPS |
| WhatsApp/Telegram forwarded | Gallery upload | ✗ (apps strip EXIF) | Show "no location found" |
| Screenshot | Gallery upload | ✗ | Show "no location found" |

**Key insight:** EXIF extraction is most valuable for web gallery uploads of original smartphone photos.

---

## 6. Privacy Consideration

EXIF GPS data is sensitive. The app must:
- Extract GPS only locally (never send raw EXIF to any server)
- Only use the coordinates to pre-fill the map pin
- Never store EXIF metadata in Supabase — only the user-confirmed lat/lng
- Inform the user that location was read from the photo (transparency)

The compressed image uploaded to Supabase Storage already has EXIF stripped (by canvas compression) — this is actually the correct privacy-preserving behavior.

---

## 7. New User Flow

### Happy Path (gallery photo with GPS):
```
Step 1 (Capture)
  └── User selects photo from gallery
  └── EXIF GPS extracted silently in background
  └── Toast shown: "📍 Photo location detected"
  ↓
Step 2 (Pin)
  └── Smart banner appears at top:
      "📸 Location from your photo — [Place Name]"
      [Use Photo GPS] [Use Current Location]
  └── Map pin auto-placed at EXIF coordinates
  └── User can override by dragging, searching, or switching to device GPS
```

### No GPS in photo:
```
Step 1 (Capture)
  └── EXIF parse returns undefined
  └── No banner shown
  ↓
Step 2 (Pin)
  └── Normal flow: device GPS auto-detect (existing behavior)
```

### GPS denied + no EXIF:
```
Step 2 (Pin)
  └── "GPS not available" banner
  └── User searches manually (existing behavior)
```

---

## 8. Implementation Plan

### 8.1 New File: `src/lib/exifUtils.js`

```js
/**
 * Extracts GPS coordinates from an image file's EXIF metadata.
 * Must be called BEFORE compressImage() as canvas strips EXIF.
 *
 * @param {File} file - Original (uncompressed) image file
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export async function extractExifGps(file) {
  if (!file || !file.type.startsWith('image/')) return null;
  try {
    // Dynamic import — loads only when needed
    const { gps } = await import('exifr');
    const coords = await gps(file);
    if (!coords?.latitude || !coords?.longitude) return null;
    return { lat: coords.latitude, lng: coords.longitude };
  } catch {
    return null; // Fail silently — always fall back gracefully
  }
}
```

---

### 8.2 Changes to `StepCapture.jsx`

Add new prop: `onExifGps(coords | null)`

Modify `handleFileSelect`:
```js
// BEFORE (current):
const handleFileSelect = async (file) => {
  if (!file) return;
  const compressed = await compressImage(file);
  setPhotoFile(compressed);
  ...
};

// AFTER (enhanced):
const handleFileSelect = async (file) => {
  if (!file) return;

  // ① Extract GPS FIRST, before compression strips EXIF
  extractExifGps(file).then(coords => {
    onExifGps?.(coords); // pass up to orchestrator
  });

  // ② Compress (strips EXIF — intended for privacy)
  const compressed = await compressImage(file);
  setPhotoFile(compressed);
  ...
};
```

Note: `extractExifGps` runs async in parallel — no UX delay added.

Native photo path (`takeNativePhoto`) — EXIF not available from Capacitor Base64, so call `onExifGps(null)` there.

---

### 8.3 Changes to `AddGemView.jsx`

Add new state after Step 1 state:
```js
// Step 1 — Capture (add this)
const [photoGps, setPhotoGps] = useState(null); // { lat, lng } from EXIF or null
```

Pass to StepCapture:
```jsx
<StepCapture
  ...existing props...
  onExifGps={setPhotoGps}
/>
```

Pass to StepPin:
```jsx
<StepPin
  location={location}
  setLocation={setLocation}
  photoGps={photoGps}      // ← new
/>
```

Reset on `handleDropAnother()`:
```js
setPhotoGps(null);
```

---

### 8.4 Changes to `StepPin.jsx`

Add new prop: `photoGps`

New GPS status: add `'photo'` to the existing `gpsStatus` states:
```
idle | loading | success | denied | photo
```

New logic in `useEffect` on mount:
```js
useEffect(() => {
  if (photoGps?.lat && !location?.lat) {
    // Photo has GPS — use it as initial location, then reverse geocode
    reverseGeocode(photoGps.lat, photoGps.lng).then(({ name, address }) => {
      setLocation({ lat: photoGps.lat, lng: photoGps.lng, placeName: name, address, source: 'exif' });
      setGpsStatus('photo');
    });
  } else if (!location?.lat) {
    detectGPS(); // fallback to device GPS
  } else {
    setGpsStatus('success');
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

New banner UI (add to StepPin render):
```jsx
{gpsStatus === 'photo' && (
  <div className="gps-banner photo">
    <span>📸 Location read from your photo</span>
    <button onClick={detectGPS} className="gps-switch-btn">
      Use current GPS instead
    </button>
  </div>
)}
```

---

### 8.5 CSS additions — `StepPin.css`

```css
.gps-banner.photo {
  background: linear-gradient(135deg,
    rgba(108, 140, 116, 0.15),
    rgba(108, 140, 116, 0.08));
  border-color: rgba(108, 140, 116, 0.4);
  color: var(--color-accent);
}

.gps-switch-btn {
  background: none;
  border: 1px solid rgba(108, 140, 116, 0.4);
  color: var(--color-accent);
  border-radius: 20px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.gps-switch-btn:hover {
  background: rgba(108, 140, 116, 0.12);
}
```

---

## 9. Files Changed Summary

| File | Change Type | What |
|------|-------------|------|
| `src/lib/exifUtils.js` | **New file** | `extractExifGps(file)` using `exifr` |
| `src/pages/steps/StepCapture.jsx` | Modify | Call `extractExifGps()` before `compressImage()`, emit via `onExifGps` prop |
| `src/pages/AddGemView.jsx` | Modify | Add `photoGps` state, pass to StepCapture + StepPin |
| `src/pages/steps/StepPin.jsx` | Modify | Accept `photoGps` prop, new `'photo'` GPS status, smart banner |
| `src/pages/steps/StepPin.css` | Modify | `.gps-banner.photo` + `.gps-switch-btn` styles |
| `package.json` | Modify | Add `exifr` dependency |

**No Supabase schema changes required.** `location` object already uses `{ lat, lng, source, placeName, address }` — just the `source` value changes from `'gps'` to `'exif'`.

---

## 10. Dependency

```bash
npm install exifr
```

| Package | Size | Purpose |
|---------|------|---------|
| `exifr` | ~25KB gzipped | EXIF/IPTC/XMP metadata parser, browser + Node |

Only the `gps` sub-import is used — tree-shakeable, actual impact ~8KB gz.

---

## 11. Edge Cases & Handling

| Scenario | Behavior |
|----------|----------|
| Photo has GPS | Auto-place pin + show "📸 Location from photo" banner |
| Photo has no GPS (screenshot, WhatsApp, etc.) | Silent fallback to device GPS |
| `exifr` parse throws error | Caught silently, fallback to device GPS |
| GPS coordinates are `0,0` (null island) | Treated as invalid, fallback to device GPS |
| User took photo in a different country | EXIF GPS used — this is the correct behavior |
| Native Capacitor camera (live capture) | `onExifGps(null)` → device GPS used |
| Native Capacitor gallery | Capacitor strips EXIF from Base64, → device GPS |
| User wants to override photo GPS | "Use current GPS instead" button in banner |
| EXIF GPS and device GPS disagree | User explicitly chooses via the banner buttons |

---

## 12. Sprint Breakdown

### Sprint A — Foundation (1 session)
1. `npm install exifr`
2. Create `src/lib/exifUtils.js`
3. Modify `StepCapture.jsx` — extract GPS before compress, emit via prop
4. Modify `AddGemView.jsx` — add `photoGps` state, wire props

### Sprint B — UX + Polish (1 session)
5. Modify `StepPin.jsx` — consume `photoGps`, new `'photo'` status, smart mount logic
6. Add banner UI + CSS
7. Test edge cases (no-GPS photos, WhatsApp, screenshots)
8. Test on iOS gallery (HEIC support via `exifr`)

---

## 13. Success Criteria

- [ ] Gallery photo with GPS → map pin auto-placed at photo's location on Step 2 entry
- [ ] Banner "📸 Location read from your photo" shown with override button
- [ ] Photo without GPS → device GPS auto-detect fires normally (no regression)
- [ ] `exifr` parse failure → silent fallback, no crash
- [ ] No EXIF data sent to Supabase (verified by inspecting the `spots` insert payload)
- [ ] HEIC photos from iPhone auto-geocode correctly
- [ ] "Use current GPS instead" button switches to device GPS and removes banner

---

*Document prepared: 2026-08-16 · Spota Gem Drop Wizard v2.1 EXIF GPS Feature*
