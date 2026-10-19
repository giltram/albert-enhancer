import type { Course, Meeting, Section, SectionComponentType, Weekday } from '../../core/courses';
import type { CourseInformation } from '../../features/highlighting';
import { ALBERT_SELECTORS } from './selectors';

export interface ParsedAlbertCourse {
  readonly course: Course;
  readonly section: Section;
  readonly information: CourseInformation;
}

const dayNames: Readonly<Record<string, Weekday>> = {
  mon: 'monday', monday: 'monday', tue: 'tuesday', tues: 'tuesday', tuesday: 'tuesday',
  wed: 'wednesday', wednesday: 'wednesday', thu: 'thursday', thur: 'thursday', thurs: 'thursday', thursday: 'thursday',
  fri: 'friday', friday: 'friday', sat: 'saturday', saturday: 'saturday', sun: 'sunday', sunday: 'sunday',
};

export function normalizeComponentType(value: string | undefined): SectionComponentType {
  const normalized = value?.trim().toLocaleLowerCase('en-US') ?? '';
  if (/\b(?:lecture|lec)\b/.test(normalized)) return 'lecture';
  if (/\b(?:recitation|rec)\b/.test(normalized)) return 'recitation';
  if (/\b(?:laboratory|lab)\b/.test(normalized)) return 'lab';
  if (/\bseminar\b/.test(normalized)) return 'seminar';
  if (/\bworkshop\b/.test(normalized)) return 'workshop';
  if (/\bdiscussion\b/.test(normalized)) return 'discussion';
  return 'other';
}

function text(root: ParentNode, selector: string): string | undefined {
  const value = root.querySelector(selector)?.textContent?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function timeToMinute(value: string): number | undefined {
  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(value.trim());
  if (match === null) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour > 23 || minute > 59) return undefined;
  return hour * 60 + minute;
}

function clockMinute(value: string, inheritedPeriod?: string, endHour?: number): number | undefined {
  const match = /^(\d{1,2})(?:[.:](\d{2}))?\s*(a|p|am|pm)?$/i.exec(value.trim());
  if (match === null) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  let period = match[3]?.toLocaleLowerCase('en-US') ?? inheritedPeriod;
  if (match[3] === undefined && inheritedPeriod?.startsWith('p') && endHour !== undefined && hour > endHour) period = 'am';
  if (period !== undefined) {
    if (hour < 1 || hour > 12 || minute > 59) return undefined;
    return (hour % 12) * 60 + minute + (period.startsWith('p') ? 720 : 0);
  }
  return timeToMinute(value);
}

function parseDays(value: string): readonly Weekday[] {
  const words = value.split(/[\s/,]+/).filter(Boolean);
  const expanded: Weekday[] = [];
  for (const word of words) {
    const named = dayNames[word.toLocaleLowerCase('en-US')];
    if (named !== undefined) { expanded.push(named); continue; }
    if (/^[MTWRFSU]+$/.test(word)) {
      const compact: Readonly<Record<string, Weekday>> = { M: 'monday', T: 'tuesday', W: 'wednesday', R: 'thursday', F: 'friday', S: 'saturday', U: 'sunday' };
      for (const letter of word) expanded.push(compact[letter]!);
    }
  }
  return [...new Set(expanded)];
}

export function parseMeetingText(value: string, location?: string): readonly Meeting[] {
  const normalized = value
    .replace(/[–—]/g, '-')
    .replace(/·/g, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}\b/g, ' ');
  const times = /(\d{1,2}(?:[.:]\d{2})?\s*(?:a|p|am|pm)?)\s*-\s*(\d{1,2}(?:[.:]\d{2})?\s*(?:a|p|am|pm)?)/i.exec(normalized);
  if (times === null) return [];
  const endMatch = /^(\d{1,2})(?:[.:]\d{2})?\s*(a|p|am|pm)?$/i.exec(times[2]!.trim());
  const endPeriod = endMatch?.[2]?.toLocaleLowerCase('en-US');
  const endHour = endMatch === null ? undefined : Number(endMatch[1]);
  const startMinute = clockMinute(times[1]!, endPeriod, endHour);
  const endMinute = clockMinute(times[2]!);
  if (startMinute === undefined || endMinute === undefined || endMinute <= startMinute) return [];
  const beforeTime = normalized.slice(0, times.index);
  return parseDays(beforeTime).map((day) => ({ day, startMinute, endMinute, ...(location === undefined ? {} : { location }) }));
}

function withoutLabel(value: string | undefined, label: string): string | undefined {
  return value?.replace(new RegExp(`^${label}:?\\s*`, 'i'), '').trim() || undefined;
}

function normalizedText(value: string | null | undefined): string | undefined {
  const result = value?.replace(/\s+/g, ' ').trim();
  return result === undefined || result.length === 0 ? undefined : result;
}

