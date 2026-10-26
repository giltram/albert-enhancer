import type { EnrollmentOption, Weekday } from '../courses/types';
import { eligibleOptions } from './eligibility';
import { optionsConflict } from './conflicts';
import type { ScheduleCandidate, ScheduleProblem } from './types';

export interface RankingWeights {
  readonly professor: number;
  readonly time: number;
  readonly compactness: number;
  readonly daysOff: number;
  readonly robustness: number;
  readonly sectionPreference: number;
}

export interface SchedulePreferences {
  readonly preferredInstructors: Readonly<Record<string, number>>;
  readonly dislikedInstructors: Readonly<Record<string, number>>;
  readonly avoidBeforeMinute?: number;
  readonly avoidAfterMinute?: number;
  readonly avoidFriday: boolean;
  readonly preferredDayOff?: Weekday;
  readonly weights: RankingWeights;
}

export interface ScoreBreakdown {
  readonly professorScore: number;
  readonly timeScore: number;
  readonly compactnessScore: number;
  readonly daysOffScore: number;
  readonly robustnessScore: number;
  readonly sectionPreferenceScore: number;
  readonly totalScore: number;
}

export interface RankedSchedule extends ScheduleCandidate {
  readonly score: ScoreBreakdown;
}

export const defaultSchedulePreferences: SchedulePreferences = {
  preferredInstructors: {},
  dislikedInstructors: {},
  avoidFriday: false,
  weights: { professor: 1, time: 1, compactness: 1, daysOff: 1, robustness: 1, sectionPreference: 1 },
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function professorScore(options: readonly EnrollmentOption[], preferences: SchedulePreferences): number {
  return options.reduce((total, option) => {
    const unique = new Map(option.instructors.map((instructor) => [`${instructor.id ?? ''}\u0000${instructor.name}`, instructor]));
    return total + [...unique.values()].reduce((score, instructor) => {
      return score + (preferences.preferredInstructors[instructor.name] ?? 0)
        - (preferences.dislikedInstructors[instructor.name] ?? 0);
    }, 0);
  }, 0);
}

function sectionPreferenceScore(candidate: ScheduleCandidate, problem?: ScheduleProblem): number {
  if (problem === undefined) return 0;
  return candidate.options.reduce((score, option) => {
    const intent = problem.intents.find((item) => item.courseId === option.courseId);
    const preferred = new Set(intent?.preferredSectionIds);
    return score + option.sectionIds.filter((id) => preferred.has(id)).length;
  }, 0);
}

function timeScore(options: readonly EnrollmentOption[], preferences: SchedulePreferences): number {
  return options.flatMap((option) => option.meetings).reduce((score, meeting) => {
    const early = preferences.avoidBeforeMinute !== undefined && meeting.startMinute < preferences.avoidBeforeMinute ? -1 : 0;
    const late = preferences.avoidAfterMinute !== undefined && meeting.endMinute > preferences.avoidAfterMinute ? -1 : 0;
    const friday = preferences.avoidFriday && meeting.day === 'friday' ? -1 : 0;
    return score + early + late + friday;
  }, 0);
}

function compactnessScore(options: readonly EnrollmentOption[]): number {
  const byDay = new Map<Weekday, { start: number; end: number }[]>();
  for (const meeting of options.flatMap((option) => option.meetings)) {
    const meetings = byDay.get(meeting.day) ?? [];
    meetings.push({ start: meeting.startMinute, end: meeting.endMinute });
    byDay.set(meeting.day, meetings);
  }
  let gapMinutes = 0;
  for (const meetings of byDay.values()) {
    meetings.sort((a, b) => a.start - b.start);
    for (let index = 1; index < meetings.length; index += 1) {
      gapMinutes += Math.max(0, meetings[index]!.start - meetings[index - 1]!.end);
    }
  }
  return round(-gapMinutes / 60);
}

function daysOffScore(options: readonly EnrollmentOption[], preferences: SchedulePreferences): number {
  const days = new Set(options.flatMap((option) => option.meetings.map((meeting) => meeting.day)));
  const weekdayDaysOff = 5 - [...days].filter((day) => !['saturday', 'sunday'].includes(day)).length;
  const preferredBonus = preferences.preferredDayOff !== undefined && !days.has(preferences.preferredDayOff) ? 1 : 0;
  return weekdayDaysOff + preferredBonus;
}

/** Percentage of selected options having at least one currently feasible replacement. */
export function robustnessScore(candidate: ScheduleCandidate, problem?: ScheduleProblem): number {
  if (candidate.options.length === 0 || problem === undefined) return 0;
  let replaceable = 0;
  for (const selected of candidate.options) {
    const remainder = candidate.options.filter((option) => option.id !== selected.id);
    const intent = problem.intents.find((item) => item.courseId === selected.courseId);
    const hasBackup = intent !== undefined && eligibleOptions(problem, intent).some((option) =>
      option.id !== selected.id && remainder.every((other) => !optionsConflict(option, other)));
    if (hasBackup) replaceable += 1;
  }
  return round((replaceable / candidate.options.length) * 100);
}

export function scoreSchedule(
  candidate: ScheduleCandidate,
  preferences: SchedulePreferences,
  problem?: ScheduleProblem,
): ScoreBreakdown {
  const professor = professorScore(candidate.options, preferences);
  const time = timeScore(candidate.options, preferences);
  const compactness = compactnessScore(candidate.options);
  const daysOff = daysOffScore(candidate.options, preferences);
  const robustness = robustnessScore(candidate, problem);
  const sectionPreference = sectionPreferenceScore(candidate, problem);
  return {
    professorScore: professor,
    timeScore: time,
    compactnessScore: compactness,
    daysOffScore: daysOff,
    robustnessScore: robustness,
    sectionPreferenceScore: sectionPreference,
    totalScore: round(
      professor * preferences.weights.professor
      + time * preferences.weights.time
      + compactness * preferences.weights.compactness
      + daysOff * preferences.weights.daysOff
      + robustness * preferences.weights.robustness
      + sectionPreference * preferences.weights.sectionPreference,
    ),
  };
}

export function rankSchedules(
  candidates: readonly ScheduleCandidate[],
  preferences: SchedulePreferences = defaultSchedulePreferences,
  problem?: ScheduleProblem,
): readonly RankedSchedule[] {
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreSchedule(candidate, preferences, problem) }))
    .sort((a, b) => b.score.totalScore - a.score.totalScore || a.id.localeCompare(b.id));
}
