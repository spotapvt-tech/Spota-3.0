import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../supabaseClient', () => ({
  supabase: {
    storage: { from: vi.fn() },
    from: vi.fn()
  }
}));
vi.mock('../imageUtils', () => ({
  fileToBase64: vi.fn()
}));

import { supabase } from '../supabaseClient';
import { dropGem } from '../gemService';

// Same chainable-thenable pattern used for the badgeEngine tests, matching
// how a real supabase-js query builder can be both chained and awaited.
function makeQueryBuilder(resolvedValue) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    insert: () => builder,
    then: (resolve) => resolve(resolvedValue)
  };
  return builder;
}

const baseGemInput = {
  imageFile: null,
  cameraBase64: null,
  videoFile: null,
  location: { lat: 12.3, lng: 45.6 },
  title: 'Hidden Waterfall',
  category: 'waterfall',
  description: 'A quiet spot off the main trail.',
  tags: ['scenic', 'quiet'],
  address: 'Near Triund',
  vibeRatings: { cozy: 4, insta_worthy: 5, lively: 2, zen: 5, workspace: 1 },
  user: { id: 'user_1', isGuest: false }
};

describe('gemService.dropGem', () => {
  let onLineSpy;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    onLineSpy = vi.spyOn(navigator, 'onLine', 'get');
  });

  afterEach(() => {
    onLineSpy.mockRestore();
  });

  it('queues the gem to localStorage instead of calling Supabase when offline', async () => {
    onLineSpy.mockReturnValue(false);

    const result = await dropGem(baseGemInput);

    expect(result).toEqual({ offline: true });
    expect(supabase.from).not.toHaveBeenCalled();

    const pending = JSON.parse(localStorage.getItem('spota_pending_gems'));
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ title: 'Hidden Waterfall', category: 'waterfall' });
  });

  it('appends to, rather than overwrites, an existing offline queue', async () => {
    onLineSpy.mockReturnValue(false);
    localStorage.setItem('spota_pending_gems', JSON.stringify([{ title: 'Earlier gem' }]));

    await dropGem(baseGemInput);

    const pending = JSON.parse(localStorage.getItem('spota_pending_gems'));
    expect(pending).toHaveLength(2);
    expect(pending[0].title).toBe('Earlier gem');
  });

  it('inserts the spot (with no image) and tracks it locally when online', async () => {
    onLineSpy.mockReturnValue(true);

    supabase.from.mockImplementation((table) => {
      if (table === 'spots') {
        return makeQueryBuilder({ data: [{ id: 'spot_1', category: 'waterfall', latitude: 12.3, longitude: 45.6 }], error: null });
      }
      if (table === 'vibe_ratings') {
        return makeQueryBuilder({ error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await dropGem(baseGemInput);

    expect(result.success).toBe(true);
    expect(result.spot.id).toBe('spot_1');

    const localCreated = JSON.parse(localStorage.getItem('spota_created_spots'));
    expect(localCreated).toEqual([
      { id: 'spot_1', category: 'waterfall', latitude: 12.3, longitude: 45.6 }
    ]);
  });

  it('throws when the spots insert itself fails', async () => {
    onLineSpy.mockReturnValue(true);
    supabase.from.mockImplementation((table) => {
      if (table === 'spots') {
        return makeQueryBuilder({ data: null, error: new Error('insert failed') });
      }
      return makeQueryBuilder({ error: null });
    });

    await expect(dropGem(baseGemInput)).rejects.toThrow('insert failed');
  });

  it('does not fail the whole drop if the (best-effort) vibe_ratings insert fails', async () => {
    onLineSpy.mockReturnValue(true);
    supabase.from.mockImplementation((table) => {
      if (table === 'spots') {
        return makeQueryBuilder({ data: [{ id: 'spot_2', category: 'waterfall', latitude: 1, longitude: 1 }], error: null });
      }
      if (table === 'vibe_ratings') {
        throw new Error('ratings table unreachable');
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await dropGem(baseGemInput);
    expect(result.success).toBe(true);
  });

  it('stores a null user_id for guest drops instead of a real user id', async () => {
    onLineSpy.mockReturnValue(true);
    let capturedInsertPayload;
    supabase.from.mockImplementation((table) => {
      if (table === 'spots') {
        return {
          insert: (payload) => {
            capturedInsertPayload = payload;
            return {
              select: () => ({
                then: (resolve) => resolve({ data: [{ id: 'spot_3' }], error: null })
              })
            };
          }
        };
      }
      return makeQueryBuilder({ error: null });
    });

    await dropGem({ ...baseGemInput, user: { id: 'guest', isGuest: true } });
    expect(capturedInsertPayload[0].user_id).toBeNull();
  });
});
