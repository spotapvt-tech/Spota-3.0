import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the two external dependencies badgeEngine.js pulls in, so tests never
// touch a real network or IndexedDB.
vi.mock('../supabaseClient', () => ({
  supabase: { from: vi.fn() }
}));
vi.mock('../offlineCache', () => ({
  getCachedZones: vi.fn()
}));

import { supabase } from '../supabaseClient';
import { getCachedZones } from '../offlineCache';
import { getBadgesProgress, checkBadges, BADGE_DEFS } from '../badgeEngine';

// Builds a Supabase-style chainable query-builder mock: every method
// (select/eq/neq/insert/maybeSingle) returns the same object so calls can be
// chained, and the object itself is awaitable (thenable) resolving to
// `resolvedValue`, matching how supabase-js query builders behave.
function makeQueryBuilder(resolvedValue) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    insert: () => builder,
    maybeSingle: () => Promise.resolve(resolvedValue),
    then: (resolve) => resolve(resolvedValue)
  };
  return builder;
}

describe('badgeEngine', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    getCachedZones.mockResolvedValue([]);
  });

  describe('getBadgesProgress — guest user', () => {
    it('computes progress from localStorage only, never calling Supabase', async () => {
      localStorage.setItem(
        'spota_created_spots',
        JSON.stringify([
          { id: 1, category: 'trail', latitude: 10, longitude: 20 },
          { id: 2, category: 'cafe', latitude: 11, longitude: 21 }
        ])
      );

      const { progress } = await getBadgesProgress({ isGuest: true });

      expect(supabase.from).not.toHaveBeenCalled();
      expect(progress.gem_hunter.current).toBe(2);
      expect(progress.gem_hunter.earned).toBe(false); // target is 10
      expect(progress.trail_blazer.current).toBe(1); // only the 'trail' spot qualifies
    });

    it('treats a null user the same as a guest', async () => {
      const { progress } = await getBadgesProgress(null);
      expect(supabase.from).not.toHaveBeenCalled();
      expect(progress.gem_hunter.current).toBe(0);
    });

    it('credits the pioneer badge only for spots inside a cached offline zone', async () => {
      getCachedZones.mockResolvedValue([{ center: { lat: 10, lng: 20 }, radius: 5 }]);
      localStorage.setItem(
        'spota_created_spots',
        JSON.stringify([
          { id: 1, category: 'trail', latitude: 10, longitude: 20 }, // inside zone
          { id: 2, category: 'trail', latitude: 40, longitude: 80 } // far outside
        ])
      );

      const { progress } = await getBadgesProgress({ isGuest: true });
      expect(progress.pioneer.current).toBe(1);
    });
  });

  describe('getBadgesProgress — signed-in user', () => {
    it('merges Supabase data with local data and marks targets met as earned', async () => {
      supabase.from.mockImplementation((table) => {
        const responses = {
          spots: {
            data: Array.from({ length: 9 }, (_, i) => ({
              id: `db_${i}`,
              category: 'trail',
              latitude: 1,
              longitude: 1
            }))
          },
          vibe_ratings: { data: [] },
          safe_treks: { count: 3 }, // meets solo_explorer target (3)
          user_badges: { data: [] }
        };
        return makeQueryBuilder(responses[table]);
      });
      // One more spot locally pushes gem_hunter (target 10) over the line.
      localStorage.setItem(
        'spota_created_spots',
        JSON.stringify([{ id: 'local_1', category: 'cafe', lat: 1, lng: 1 }])
      );

      const { progress } = await getBadgesProgress({ id: 'user_1', isGuest: false });

      expect(progress.gem_hunter.current).toBe(10);
      expect(progress.gem_hunter.earned).toBe(true);
      expect(progress.solo_explorer.earned).toBe(true);
    });

    it('falls back to local-only data if the Supabase queries throw', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('network down');
      });
      localStorage.setItem(
        'spota_created_spots',
        JSON.stringify([{ id: 1, category: 'trail', lat: 1, lng: 1 }])
      );

      const { progress } = await getBadgesProgress({ id: 'user_1', isGuest: false });
      expect(progress.gem_hunter.current).toBe(1);
    });
  });

  describe('checkBadges', () => {
    it('returns no badges, and never touches celebration, when nothing new is earned', async () => {
      supabase.from.mockImplementation((table) => {
        const responses = {
          spots: { data: [] },
          vibe_ratings: { data: [] },
          safe_treks: { count: 0 },
          user_badges: { data: [] }
        };
        return makeQueryBuilder(responses[table]);
      });

      const unlocked = await checkBadges({ id: 'user_1', isGuest: false });
      expect(unlocked).toEqual([]);
    });

    it('does not re-award a badge that is already recorded as earned', async () => {
      supabase.from.mockImplementation((table) => {
        const responses = {
          // Enough spots to satisfy gem_hunter's target...
          spots: {
            data: Array.from({ length: 10 }, (_, i) => ({ id: i, category: 'cafe', latitude: 1, longitude: 1 }))
          },
          vibe_ratings: { data: [] },
          safe_treks: { count: 0 },
          // ...but the server already has it on record.
          user_badges: { data: [{ badge_id: 'gem_hunter' }] }
        };
        return makeQueryBuilder(responses[table]);
      });

      const unlocked = await checkBadges({ id: 'user_1', isGuest: false });
      expect(unlocked).toEqual([]);
    });

    it('returns [] for a guest with no local progress', async () => {
      const unlocked = await checkBadges({ isGuest: true });
      expect(unlocked).toEqual([]);
    });
  });

  it('BADGE_DEFS exposes the 5 documented badges with their targets', () => {
    expect(Object.keys(BADGE_DEFS).sort()).toEqual(
      ['gem_hunter', 'pioneer', 'solo_explorer', 'trail_blazer', 'vibe_lord'].sort()
    );
    expect(BADGE_DEFS.gem_hunter.target).toBe(10);
    expect(BADGE_DEFS.solo_explorer.target).toBe(3);
  });
});
