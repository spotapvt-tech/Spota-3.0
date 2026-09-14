// Gem Service — Supabase insert, image upload, offline queue
// Extracted from AddGemView.jsx (v2.0 wizard refactor)

import { supabase } from './supabaseClient';
import { fileToBase64 } from './imageUtils';

const PENDING_KEY = 'spota_pending_gems';

/**
 * Upload image to Supabase Storage. Falls back to base64 string.
 * Returns final URL string.
 */
async function uploadImage(imageFile, cameraBase64) {
  const fileExt = (imageFile?.name || 'photo.jpg').split('.').pop() || 'jpg';
  const filePath = `spot-images/${Date.now()}.${fileExt}`;

  try {
    const uploadPromise = supabase.storage.from('spot-images').upload(filePath, imageFile);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Storage upload timeout')), 30000)
    );
    const result = await Promise.race([uploadPromise, timeoutPromise]);
    if (result?.error) throw result.error;
    if (!result?.data) throw new Error('Empty upload response');

    const { data: pub } = supabase.storage.from('spot-images').getPublicUrl(filePath);
    if (pub?.publicUrl) return pub.publicUrl;
  } catch (storageErr) {
    console.warn('Storage upload failed, using base64 fallback:', storageErr);
  }

  // Fallback 1: raw cameraBase64 (Capacitor native)
  if (cameraBase64) {
    const fmt = fileExt === 'jpg' ? 'jpeg' : fileExt;
    return `data:image/${fmt};base64,${cameraBase64}`;
  }

  // Fallback 2: FileReader base64 (web, small files only)
  if (imageFile && imageFile.size < 1.5 * 1024 * 1024) {
    return await Promise.race([
      fileToBase64(imageFile),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Base64 timeout')), 10000))
    ]);
  }

  throw new Error('Upload failed: image too large for base64 fallback and Storage is unavailable.');
}

/**
 * Drop a gem. Handles offline queuing automatically.
 * Returns { success: true, spot } or { offline: true } or throws.
 */
export async function dropGem({ imageFile, cameraBase64, videoFile, location, title, category, description, tags, address, vibeRatings, user }) {
  // Offline queue
  if (!navigator.onLine) {
    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    pending.push({ title, category, description, tags, address, lat: location.lat, lng: location.lng, _pendingAt: Date.now() });
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    return { offline: true };
  }

  // Upload image
  let finalImageUrl = '';
  if (imageFile) {
    finalImageUrl = await uploadImage(imageFile, cameraBase64);
  }

  // Upload video (optional, best-effort)
  let finalVideoUrl = '';
  if (videoFile) {
    try {
      const vExt = (videoFile?.name || 'clip.mp4').split('.').pop() || 'mp4';
      const vPath = `spot-videos/${Date.now()}.${vExt}`;
      const vUp = await Promise.race([
        supabase.storage.from('spot-videos').upload(vPath, videoFile),
        new Promise((_, rej) => setTimeout(() => rej(new Error('video timeout')), 60000))
      ]);
      if (!vUp?.error && vUp?.data) {
        const { data: vPub } = supabase.storage.from('spot-videos').getPublicUrl(vPath);
        if (vPub?.publicUrl) finalVideoUrl = vPub.publicUrl;
      }
    } catch (vErr) {
      console.warn('Video upload failed, skipping:', vErr);
    }
  }

  // Insert spot row
  const { data: insertedData, error } = await supabase
    .from('spots')
    .insert([{
      title,
      category,
      description,
      latitude: location.lat,
      longitude: location.lng,
      image_url: finalImageUrl,
      video_url: finalVideoUrl,
      status: 'approved',
      user_id: user && !user.isGuest ? user.id : null,
      tags,
      address
    }])
    .select();

  if (error) throw error;

  const spot = insertedData?.[0];
  if (!spot) throw new Error('Insert returned no data');

  // Insert vibe ratings (best-effort)
  try {
    await supabase.from('vibe_ratings').insert([{
      spot_id: spot.id,
      user_id: user && !user.isGuest ? user.id : null,
      cozy: vibeRatings.cozy,
      insta_worthy: vibeRatings.insta_worthy,
      lively: vibeRatings.lively,
      zen: vibeRatings.zen,
      workspace: vibeRatings.workspace
    }]);
  } catch (rErr) {
    console.warn('Vibe ratings insert failed (non-fatal):', rErr);
  }

  // Track locally
  const localCreated = JSON.parse(localStorage.getItem('spota_created_spots') || '[]');
  localCreated.push({ id: spot.id, category: spot.category, latitude: spot.latitude, longitude: spot.longitude });
  localStorage.setItem('spota_created_spots', JSON.stringify(localCreated));

  return { success: true, spot };
}
