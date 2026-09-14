import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

import {
  saveOfflineZone,
  getCachedSpots,
  getCachedZones,
  deleteCachedZone,
  clearAllCache,
  checkAndExpireCache
} from '../offlineCache';

// Spots with a data: URL image skip the urlToBase64() network fetch path
// entirely, so these tests never need to mock `fetch`.
const spotA = { id: 'a', title: 'Gem A', image_url: 'data:image/png;base64,AAA' };
const spotB = { id: 'b', title: 'Gem B', image_url: 'data:image/png;base64,BBB' };

// offlineCache.js always stamps created_at with Date.now(), so to test
// expiry we backdate a saved zone directly through the (fake) IndexedDB
// rather than faking timers — fake-indexeddb schedules its own callbacks via
// real timers internally, which deadlocks against vi.useFakeTimers().
function openRawDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('spota_offline_db', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function backdateZone(zoneId, createdAt) {
  const db = await openRawDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('zones', 'readwrite');
    const store = tx.objectStore('zones');
    const getReq = store.get(zoneId);
    getReq.onsuccess = () => {
      const zone = getReq.result;
      zone.created_at = createdAt;
      store.put(zone);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

describe('offlineCache (IndexedDB, via fake-indexeddb)', () => {
  beforeEach(async () => {
    await clearAllCache();
  });

  it('saves a zone with its spots and reads them back', async () => {
    const { zoneId, spotsCount } = await saveOfflineZone('Triund', { lat: 32.2, lng: 76.3 }, 5, [spotA, spotB]);

    expect(spotsCount).toBe(2);

    const zones = await getCachedZones();
    expect(zones).toHaveLength(1);
    expect(zones[0].id).toBe(zoneId);
    expect(zones[0].name).toBe('Triund');

    const spots = await getCachedSpots();
    expect(spots.map((s) => s.id).sort()).toEqual(['a', 'b']);
    expect(spots.every((s) => s.cached_zone_id === zoneId)).toBe(true);
  });

  it('deletes a zone and only the spots that belonged to it', async () => {
    // offlineCache.js derives each zone's id from Date.now() alone, so two
    // saves issued back-to-back can land in the same millisecond and collide
    // (a real, if narrow, edge case in the app itself — see the
    // production-readiness notes). Pin distinct timestamps here so this test
    // verifies delete scoping, not clock resolution.
    let now = 1_700_000_000_000;
    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);

    const { zoneId: zoneId1 } = await saveOfflineZone('Zone 1', { lat: 1, lng: 1 }, 5, [spotA]);
    now += 1000;
    await saveOfflineZone('Zone 2', { lat: 2, lng: 2 }, 5, [spotB]);
    dateSpy.mockRestore();

    await deleteCachedZone(zoneId1);

    const zones = await getCachedZones();
    expect(zones.map((z) => z.name)).toEqual(['Zone 2']);

    const spots = await getCachedSpots();
    expect(spots.map((s) => s.id)).toEqual(['b']);
  });

  it('clears everything on clearAllCache', async () => {
    await saveOfflineZone('Zone 1', { lat: 1, lng: 1 }, 5, [spotA]);
    await clearAllCache();

    expect(await getCachedZones()).toEqual([]);
    expect(await getCachedSpots()).toEqual([]);
  });

  describe('checkAndExpireCache', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    it('removes zones older than the 7-day expiry window', async () => {
      const { zoneId } = await saveOfflineZone('Old zone', { lat: 1, lng: 1 }, 5, [spotA]);
      await backdateZone(zoneId, Date.now() - 8 * DAY_MS);

      await checkAndExpireCache();

      expect(await getCachedZones()).toEqual([]);
    });

    it('keeps zones that are still within the expiry window', async () => {
      const { zoneId } = await saveOfflineZone('Fresh zone', { lat: 1, lng: 1 }, 5, [spotA]);
      await backdateZone(zoneId, Date.now() - 1 * DAY_MS);

      await checkAndExpireCache();

      const zones = await getCachedZones();
      expect(zones.map((z) => z.name)).toEqual(['Fresh zone']);
    });
  });
});
