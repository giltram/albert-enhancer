import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { emptyRegistrationState, transition, undo } from '../../src/core/registration';
import type { RegistrationEvent, RegistrationHistory } from '../../src/core/registration';

describe('registration state engine', () => {
  it('supports Got it, Full, Waitlisted, Reset, and Undo', () => {
    const initial: RegistrationHistory = { present: emptyRegistrationState, past: [] };
    const gotIt = transition(initial, { type: 'got-it', optionId: 'a' });
    const full = transition(gotIt, { type: 'full', optionId: 'b' });
    const waitlisted = transition(full, { type: 'waitlisted', optionId: 'c' });
    expect(waitlisted.present.optionStatuses).toEqual({ a: 'locked', b: 'unavailable', c: 'waitlisted' });
    expect(undo(waitlisted).present).toEqual(full.present);
    expect(transition(waitlisted, { type: 'reset' }).present).toEqual(emptyRegistrationState);
  });

  it('undo restores every previous state after arbitrary transitions', () => {
    const eventArbitrary: fc.Arbitrary<RegistrationEvent> = fc.oneof(
      fc.record({ type: fc.constant('got-it' as const), optionId: fc.string({ minLength: 1, maxLength: 4 }) }),
      fc.record({ type: fc.constant('full' as const), optionId: fc.string({ minLength: 1, maxLength: 4 }) }),
      fc.record({ type: fc.constant('waitlisted' as const), optionId: fc.string({ minLength: 1, maxLength: 4 }) }),
      fc.record({ type: fc.constant('reset' as const) }),
    );
    fc.assert(fc.property(fc.array(eventArbitrary, { maxLength: 50 }), (events) => {
      let history: RegistrationHistory = { present: emptyRegistrationState, past: [] };
      const snapshots = [history.present];
      for (const event of events) {
        history = transition(history, event);
        snapshots.push(history.present);
      }
      for (let index = events.length - 1; index >= 0; index -= 1) {
        history = undo(history);
        expect(history.present).toEqual(snapshots[index]);
      }
    }), { numRuns: 200 });
  });

  it('tracks component status and exclusion independently of exact options', () => {
    const withSection = transition({ present: emptyRegistrationState, past: [] }, { type: 'section-full', sectionId: 'rec012' });
    const excluded = transition(withSection, { type: 'exclude-section', sectionId: 'lec001' });
    expect(excluded.present.sectionStatuses).toEqual({ rec012: 'unavailable' });
    expect(excluded.present.excludedSectionIds).toEqual(['lec001']);
    expect(excluded.present.optionStatuses).toEqual({});
  });
});
