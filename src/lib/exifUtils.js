/**
 * exifUtils.js — EXIF GPS extraction from image files
 *
 * IMPORTANT: Must be called on the ORIGINAL file BEFORE compressImage(),
 * because canvas compression strips all EXIF metadata.
 *
 * Supports: JPEG · HEIC/HEIF (iOS) · TIFF · WebP (partial)
 * Library:  exifr v7 — https://github.com/MikeKovarik/exifr
 */

/**
 * Extracts GPS coordinates from an image file's EXIF metadata.
 *
 * @param {File|Blob} file - Original (uncompressed) image file
 * @returns {Promise<{lat: number, lng: number} | null>}
 *   Decimal lat/lng if found, null if not present or on any error.
 */
export async function extractExifGps(file) {
  if (!file) return null;
  const type = file.type || '';
  // Only attempt on image types
  if (type && !type.startsWith('image/')) return null;

  try {
    // Dynamic import — only loads the GPS-only sub-module (~8KB gz)
    const { gps } = await import('exifr');
    const coords = await gps(file);

    if (!coords?.latitude || !coords?.longitude) return null;

    const lat = coords.latitude;
    const lng = coords.longitude;

    // Sanity check: reject null island (0,0) and out-of-range values
    if (lat === 0 && lng === 0) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    return { lat, lng };
  } catch {
    // Fail silently — EXIF parsing errors are non-fatal
    return null;
  }
}
