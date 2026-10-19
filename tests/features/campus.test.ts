import { describe, expect, it } from 'vitest';
import { selectPreferredCampus } from '../../src/features/campus';

const options = [
  { value: 'WSQ', label: 'Washington Square' },
  { value: 'SH', label: 'Shanghai' },
];

describe('campus preference', () => {
  it('selects the configured exact Albert option', () => {
    expect(selectPreferredCampus(options, 'WSQ', { enabled: true, preferredValue: 'SH' })).toBe('SH');
  });

  it('does not choose a fallback when the campus is missing', () => {
    expect(selectPreferredCampus(options, 'WSQ', { enabled: true, preferredValue: 'AD' })).toBeUndefined();
  });

  it('does nothing when disabled', () => {
    expect(selectPreferredCampus(options, 'WSQ', { enabled: false, preferredValue: 'SH' })).toBeUndefined();
  });
});
