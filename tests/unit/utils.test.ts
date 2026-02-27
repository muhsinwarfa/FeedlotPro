import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (Tailwind class merger)', () => {
  it('returns single class unchanged', () => {
    expect(cn('px-4')).toBe('px-4');
  });

  it('merges two non-conflicting classes', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('resolves Tailwind conflict: later padding overrides earlier', () => {
    // twMerge: px-2 then px-4 → px-4 wins
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('resolves Tailwind conflict: text-red-500 overrides text-blue-500', () => {
    expect(cn('text-blue-500', 'text-red-500')).toBe('text-red-500');
  });

  it('handles undefined inputs without throwing', () => {
    expect(() => cn(undefined, 'px-4')).not.toThrow();
  });

  it('ignores false conditional inputs', () => {
    expect(cn('px-4', false && 'py-2')).toBe('px-4');
  });

  it('ignores null inputs', () => {
    expect(cn('px-4', null)).toBe('px-4');
  });

  it('handles array inputs', () => {
    expect(cn(['px-4', 'py-2'])).toBe('px-4 py-2');
  });

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('');
  });

  it('handles conditional object syntax', () => {
    expect(cn({ 'px-4': true, 'py-2': false })).toBe('px-4');
  });
});
