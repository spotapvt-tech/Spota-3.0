const DB_NAME = 'spota_offline_db';
const DB_VERSION = 1;
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Helper to initialize and open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('spots')) {
        db.createObjectStore('spots', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('zones')) {
        db.createObjectStore('zones', { keyPath: 'id' });
      }
    };
  });
}

// Convert image URL to Base64 for offline storage
async function urlToBase64(url) {
  if (!url) return '';
  if (url.startsWith('data:')) return url; // already base64

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const response = await fetch(url, { signal: controller.signal, mode: 'cors' });
    clearTimeout(timeoutId);

    if (!response.ok) return url;
    
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(url); // fallback on error
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn(`Failed to cache image for offline: ${url}`, err);
    return url; // fallback to original URL on network/CORS failure
  }
}

// Save a zone and its spots to cache
export async function saveOfflineZone(zoneName, center, radius, spots) {
  const db = await openDB();
  const zoneId = `zone_${Date.now()}`;
  
  // 1. Convert spot images to Base64 in parallel (with limit to avoid congestion)
  const cachedSpots = await Promise.all(
    spots.map(async (spot) => {
      let offlineImageUrl = spot.image_url;
      if (spot.image_url && !spot.image_url.startsWith('data:')) {
        offlineImageUrl = await urlToBase64(spot.image_url);
      }
      return {
        ...spot,
        image_url: offlineImageUrl,
        cached_zone_id: zoneId
      };
    })
  );

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['spots', 'zones'], 'readwrite');
    const spotsStore = transaction.objectStore('spots');
    const zonesStore = transaction.objectStore('zones');

    transaction.oncomplete = () => resolve({ zoneId, spotsCount: spots.length });
    transaction.onerror = () => reject(transaction.error);

    // Save zone metadata
    zonesStore.put({
      id: zoneId,
      name: zoneName,
      center,
      radius: Number(radius),
      created_at: Date.now()
    });

    // Save all spots
    cachedSpots.forEach((spot) => {
      spotsStore.put(spot);
    });
  });
}

// Get all cached spots
export async function getCachedSpots() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('spots', 'readonly');
    const store = transaction.objectStore('spots');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Get all active offline zones
export async function getCachedZones() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('zones', 'readonly');
    const store = transaction.objectStore('zones');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Delete specific zone and clean up orphaned spots
export async function deleteCachedZone(zoneId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['spots', 'zones'], 'readwrite');
    const spotsStore = transaction.objectStore('spots');
    const zonesStore = transaction.objectStore('zones');

    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);

    // Delete zone metadata
    zonesStore.delete(zoneId);

    // Scan and delete spots matching this zoneId
    const request = spotsStore.openCursor();
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.cached_zone_id === zoneId) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  });
}

// Clear all cache database contents
export async function clearAllCache() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['spots', 'zones'], 'readwrite');
    transaction.objectStore('spots').clear();
    transaction.objectStore('zones').clear();
    
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
}

// Check and expire cache older than 7 days
export async function checkAndExpireCache() {
  try {
    const zones = await getCachedZones();
    const now = Date.now();
    
    for (const zone of zones) {
      if (now - zone.created_at > CACHE_EXPIRY_MS) {
        console.log(`Expiring offline zone cache: ${zone.name}`);
        await deleteCachedZone(zone.id);
      }
    }
  } catch (err) {
    console.error('Error during cache cleanup expiration:', err);
  }
}
