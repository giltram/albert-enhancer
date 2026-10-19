import type { EnrollmentOptionId, SectionId } from '../courses/types';
import type { OptionStatus, RegistrationState } from '../schedule/types';

export type RegistrationEvent =
  | { readonly type: 'set-status'; readonly optionId: EnrollmentOptionId; readonly status: OptionStatus }
  | { readonly type: 'got-it'; readonly optionId: EnrollmentOptionId }
  | { readonly type: 'full'; readonly optionId: EnrollmentOptionId }
  | { readonly type: 'waitlisted'; readonly optionId: EnrollmentOptionId }
  | { readonly type: 'exclude'; readonly optionId: EnrollmentOptionId }
  | { readonly type: 'include'; readonly optionId: EnrollmentOptionId }
  | { readonly type: 'set-section-status'; readonly sectionId: SectionId; readonly status: OptionStatus }
  | { readonly type: 'section-got-it'; readonly sectionId: SectionId }
  | { readonly type: 'section-full'; readonly sectionId: SectionId }
  | { readonly type: 'section-waitlisted'; readonly sectionId: SectionId }
  | { readonly type: 'exclude-section'; readonly sectionId: SectionId }
  | { readonly type: 'include-section'; readonly sectionId: SectionId }
  | { readonly type: 'reset' };

export interface RegistrationHistory {
  readonly present: RegistrationState;
  readonly past: readonly RegistrationState[];
}
