import { describe, it, expect } from 'vitest';
import { formatRelativeDate } from '../ActivityFeed';

describe('ActivityFeed', () => {
  describe('formatRelativeDate', () => {
    it('returns "Today" for today\'s date', () => {
      const today = new Date().toISOString();
      expect(formatRelativeDate(today)).toBe('Today');
    });
  });
});