function withoutExpansionControl(value: string | undefined): string | undefined {
  return normalizedText(value?.replace(/\s*(?:less|more)\s+description\s+for\b.*$/i, ''));
}

function textWithBreaks(root: Element): string {
  const clone = root.cloneNode(true) as Element;
  for (const node of clone.querySelectorAll('br')) node.replaceWith('\n');
  for (const node of clone.querySelectorAll('div, p, tr')) node.append('\n');
  return clone.textContent ?? '';
}

function loggedCourseIdentity(root: Element): { code: string; title: string } | undefined {
  const courseRoot = root.closest(ALBERT_SELECTORS.loggedCourseRoot);
  const headingNode = courseRoot?.querySelector<HTMLElement>(ALBERT_SELECTORS.loggedCourseHeading);
  const heading = normalizedText(headingNode?.dataset.aeOriginalText ?? headingNode?.textContent);
  if (heading === undefined) return undefined;
  const match = /^([A-Z][A-Z0-9]*-[A-Z0-9]+)\s+([0-9][A-Z0-9.-]*)\s+(.+)$/i.exec(heading);
  if (match === null) return undefined;
  return { code: `${match[1]!.toLocaleUpperCase('en-US')} ${match[2]!}`, title: match[3]! };
}

function labeledValue(value: string, label: string, followingLabels: readonly string[]): string | undefined {
  const boundary = followingLabels.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*(.+?)(?=\\s+(?:${boundary}):|$)`, 'i').exec(value);
  return normalizedText(match?.[1]);
}

function textAfterLabelUntilBreak(root: Element, label: string): string | undefined {
  const labelNode = [...root.querySelectorAll('.boldText, strong, b')]
    .find((node) => normalizedText(node.textContent)?.toLocaleLowerCase('en-US') === `${label.toLocaleLowerCase('en-US')}:`);
  if (labelNode === undefined) return undefined;
  const parts: string[] = [];
  let node: ChildNode | null = labelNode.nextSibling;
  while (node !== null && !(node instanceof HTMLBRElement)) {
    parts.push(node.textContent ?? '');
    node = node.nextSibling;
  }
  return normalizedText(parts.join(' '));
}

function fulfillmentLabels(description: string | undefined): readonly string[] {
  const fulfillment = /\bFulfillment:\s*(.+)$/i.exec(description ?? '')?.[1];
  const major = /(?:^|;)\s*Major:\s*([^;]+)/i.exec(fulfillment ?? '')?.[1];
  if (major === undefined) return [];
  return [...new Set(major.split(',').map((label) => label.replace(/[.;]+$/, '').trim())
    .filter(Boolean)
    .map((label) => /^CS Electives$/i.test(label) ? 'CS Elective' : label))];
}

function relevantSentences(value: string | undefined, pattern: RegExp): string | undefined {
  if (value === undefined) return undefined;
  const matches = value.split(/(?<=[.!?])\s+/).filter((sentence) => pattern.test(sentence));
  const result = normalizedText(matches.slice(0, 2).join(' '));
  if (result === undefined) return undefined;
  return result.length <= 280 ? result : `${result.slice(0, 277).trimEnd()}…`;
}

function parseLoggedCourse(root: Element): ParsedAlbertCourse | undefined {
  if (!root.id.startsWith('win0divNYU_CLS_DTL_CLASS_NBR$')) return undefined;
  const identity = loggedCourseIdentity(root);
  if (identity === undefined) return undefined;
  const sectionText = textWithBreaks(root);
  const summary = normalizedText(sectionText) ?? '';
  const sectionCode = /\bSection:\s*([^\s]+)/i.exec(summary)?.[1];
  if (sectionCode === undefined) return undefined;
  const classNumber = /\bClass#:\s*(\d+)/i.exec(summary)?.[1];
  const componentType = normalizeComponentType(labeledValue(summary, 'Component', ['Notes']));
  const fallbackLocation = labeledValue(summary, 'Course Location', ['Component', 'Notes']);
  const lines = sectionText.split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const meetingLines = lines.filter((line) => /\b(?:Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)(?:day)?\b/i.test(line)
    && /\d{1,2}[.:]\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}[.:]\d{2}\s*(?:AM|PM)/i.test(line));
  const meetings = meetingLines.flatMap((line) => {
    const room = normalizedText(/\bat\s+(.+?)(?:\s+with\s+|$)/i.exec(line)?.[1]) ?? fallbackLocation;
    return parseMeetingText(line, room);
  });
  const instructors = [...new Set(meetingLines.flatMap((line) => {
    const instructor = normalizedText(/\bwith\s+(.+?)(?:\s+Notes:|$)/i.exec(line)?.[1]);
    return instructor === undefined ? [] : [instructor];
  }))];
  const notes = textAfterLabelUntilBreak(root, 'Notes');
  const courseRoot = root.closest(ALBERT_SELECTORS.loggedCourseRoot);
  const description = normalizedText(courseRoot?.querySelector('[id^="fullDescription_"]')?.textContent);
  const prerequisite = normalizedText(/\bPrerequisites?:\s*(.+?)(?:\s+Fulfillment:|$)/i.exec(description ?? '')?.[1]);
  const degreeLabels = fulfillmentLabels(description);
  const roomLocations = [...new Set(meetings.flatMap((meeting) => meeting.location === undefined ? [] : [meeting.location]))];
  const displayLocation = roomLocations.length === 0 ? fallbackLocation : [fallbackLocation, ...roomLocations].filter(Boolean).join(' · ');
  const extraFee = relevantSentences(notes, /(?:\$|\bfee\b|\bcost(?:s|ing)?\b)/i);
  const specialRule = relevantSentences(notes, /(?:instructor|department)\s+(?:permission|consent)|(?:restricted|reserved)\s+(?:to|for)|not\s+open\s+to|audition|application\s+required|enrollment\s+(?:permission|required)|co-?requisite/i);
  const courseId = identity.code.toLocaleUpperCase('en-US');
  const sectionId = `${courseId}:${sectionCode}`;
  return {
    course: { id: courseId, code: identity.code, title: identity.title },
    section: {
      id: sectionId,
      courseId,
      componentType,
      sectionCode,
      ...(classNumber === undefined ? {} : { classNumber }),
      instructors: instructors.map((name) => ({ name })),
      meetings,
    },
    information: {
      meetings,
      ...(displayLocation === undefined ? {} : { location: displayLocation }),
      ...(instructors.length === 0 ? {} : { instructor: instructors.join('; ') }),
      ...(prerequisite === undefined ? {} : { prerequisite }),
      ...(extraFee === undefined ? {} : { extraFee }),
      ...(specialRule === undefined ? {} : { specialRule }),
      classifications: ['unknown'],
      ...(degreeLabels.length === 0 ? {} : { degreeLabels }),
    },
  };
}

export function parseCourse(root: Element): ParsedAlbertCourse | undefined {
  const logged = parseLoggedCourse(root);
  if (logged !== undefined) return logged;
  const code = text(root, ALBERT_SELECTORS.courseCode);
  const title = text(root, ALBERT_SELECTORS.courseTitle);
  const sectionSummary = root.querySelector('.dtl-section')?.textContent?.trim();
  const sectionCode = text(root, ALBERT_SELECTORS.sectionCode) ?? /Section\s+([^,]+)/i.exec(sectionSummary ?? '')?.[1]?.trim();
  if (code === undefined || title === undefined || sectionCode === undefined) return undefined;
  const meetingRoom = root.querySelector<HTMLElement>('.section--meeting_html [class*="meet-room-"]')?.textContent?.replace(/^\s*in\s+/i, '').trim();
  const location = meetingRoom || withoutLabel(text(root, ALBERT_SELECTORS.location), 'Location');
  const instructor = text(root, ALBERT_SELECTORS.instructor);
  const prerequisite = withoutExpansionControl(text(root, ALBERT_SELECTORS.prerequisite));
  const extraFee = withoutExpansionControl(text(root, ALBERT_SELECTORS.extraFee));
  const specialRule = withoutExpansionControl(text(root, ALBERT_SELECTORS.specialRule));
  const meetings = [...root.querySelectorAll(ALBERT_SELECTORS.meetings)]
    .flatMap((node) => parseMeetingText(node.textContent?.trim() ?? '', location));
  const courseId = code.toLocaleUpperCase('en-US');
  const sectionId = `${courseId}:${sectionCode}`;
  return {
    course: { id: courseId, code, title },
    section: {
      id: sectionId,
      courseId,
      componentType: normalizeComponentType(text(root, ALBERT_SELECTORS.component)),
      sectionCode,
      ...((text(root, ALBERT_SELECTORS.classNumber) ?? /Class\s*#\s*(\d+)/i.exec(sectionSummary ?? '')?.[1]) === undefined ? {} : { classNumber: (text(root, ALBERT_SELECTORS.classNumber) ?? /Class\s*#\s*(\d+)/i.exec(sectionSummary ?? '')?.[1])! }),
      instructors: instructor === undefined ? [] : [{ name: instructor }],
      meetings,
    },
    information: {
      meetings,
      ...(location === undefined ? {} : { location }),
      ...(instructor === undefined ? {} : { instructor }),
      ...(prerequisite === undefined ? {} : { prerequisite }),
      ...(extraFee === undefined ? {} : { extraFee }),
      ...(specialRule === undefined ? {} : { specialRule }),
      classifications: ['unknown'],
    },
  };
}
