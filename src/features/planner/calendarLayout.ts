import type { Meeting } from '../../core/courses';
export interface CalendarBounds {
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface CalendarPlacement {
  readonly topPercent: number;
  readonly heightPercent: number;
}

const defaultStartMinute = 8 * 60;
const defaultEndMinute = 21 * 60;

export function calendarBounds(meetings: readonly Meeting[]): CalendarBounds {
  const earliest = meetings.length === 0 ? defaultStartMinute : Math.min(...meetings.map((meeting) => meeting.startMinute));
  const latest = meetings.length === 0 ? defaultEndMinute : Math.max(...meetings.map((meeting) => meeting.endMinute));
  return {
    startMinute: Math.min(defaultStartMinute, Math.floor(earliest / 60) * 60),
    endMinute: Math.max(defaultEndMinute, Math.ceil(latest / 60) * 60),
  };
}

export function calendarPlacement(meeting: Meeting, bounds: CalendarBounds): CalendarPlacement {
  const span = Math.max(1, bounds.endMinute - bounds.startMinute);
  return {
    topPercent: Math.max(0, (meeting.startMinute - bounds.startMinute) / span * 100),
    heightPercent: Math.max(0, (meeting.endMinute - meeting.startMinute) / span * 100),
  };
}

/** Shanghai has one teaching address, so its calendar cards only need the room. */
export function calendarLocationLabel(location: string): string {
  const shanghaiRoom = /^567 West Yangsi Rd,\s*Shanghai Room\s+(.+)$/i.exec(location.trim());
  return shanghaiRoom?.[1]?.trim() || location;
}
