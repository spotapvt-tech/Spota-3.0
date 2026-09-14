import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  calculateTimeRemaining,
  formatCountdown,
  isNearDeadline,
  saveActiveTrekLocal,
  getActiveTrekLocal,
  clearActiveTrekLocal
} from '../safeTrekTimer';

describe('safeTrekTimer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('calculateTimeRemaining', () => {
    it('returns 0 when lastCheckedIn or intervalHours is missing', () => {
      expect(calculateTimeRemaining(null, 2)).toBe(0);
      expect(calculateTimeRemaining('2026-01-01T00:00:00Z', null)).toBe(0);
    });

    it('returns seconds remaining until the interval elapses', () => {
      const now = new Date('2026-01-01T10:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      // Checked in 1 hour ago, interval is 3 hours -> 2 hours (7200s) remaining
      const lastCheckedIn = new Date('2026-01-01T09:00:00Z').toISOString();
      expect(calculateTimeRemaining(lastCheckedIn, 3)).toBe(7200);

      vi.useRealTimers();
    });

    it('never returns a negative number once the deadline has passed', () => {
      const now = new Date('2026-01-01T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const lastCheckedIn = new Date('2026-01-01T09:00:00Z').toISOString();
      expect(calculateTimeRemaining(lastCheckedIn, 1)).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('formatCountdown', () => {
    it('formats seconds as HH:MM:SS', () => {
      expect(formatCountdown(7325)).toBe('02:02:05');
      expect(formatCountdown(59)).toBe('00:00:59');
      expect(formatCountdown(3600)).toBe('01:00:00');
    });

    it('returns 00:00:00 for zero, negative, or NaN input', () => {
      expect(formatCountdown(0)).toBe('00:00:00');
      expect(formatCountdown(-5)).toBe('00:00:00');
      expect(formatCountdown(NaN)).toBe('00:00:00');
    });
  });

  describe('isNearDeadline', () => {
    it('is true at or under 30 minutes remaining (but not zero/expired)', () => {
      expect(isNearDeadline(1800)).toBe(true);
      expect(isNearDeadline(1)).toBe(true);
      expect(isNearDeadline(0)).toBe(false);
    });

    it('is false above 30 minutes remaining', () => {
      expect(isNearDeadline(1801)).toBe(false);
      expect(isNearDeadline(3600)).toBe(false);
    });
  });

  describe('local trek persistence', () => {
    it('round-trips a trek through save/get', () => {
      const trek = { id: 'trek_1', intervalHours: 2, lastCheckedIn: '2026-01-01T00:00:00Z' };
      saveActiveTrekLocal(trek);
      expect(getActiveTrekLocal()).toEqual(trek);
    });

    it('returns null when nothing is stored', () => {
      expect(getActiveTrekLocal()).toBeNull();
    });

    it('returns null and does not throw on corrupted stored JSON', () => {
      localStorage.setItem('spota_active_trek', '{not valid json');
      expect(getActiveTrekLocal()).toBeNull();
    });

    it('clears the stored trek', () => {
      saveActiveTrekLocal({ id: 'trek_1' });
      clearActiveTrekLocal();
      expect(getActiveTrekLocal()).toBeNull();
    });

    it('does nothing when asked to save a falsy trek', () => {
      saveActiveTrekLocal(null);
      expect(getActiveTrekLocal()).toBeNull();
    });
  });
});
