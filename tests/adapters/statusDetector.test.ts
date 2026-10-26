import { describe, expect, it } from 'vitest';
import { detectRegistrationStatus } from '../../src/adapters/albert/statusDetector';

describe('shadow registration status detection', () => {
  it.each([
    ['Successfully enrolled', 'enrolled'],
    ['Class full', 'full'],
    ['You are on the waitlist', 'waitlisted'],
    ['Open', 'unknown'],
    ['You are not enrolled in this class.', 'unknown'],
    ['Enrollment failed: you must be enrolled in the linked lab first.', 'unknown'],
    ['You are not on the waitlist.', 'unknown'],
    ['Enrolled but section full', 'unknown'],
  ] as const)('maps %s conservatively', (text, status) => {
    expect(detectRegistrationStatus(text)).toBe(status);
  });
});
