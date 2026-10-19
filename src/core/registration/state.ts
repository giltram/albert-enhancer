import type { RegistrationState } from '../schedule/types';
import type { RegistrationEvent, RegistrationHistory } from './types';

export const emptyRegistrationState: RegistrationState = {
  optionStatuses: {},
  excludedOptionIds: [],
  sectionStatuses: {},
  excludedSectionIds: [],
};

export function applyRegistrationEvent(
  state: RegistrationState,
  event: RegistrationEvent,
): RegistrationState {
  switch (event.type) {
    case 'set-status':
      return { ...state, optionStatuses: { ...state.optionStatuses, [event.optionId]: event.status } };
    case 'got-it':
      return { ...state, optionStatuses: { ...state.optionStatuses, [event.optionId]: 'locked' } };
    case 'full':
      return { ...state, optionStatuses: { ...state.optionStatuses, [event.optionId]: 'unavailable' } };
    case 'waitlisted':
      return { ...state, optionStatuses: { ...state.optionStatuses, [event.optionId]: 'waitlisted' } };
    case 'exclude':
      return { ...state, excludedOptionIds: [...new Set([...state.excludedOptionIds, event.optionId])].sort() };
    case 'include':
      return { ...state, excludedOptionIds: state.excludedOptionIds.filter((id) => id !== event.optionId) };
    case 'set-section-status':
      return { ...state, sectionStatuses: { ...state.sectionStatuses, [event.sectionId]: event.status } };
    case 'section-got-it':
      return { ...state, sectionStatuses: { ...state.sectionStatuses, [event.sectionId]: 'locked' } };
    case 'section-full':
      return { ...state, sectionStatuses: { ...state.sectionStatuses, [event.sectionId]: 'unavailable' } };
    case 'section-waitlisted':
      return { ...state, sectionStatuses: { ...state.sectionStatuses, [event.sectionId]: 'waitlisted' } };
    case 'exclude-section':
      return { ...state, excludedSectionIds: [...new Set([...(state.excludedSectionIds ?? []), event.sectionId])].sort() };
    case 'include-section':
      return { ...state, excludedSectionIds: (state.excludedSectionIds ?? []).filter((id) => id !== event.sectionId) };
    case 'reset':
      return emptyRegistrationState;
  }
}

export function transition(history: RegistrationHistory, event: RegistrationEvent): RegistrationHistory {
  return {
    past: [...history.past, history.present],
    present: applyRegistrationEvent(history.present, event),
  };
}

export function undo(history: RegistrationHistory): RegistrationHistory {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return { present: previous, past: history.past.slice(0, -1) };
}
