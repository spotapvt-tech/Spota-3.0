// Geocoding utilities — Nominatim reverse geocode + place search
// Extracted and extended from AddGemView.jsx (v2.0 wizard refactor)

const NOMINATIM_HEADERS = { 'User-Agent': 'SpotaApp/1.0', 'Accept-Language': 'en' };

/**
 * Reverse geocode lat/lng → { name, address }
 */
export async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: NOMINATIM_HEADERS }
    );
    if (!r.ok) throw new Error('Nominatim reverse failed');
    const d = await r.json();
    const addr = d.address || {};
    const name = addr.neighbourhood || addr.suburb || addr.town || addr.city || addr.county || d.name || '';
    return { name, address: d.display_name || '' };
  } catch (err) {
    console.error('reverseGeocode error:', err);
    return { name: '', address: '' };
  }
}

/**
 * Forward search query → array of Nominatim result objects
 */
export async function searchPlaces(query, signal) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6`,
      { headers: NOMINATIM_HEADERS, signal }
    );
    if (!r.ok) throw new Error('Nominatim search failed');
    return await r.json();
  } catch (err) {
    if (err.name === 'AbortError') return null; // caller handles
    console.error('searchPlaces error:', err);
    return [];
  }
}
